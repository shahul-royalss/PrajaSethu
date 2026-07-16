import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IdentityService } from '../identity/identity.service';
import { ConsentService } from '../identity/consent.service';
import { ClassificationService } from '../classification/classification.service';
import { BhashiniService } from '../bhashini/bhashini.service';
import { RoutingService } from '../routing/routing.service';
import { SlaService } from '../sla/sla.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationService } from '../notification/notification.service';
import { LlmService, CitizenProfile } from '../llm/llm.service';
import { DataExchangeService } from '../dataexchange/dataexchange.service';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { canTransition, InvalidTransitionError } from '../../common/state-machine';
import {
  AUTO_ROUTE_GATE,
  Category,
  LedgerEvent,
  Roles,
  Status,
  StatusType,
  TRACKING_PREFIX,
  VERIFICATION_SLA_HOURS,
} from '../../common/constants';
import { parseJson } from '../../common/util';
import { detectLanguage, langName } from '../../common/lang';
import { DEPARTMENT_KB } from '../llm/ai-knowledge';
import {
  ActionDto,
  ConfirmClassificationDto,
  ConfirmClosureDto,
  CopilotAskDto,
  CreateGrievanceDto,
  DeskReviewDecisionDto,
  ForceCloseDto,
  ReassignDto,
  RejectDto,
  ReopenDto,
  ReopenRequestDto,
  ResolveDto,
  VerificationDecisionDto,
} from './grievances.dto';

const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

@Injectable()
export class GrievancesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: IdentityService,
    private readonly consent: ConsentService,
    private readonly classification: ClassificationService,
    private readonly bhashini: BhashiniService,
    private readonly routing: RoutingService,
    private readonly sla: SlaService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationService,
    private readonly llm: LlmService,
    private readonly dataExchange: DataExchangeService,
    private readonly attachments: AttachmentsService,
  ) {}

  // ── Intake — Saarthi 2.0 canonical pipeline (§2) ───────────────────────────
  // denoise/VAD/ASR happen client- or Bhashini-side; from here: language
  // detection → translation → LLM extraction → classifier + 95% gate → dedupe
  // merge → auto-route or human verification. The original voice recording is
  // preserved untouched and sealed to the ledger.
  async create(dto: CreateGrievanceDto, actor?: AuthUser) {
    // 1) Text of record: typed text, client-ASR transcript, or (legacy) Bhashini ref.
    let description = dto.description?.trim() ?? '';
    let voiceTranscript: string | null = null;
    if (!description && dto.voiceInputRef) {
      const asr = await this.bhashini.asr(dto.voiceInputRef, dto.language ?? 'te');
      description = asr.transcript;
      voiceTranscript = asr.transcript;
    }
    const voiceOnly = !description && !!dto.voiceBase64;
    if (voiceOnly) {
      // No transcript available on this device — the audio itself is evidence;
      // a language officer transcribes within the T2 assist SLA (§4.4).
      description = '(Voice complaint — audio attached; human transcription assist queued.)';
    }
    if (!description) {
      throw new BadRequestException('A description (typed), a voice recording, or a voiceInputRef is required.');
    }

    // 2) Automatic language detection — server-side script analysis fused with
    //    the client's live detection. The citizen never picks a language.
    const serverDet = detectLanguage(voiceOnly ? '' : description);
    const detectedLang = dto.detectedLang || (voiceOnly ? dto.language ?? 'te' : serverDet.lang);
    const langConfidence = dto.detectedLang ? Math.max(dto.langConfidence ?? 0.8, 0.5) : serverDet.confidence;
    const codeSwitched = dto.codeSwitched ?? serverDet.codeSwitched;
    const language = detectedLang || dto.language || 'te';

    // 3) Working-language translation (Bhashini NMT; mock in the pilot).
    const descriptionEn =
      language === 'te' ? (await this.bhashini.nmt(description, 'te', 'en')).text : description;

    // 4) LLM complaint understanding — one structured extraction call (§7.1).
    const extraction = await this.llm.extractComplaint({ text: description, languageHint: language });

    // 5) Resolve / create the petitioner (Aadhaar tokenised, never raw).
    let citizen = null as Awaited<ReturnType<typeof this.identity.resolveCitizen>> | null;
    if (actor?.kind === 'CITIZEN' && actor.sub) {
      citizen = await this.identity.attachToCitizen(actor.sub, {
        aadhaar: dto.aadhaar,
        name: dto.name,
        coName: dto.coName,
        dob: dto.dob,
        gender: dto.gender,
        houseNo: dto.houseNo,
        habitation: dto.habitation,
        village: dto.village,
        mandal: dto.mandal,
        district: dto.district,
        secretariatCode: dto.secretariatCode,
        applicantType: dto.applicantType,
        languagePref: language,
        vulnerabilityFlags: dto.vulnerabilityFlags,
      });
    }
    if (!citizen) {
      if (!dto.mobile) {
        throw new BadRequestException('A mobile number is required (or sign in as a citizen first).');
      }
      citizen = await this.identity.resolveCitizen({
        aadhaar: dto.aadhaar,
        mobile: dto.mobile,
        name: dto.name,
        coName: dto.coName,
        dob: dto.dob,
        gender: dto.gender,
        houseNo: dto.houseNo,
        habitation: dto.habitation,
        village: dto.village,
        mandal: dto.mandal,
        district: dto.district,
        secretariatCode: dto.secretariatCode,
        applicantType: dto.applicantType,
        languagePref: language,
        vulnerabilityFlags: dto.vulnerabilityFlags,
      });
    }

    // 6) Distress / safety (keyword lane + extraction safety flag).
    const distress = this.classification.detectDistress(description);
    const emergency = distress.emergency || extraction.safetyFlag || extraction.urgency === 'IMMEDIATE';

    // 7) Priority score.
    const vulnerability = parseJson<string[]>(citizen.vulnerabilityFlags, []);
    const category = dto.category ?? Category.NON_FINANCE;
    const priorityScore = this.computePriority({
      distress: distress.distress || extraction.safetyFlag,
      vulnerabilityCount: vulnerability.length,
      category,
      severity: extraction.severity,
    });

    // 8) Persist as REGISTERED with a unique tracking code.
    const ysr = await this.generateYsr();
    const mandal = dto.grievanceMandal ?? dto.mandal ?? citizen.mandal;
    const village = dto.grievanceVillage ?? dto.village ?? citizen.village;
    const grievance = await this.prisma.grievance.create({
      data: {
        ysr,
        petitionerId: citizen.id,
        channel: dto.channel,
        language,
        description,
        descriptionEn,
        voiceInputRef: dto.voiceInputRef,
        detectedLang,
        langConfidence,
        codeSwitched,
        issue: extraction.issue,
        issueCategory: extraction.issueCategory,
        summaryEn: extraction.summaryEn,
        summaryTe: extraction.summaryTe,
        severity: extraction.severity,
        urgency: extraction.urgency,
        safetyFlag: extraction.safetyFlag,
        sentiment: extraction.sentiment,
        entities: JSON.stringify(extraction.entities ?? {}),
        aiSuggestedDeptId: extraction.departmentHint,
        category,
        distressFlag: distress.distress || extraction.safetyFlag,
        emergency,
        priorityScore,
        geoLat: dto.geoLat,
        geoLng: dto.geoLng,
        geoAccuracy: dto.geoAccuracy,
        geoCapturedAt: dto.geoLat != null ? new Date() : null,
        district: dto.grievanceDistrict ?? dto.district ?? citizen.district,
        mandal,
        village,
        secretariatCode: dto.secretariatCode ?? citizen.secretariatCode,
        applicantType: dto.applicantType ?? citizen.applicantType,
        status: Status.REGISTERED,
        currentLevel: 1,
        registeredAt: new Date(),
      },
    });

    // 9) Preserve the ORIGINAL voice recording untouched — evidence, sealed on
    //    the ledger by its SHA-256 (§10.1: the audio travels with the ticket).
    let voiceAttachmentId: string | null = null;
    if (dto.voiceBase64) {
      const att = await this.attachments.add(
        grievance.id,
        {
          filename: `voice-complaint-${ysr}.${extFor(dto.voiceMime)}`,
          mime: dto.voiceMime ?? 'audio/webm',
          dataBase64: dto.voiceBase64,
        },
        'CITIZEN',
        'VOICE',
      );
      voiceAttachmentId = att.id;
      if (dto.voiceDurationSec) {
        await this.prisma.attachment.update({ where: { id: att.id }, data: { durationSec: Math.round(dto.voiceDurationSec) } });
      }
      await this.ledger.append({
        grievanceId: grievance.id,
        eventType: LedgerEvent.VOICE_EVIDENCE_SEALED,
        actorRole: 'SYSTEM',
        payload: { ysr, sha256: (att as any).hash, mime: dto.voiceMime ?? 'audio/webm', durationSec: dto.voiceDurationSec ?? null },
      });
    }

    // 10) Consent (lawful basis + X-Road gate).
    if (dto.consent) {
      await this.consent.grant({
        petitionerId: citizen.id,
        purpose: `grievance:${ysr}`,
        scope: dto.consentScope ?? [],
        grantedBy: actor?.kind === 'OFFICER' ? 'DA' : 'SELF',
        daId: actor?.kind === 'OFFICER' ? actor.sub : null,
      });
    }

    // 11) Acknowledge + notarise REGISTERED.
    await this.notifications.send({
      grievanceId: grievance.id,
      to: citizen.mobile,
      template: 'ACK',
      body: `Your grievance is registered. Tracking ID ${ysr}. Track on SAARTHI / call 1902.`,
    });
    await this.ledger.append({
      grievanceId: grievance.id,
      eventType: LedgerEvent.REGISTERED,
      actorRole: actor?.role ?? 'CITIZEN',
      payload: { ysr, channel: dto.channel, category, distress: distress.distress, detectedLang, langConfidence },
    });

    // 12) DUPLICATE SCAN (§9) — geo + semantic, across original text, working
    // translation and the AI's English summary (cross-language clustering).
    const duplicate = await this.classification.findDuplicate(description, {
      excludeId: grievance.id,
      mandal,
      village,
      lat: dto.geoLat,
      lng: dto.geoLng,
      deptId: extraction.departmentHint,
      textEn: descriptionEn !== description ? descriptionEn : null,
      summaryEn: extraction.summaryEn,
    });
    if (duplicate.isDuplicate && duplicate.duplicateOf) {
      const merged = await this.mergeIntoCanonical(grievance.id, duplicate.duplicateOf, {
        similarity: duplicate.similarity,
        distanceMeters: duplicate.distanceMeters ?? null,
        actorRole: 'SYSTEM',
      });
      await this.notifications.send({
        grievanceId: grievance.id,
        to: citizen.mobile,
        template: 'MERGED',
        body: `${merged.reportCount} citizens have reported this issue here. Your report ${ysr} was added to case ${merged.canonicalYsr} and raised its priority. You will be notified when it is resolved.`,
      });
      return {
        id: grievance.id,
        ysr,
        status: Status.MERGED,
        triage: this.triageSummary(grievance, extraction, {
          gate: 'MERGED',
          merged: { canonicalYsr: merged.canonicalYsr, reportCount: merged.reportCount },
        }),
        duplicate,
        distress,
        voiceTranscript,
        voiceAttachmentId,
        smsSent: true,
      };
    }

    // 13) Two-stage classifier + the 95% gate (§8) — or operator confirmation.
    if (dto.deptId) {
      // Operator/DA confirmed a department — human routing, immediate assign.
      await this.classifyAndAssign(
        grievance.id,
        { deptId: dto.deptId, subjectId: dto.subjectId, subSubjectId: dto.subSubjectId, category: dto.category ?? category },
        actor,
        true,
      );
      const routed = await this.getOrThrow(grievance.id);
      const officer = await this.currentOfficer(routed);
      return {
        id: grievance.id,
        ysr,
        status: routed.status,
        triage: this.triageSummary(routed, extraction, { gate: 'OPERATOR', officer }),
        duplicate,
        distress,
        voiceTranscript,
        voiceAttachmentId,
        smsSent: true,
      };
    }

    const routeResult = await this.triageAndRoute(grievance.id, descriptionEn || description, extraction);
    const fresh = await this.getOrThrow(grievance.id);
    const officer = fresh.currentAssigneeId ? await this.currentOfficer(fresh) : null;
    return {
      id: grievance.id,
      ysr,
      status: fresh.status,
      triage: this.triageSummary(fresh, extraction, { ...routeResult, officer }),
      duplicate,
      distress,
      voiceTranscript,
      voiceAttachmentId,
      smsSent: true,
    };
  }

  /**
   * The 95% gate (§8.3): Stage A (LLM hint) + Stage B (calibrated classifier).
   * Auto-route ONLY when p1 ≥ gate AND the stages agree; anything less goes to a
   * District Grievance Officer with the AI's top-3 — and their decision trains
   * the model. Model disagreement forces human review even at 99%.
   */
  private async triageAndRoute(
    grievanceId: string,
    workingText: string,
    extraction: Awaited<ReturnType<LlmService['extractComplaint']>>,
  ): Promise<{ gate: 'AUTO_ROUTED' | 'HUMAN_VERIFICATION'; top3?: { deptId: string; name: string; probability: number }[]; confidence?: number }> {
    const stageB = await this.classification.classifyProbabilities(workingText);
    const hintA = extraction.departmentHint;
    const top1 = stageB.top1;
    const top3 = stageB.probs.slice(0, 3).map((p) => ({
      deptId: p.deptId,
      name: DEPARTMENT_KB.find((d) => d.deptId === p.deptId)?.name ?? p.deptId,
      probability: p.probability,
    }));

    // The department must actually exist in this pilot's seeded taxonomy to be routable.
    const routable = top1 ? await this.prisma.department.findUnique({ where: { id: top1.deptId } }) : null;

    const agree = !!top1 && !!hintA && top1.deptId === hintA;
    const pass = !!top1 && top1.probability >= AUTO_ROUTE_GATE && agree && !!routable;

    await this.ledger.append({
      grievanceId,
      eventType: LedgerEvent.AI_TRIAGED,
      actorRole: 'AI',
      payload: {
        stageA_hint: hintA,
        stageB_top3: top3,
        stageB_model: stageB.modelVersion,
        gate: AUTO_ROUTE_GATE,
        agree,
        decision: pass ? 'AUTO_ROUTE' : 'HUMAN_VERIFICATION',
        severity: extraction.severity,
        urgency: extraction.urgency,
        extractionSource: extraction.source,
      },
    });

    if (pass && top1) {
      const subject = await this.classification.bestSubjectFor(top1.deptId, workingText);
      await this.prisma.grievance.update({
        where: { id: grievanceId },
        data: { aiConfidence: top1.probability, routedBy: 'AI' },
      });
      await this.classifyAndAssign(
        grievanceId,
        { deptId: top1.deptId, subjectId: subject.subjectId ?? undefined, category: subject.category },
        undefined,
        false,
      );
      return { gate: 'AUTO_ROUTED', top3, confidence: top1.probability };
    }

    // Below the gate (or disagreement) → human verification queue (§8.4).
    const g = await this.getOrThrow(grievanceId);
    this.assertTransition(g.status, Status.PENDING_VERIFICATION);
    await this.prisma.grievance.update({
      where: { id: grievanceId },
      data: { status: Status.PENDING_VERIFICATION, aiConfidence: top1?.probability ?? null },
    });
    await this.prisma.verificationTask.create({
      data: {
        grievanceId,
        suggestions: JSON.stringify(top3),
        llmHint: hintA,
        rationale: extraction.summaryEn,
        slaDeadline: new Date(Date.now() + VERIFICATION_SLA_HOURS * 60 * 60 * 1000),
      },
    });
    await this.ledger.append({
      grievanceId,
      eventType: LedgerEvent.PENDING_VERIFICATION,
      actorRole: 'AI',
      payload: { top3, llmHint: hintA, slaHours: VERIFICATION_SLA_HOURS, reason: !agree && top1 && top1.probability >= AUTO_ROUTE_GATE ? 'stage disagreement' : 'below gate' },
    });
    return { gate: 'HUMAN_VERIFICATION', top3, confidence: top1?.probability };
  }

  /** §9.2 merge semantics — the redundant report merges, never deletes. */
  private async mergeIntoCanonical(
    childId: string,
    canonicalId: string,
    meta: { similarity: number; distanceMeters: number | null; actorRole: string },
  ): Promise<{ canonicalYsr: string; reportCount: number }> {
    const canonical = await this.prisma.grievance.findUnique({ where: { id: canonicalId } });
    if (!canonical) throw new NotFoundException('Canonical grievance not found');

    await this.prisma.grievance.update({
      where: { id: childId },
      data: { status: Status.MERGED, isDuplicateOf: canonicalId },
    });

    const newCount = (canonical.reportCount ?? 1) + 1;
    // Priority ladder (§9.2): crowd volume IS severity evidence.
    let severity = canonical.severity ?? 'MEDIUM';
    let laddered = false;
    if (newCount >= 15 && severity !== 'CRITICAL') {
      severity = 'CRITICAL';
      laddered = true;
    } else if (newCount >= 5) {
      const idx = SEVERITY_ORDER.indexOf(severity as any);
      if (idx >= 0 && idx < SEVERITY_ORDER.length - 1) {
        severity = SEVERITY_ORDER[idx + 1];
        laddered = true;
      }
    }
    await this.prisma.grievance.update({
      where: { id: canonicalId },
      data: {
        reportCount: newCount,
        severity,
        priorityScore: Number((canonical.priorityScore + 0.75).toFixed(2)),
        ...(newCount >= 15 ? { emergency: true } : {}),
      },
    });

    await this.ledger.append({
      grievanceId: childId,
      eventType: LedgerEvent.DUPLICATE_MERGED,
      actorRole: meta.actorRole,
      payload: { canonical: canonical.ysr, similarity: meta.similarity, distanceMeters: meta.distanceMeters, method: meta.distanceMeters != null ? 'geo+semantic' : 'semantic' },
    });
    if (laddered) {
      await this.ledger.append({
        grievanceId: canonicalId,
        eventType: LedgerEvent.PRIORITY_RAISED,
        actorRole: 'SYSTEM',
        payload: { reportCount: newCount, severity, reason: 'duplicate-report priority ladder' },
      });
      if (newCount >= 15) {
        await this.notifications.send({
          grievanceId: canonicalId,
          to: 'duty-officer',
          template: 'CRITICAL_ALERT',
          body: `Case ${canonical.ysr} now has ${newCount} citizen reports — severity CRITICAL. Immediate attention required.`,
        });
      }
    }
    return { canonicalYsr: canonical.ysr, reportCount: newCount };
  }

  /** Unmerge escape hatch (§9.2) — re-enters the pipeline; trains the model. */
  async unmerge(id: string, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    if (g.status !== Status.MERGED || !g.isDuplicateOf) {
      throw new BadRequestException('Only a MERGED grievance can be unmerged.');
    }
    const canonical = await this.prisma.grievance.findUnique({ where: { id: g.isDuplicateOf } });
    await this.prisma.grievance.update({
      where: { id },
      data: { status: Status.REGISTERED, isDuplicateOf: null },
    });
    if (canonical) {
      await this.prisma.grievance.update({
        where: { id: canonical.id },
        data: { reportCount: Math.max(1, (canonical.reportCount ?? 1) - 1) },
      });
    }
    await this.prisma.trainingEvent.create({
      data: {
        grievanceId: id,
        aiPrediction: 'DUPLICATE',
        aiConfidence: null,
        humanLabel: 'NOT_DUPLICATE',
        source: 'UNMERGE',
      },
    });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.UNMERGED,
      actorRole: actor.role ?? 'OFFICER',
      payload: { formerCanonical: canonical?.ysr ?? null },
    });
    // Re-enter the pipeline at understanding (§2 step ⑥).
    const extraction = await this.llm.extractComplaint({ text: g.description, languageHint: g.language });
    const result = await this.triageAndRoute(id, g.descriptionEn || g.description, extraction);
    return { id, status: (await this.getOrThrow(id)).status, ...result };
  }

  // ── Human verification queue — the gate's human half (§8.4) ────────────────
  async verificationQueue(actor: AuthUser) {
    const tasks = await this.prisma.verificationTask.findMany({
      where: { status: 'PENDING' },
      orderBy: { slaDeadline: 'asc' },
    });
    const grievances = await this.prisma.grievance.findMany({
      where: { id: { in: tasks.map((t) => t.grievanceId) } },
    });
    const byId = new Map(grievances.map((g) => [g.id, g]));
    return tasks
      .map((t) => {
        const g = byId.get(t.grievanceId);
        if (!g) return null;
        return {
          taskId: t.id,
          grievanceId: g.id,
          ysr: g.ysr,
          description: g.description,
          descriptionEn: g.descriptionEn,
          summaryEn: g.summaryEn,
          summaryTe: g.summaryTe,
          severity: g.severity,
          urgency: g.urgency,
          detectedLang: g.detectedLang,
          langName: langName(g.detectedLang).en,
          mandal: g.mandal,
          village: g.village,
          suggestions: parseJson<any[]>(t.suggestions, []),
          llmHint: t.llmHint,
          rationale: t.rationale,
          slaDeadline: t.slaDeadline,
          createdAt: t.createdAt,
        };
      })
      .filter(Boolean);
  }

  async verificationDecision(grievanceId: string, dto: VerificationDecisionDto, actor: AuthUser) {
    const task = await this.prisma.verificationTask.findUnique({ where: { grievanceId } });
    if (!task || task.status !== 'PENDING') {
      throw new BadRequestException('No pending verification task for this grievance.');
    }
    const g = await this.getOrThrow(grievanceId);
    const suggestions = parseJson<{ deptId: string; probability: number }[]>(task.suggestions, []);
    const aiTop = suggestions[0];

    // Human decision → active-learning signal (§8.4).
    await this.prisma.trainingEvent.create({
      data: {
        grievanceId,
        aiPrediction: aiTop?.deptId ?? task.llmHint,
        aiConfidence: aiTop?.probability ?? null,
        humanLabel: dto.deptId,
        source: 'VERIFY',
      },
    });
    await this.prisma.verificationTask.update({
      where: { id: task.id },
      data: { status: 'DECIDED', decidedDept: dto.deptId, decidedById: actor.sub, decidedAt: new Date() },
    });
    await this.prisma.grievance.update({ where: { id: grievanceId }, data: { routedBy: 'HUMAN' } });
    await this.ledger.append({
      grievanceId,
      eventType: LedgerEvent.HUMAN_VERIFIED,
      actorRole: actor.role!,
      payload: { decidedDept: dto.deptId, aiTop: aiTop ?? null, agreedWithAi: aiTop?.deptId === dto.deptId },
    });

    const subject = dto.subjectId
      ? { subjectId: dto.subjectId, category: dto.category ?? g.category }
      : await this.classification.bestSubjectFor(dto.deptId, g.descriptionEn || g.description);
    return this.classifyAndAssign(
      grievanceId,
      { deptId: dto.deptId, subjectId: subject.subjectId ?? undefined, category: subject.category },
      actor,
      true,
    );
  }

  // ── Classification confirmation + routing ──────────────────────────────────
  async confirmClassification(id: string, dto: ConfirmClassificationDto, actor: AuthUser) {
    return this.classifyAndAssign(id, dto, actor, true);
  }

  private async classifyAndAssign(
    id: string,
    body: { deptId: string; subjectId?: string; subSubjectId?: string; category?: string },
    actor: AuthUser | undefined,
    humanConfirmed: boolean,
  ) {
    const g = await this.getOrThrow(id);
    this.assertTransition(g.status, Status.CLASSIFIED);

    const subject = body.subjectId ? await this.prisma.subject.findUnique({ where: { id: body.subjectId } }) : null;
    const classified = await this.prisma.grievance.update({
      where: { id },
      data: {
        deptId: body.deptId,
        subjectId: body.subjectId ?? null,
        subSubjectId: body.subSubjectId ?? null,
        category: body.category ?? g.category,
        status: Status.CLASSIFIED,
        routedBy: g.routedBy ?? (humanConfirmed ? 'HUMAN' : 'AI'),
      },
    });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.CLASSIFIED,
      actorRole: actor?.role ?? (humanConfirmed ? 'SYSTEM' : 'AI'),
      payload: { deptId: body.deptId, subjectId: body.subjectId ?? null, humanConfirmed },
    });

    // SLA clock starts at assignment.
    const slaHrs = subject?.defaultSlaHrs ?? 168;
    const dueAt = this.sla.computeDueAt(new Date(), slaHrs, classified.emergency);
    await this.prisma.grievance.update({ where: { id }, data: { slaDueAt: dueAt } });

    return this.assign(id, actor);
  }

  async assign(id: string, actor?: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertTransition(g.status, Status.ASSIGNED);

    const pick = await this.routing.pickOfficer({
      deptId: g.deptId,
      level: g.currentLevel,
      mandal: g.mandal,
      secretariatCode: g.secretariatCode,
    });
    if (!pick.officer) {
      throw new BadRequestException(pick.reason);
    }

    await this.prisma.assignment.create({
      data: {
        grievanceId: id,
        assigneeId: pick.officer.id,
        level: pick.level,
        assignedBy: actor?.kind === 'OFFICER' ? actor.sub : 'SYSTEM',
        reason: pick.reason,
      },
    });
    const updated = await this.prisma.grievance.update({
      where: { id },
      data: { currentAssigneeId: pick.officer.id, currentLevel: pick.level, status: Status.ASSIGNED },
    });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.ASSIGNED,
      actorRole: actor?.role ?? 'SYSTEM',
      payload: { assigneeRole: pick.officer.role, level: pick.level, reason: pick.reason, routedBy: updated.routedBy ?? null },
    });
    const officerRec = await this.prisma.officer.findUnique({ where: { id: pick.officer.id } });
    const dept = g.deptId ? await this.prisma.department.findUnique({ where: { id: g.deptId } }) : null;
    await this.notifications.send({
      grievanceId: id,
      to: 'citizen',
      template: 'ASSIGNED',
      body: `Your grievance ${g.ysr} is now with ${officerRec?.name ?? 'an officer'}${officerRec?.designation ? ` (${officerRec.designation})` : ''}${dept ? `, ${dept.nameEn}` : ''}. Track it on SAARTHI.`,
    });
    // IMMEDIATE/CRITICAL cases additionally alert the duty officer (§10.2).
    if (updated.emergency || updated.urgency === 'IMMEDIATE' || updated.severity === 'CRITICAL') {
      await this.notifications.send({
        grievanceId: id,
        to: `officer:${officerRec?.username ?? pick.officer.id}`,
        template: 'DUTY_ALERT',
        body: `CRITICAL/IMMEDIATE case ${g.ysr} assigned to you${g.mandal ? ` in ${g.mandal}` : ''}. Safety flag: ${updated.safetyFlag ? 'YES' : 'no'}.`,
      });
    }
    return { id, status: updated.status, assignee: pick.officer, reason: pick.reason };
  }

  // ── Officer actions ───────────────────────────────────────────────────────
  async accept(id: string, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertAssignee(g, actor);
    this.assertTransition(g.status, Status.UNDER_ENQUIRY);
    await this.prisma.assignment.updateMany({
      where: { grievanceId: id, assigneeId: actor.sub, acceptedAt: null },
      data: { acceptedAt: new Date() },
    });
    const updated = await this.prisma.grievance.update({ where: { id }, data: { status: Status.UNDER_ENQUIRY } });
    await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.ACCEPTED, actorRole: actor.role!, payload: { ysr: g.ysr } });
    await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.UNDER_ENQUIRY, actorRole: actor.role!, payload: { ysr: g.ysr } });
    return { id, status: updated.status };
  }

  async recordAction(id: string, dto: ActionDto, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertAssignee(g, actor);
    await this.prisma.workLog.create({
      data: {
        grievanceId: id,
        actorId: actor.sub,
        actorRole: actor.role!,
        actionType: dto.actionType,
        noteTe: dto.noteTe,
        noteEn: dto.noteEn,
        aiDrafted: dto.aiDrafted ?? false,
        evidenceIds: JSON.stringify(dto.evidenceIds ?? []),
      },
    });
    let status: StatusType = g.status as StatusType;
    if (dto.actionType === 'ACTION_TAKEN' && canTransition(g.status, Status.ACTION_TAKEN)) {
      await this.prisma.grievance.update({ where: { id }, data: { status: Status.ACTION_TAKEN } });
      status = Status.ACTION_TAKEN;
    } else if (g.status === Status.ASSIGNED && canTransition(g.status, Status.UNDER_ENQUIRY)) {
      await this.prisma.grievance.update({ where: { id }, data: { status: Status.UNDER_ENQUIRY } });
      status = Status.UNDER_ENQUIRY;
    }
    await this.ledger.append({
      grievanceId: id,
      eventType: dto.actionType === 'ACTION_TAKEN' ? LedgerEvent.ACTION_TAKEN : LedgerEvent.UNDER_ENQUIRY,
      actorRole: actor.role!,
      payload: { actionType: dto.actionType, aiDrafted: dto.aiDrafted ?? false },
    });
    return { id, status };
  }

  async resolve(id: string, dto: ResolveDto, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertAssignee(g, actor);
    if (!canTransition(g.status, Status.RESOLVED)) {
      // Allow resolving straight from UNDER_ENQUIRY by recording the action first.
      if (g.status === Status.UNDER_ENQUIRY || g.status === Status.ASSIGNED) {
        await this.prisma.grievance.update({ where: { id }, data: { status: Status.ACTION_TAKEN } });
      } else {
        this.assertTransition(g.status, Status.RESOLVED);
      }
    }
    await this.prisma.workLog.create({
      data: {
        grievanceId: id,
        actorId: actor.sub,
        actorRole: actor.role!,
        actionType: 'ACTION_TAKEN',
        noteEn: dto.resolutionNote,
        evidenceIds: JSON.stringify(dto.evidenceIds ?? []),
      },
    });
    const updated = await this.prisma.grievance.update({
      where: { id },
      data: { status: Status.RESOLVED, resolvedAt: new Date() },
    });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.RESOLVED,
      actorRole: actor.role!,
      payload: { ysr: g.ysr, note: dto.resolutionNote, evidence: (dto.evidenceIds ?? []).length },
    });
    // Plain-language, Telugu-first notification (LLM status explainer).
    const dept = g.deptId ? await this.prisma.department.findUnique({ where: { id: g.deptId } }) : null;
    const status = this.llm.plainStatus({
      status: Status.RESOLVED,
      deptNameEn: dept?.nameEn,
      deptNameTe: dept?.nameTe,
    });
    await this.notifications.send({ grievanceId: id, to: 'citizen', template: 'RESOLVED', body: status.te });
    return { id, status: updated.status, awaitingCitizenConfirmation: true };
  }

  async hold(id: string, reason: string, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertTransition(g.status, Status.ON_HOLD);
    const updated = await this.prisma.grievance.update({ where: { id }, data: { status: Status.ON_HOLD } });
    await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.ON_HOLD, actorRole: actor.role!, payload: { reason } });
    return { id, status: updated.status };
  }

  async resume(id: string, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertTransition(g.status, Status.UNDER_ENQUIRY);
    const updated = await this.prisma.grievance.update({ where: { id }, data: { status: Status.UNDER_ENQUIRY } });
    await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.RESUMED, actorRole: actor.role!, payload: {} });
    return { id, status: updated.status };
  }

  async reassign(id: string, dto: ReassignDto, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    let officer = dto.officerId ? await this.prisma.officer.findUnique({ where: { id: dto.officerId } }) : null;
    let reason = dto.reason;
    if (!officer) {
      const pick = await this.routing.pickOfficer({ deptId: g.deptId, level: g.currentLevel, mandal: g.mandal });
      if (!pick.officer) throw new BadRequestException(pick.reason);
      officer = await this.prisma.officer.findUnique({ where: { id: pick.officer.id } });
      reason = `${dto.reason} — ${pick.reason}`;
    }
    await this.prisma.assignment.create({
      data: { grievanceId: id, assigneeId: officer!.id, level: g.currentLevel, assignedBy: actor.sub, reason },
    });
    const updated = await this.prisma.grievance.update({
      where: { id },
      data: { currentAssigneeId: officer!.id, status: g.status === Status.RESOLVED ? Status.ASSIGNED : g.status },
    });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.REASSIGNED,
      actorRole: actor.role!,
      payload: { toOfficerRole: officer!.role, reason },
    });
    return { id, status: updated.status, assigneeId: officer!.id };
  }

  // ── Closure, reopen-request & quick desk review (Saarthi 2.0) ──────────────
  async citizenConfirmClosure(id: string, dto: ConfirmClosureDto) {
    const g = await this.getOrThrow(id);
    if (g.status !== Status.RESOLVED) {
      throw new BadRequestException('Closure can only be confirmed on a RESOLVED grievance.');
    }

    if (dto.satisfied) {
      // Finance grievances can't close until the benefit is actually received.
      if (g.category === Category.FINANCE && dto.benefitReceived !== true) {
        throw new BadRequestException('Finance grievance cannot be closed until benefit delivery is confirmed.');
      }
      await this.ledger.append({
        grievanceId: id,
        eventType: LedgerEvent.CITIZEN_CONFIRMED,
        actorRole: 'CITIZEN',
        payload: { ysr: g.ysr, satisfied: true, benefitReceived: dto.benefitReceived ?? null },
      });
      await this.prisma.feedback.create({
        data: { grievanceId: id, rating: dto.rating ?? 5, comment: dto.comment, channel: 'CITIZEN_CONFIRM' },
      });
      const updated = await this.prisma.grievance.update({
        where: { id },
        data: { status: Status.CLOSED, closedAt: new Date() },
      });
      await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.CLOSED, actorRole: 'CITIZEN', payload: { ysr: g.ysr } });
      await this.notifications.send({ grievanceId: id, to: 'citizen', template: 'CLOSED', body: `Grievance ${g.ysr} closed. Thank you.` });
      return { id, status: updated.status };
    }

    // Not satisfied → the reopen REQUEST path (quick desk review), never a
    // silent direct reopen. The citizen must state a reason.
    return this.reopenRequest(id, { reason: dto.comment ?? undefined });
  }

  /**
   * Citizen asks to reopen (typed or voice reason — MANDATORY). The case moves
   * to QUICK_DESK_REVIEW: a senior officer sees the complaint, the citizen's
   * background profile, the AI's explanation of WHY the citizen is reopening,
   * and the original voice reason (playable in the citizen's language) — then
   * decides. Reopen-after-approval always escalates.
   */
  async reopenRequest(idOrYsr: string, dto: ReopenRequestDto) {
    const g = await this.prisma.grievance.findFirst({ where: { OR: [{ id: idOrYsr }, { ysr: idOrYsr }] } });
    if (!g) throw new NotFoundException('Grievance not found');
    if (![Status.RESOLVED, Status.CLOSED].includes(g.status as any)) {
      throw new BadRequestException('Only a RESOLVED or CLOSED grievance can be reopened.');
    }
    const reasonText = (dto.reason ?? '').trim();
    if (!reasonText && !dto.voiceBase64) {
      throw new BadRequestException('Please tell us WHY you are reopening — type the reason or record it by voice.');
    }

    // Preserve the voice reason (original language) so the officer can hear it.
    let reasonAudioId: string | null = null;
    if (dto.voiceBase64) {
      const att = await this.attachments.add(
        g.id,
        {
          filename: `reopen-reason-${g.ysr}.${extFor(dto.voiceMime)}`,
          mime: dto.voiceMime ?? 'audio/webm',
          dataBase64: dto.voiceBase64,
        },
        'CITIZEN',
        'REOPEN_VOICE',
      );
      reasonAudioId = att.id;
      await this.ledger.append({
        grievanceId: g.id,
        eventType: LedgerEvent.VOICE_EVIDENCE_SEALED,
        actorRole: 'SYSTEM',
        payload: { ysr: g.ysr, kind: 'REOPEN_REASON', sha256: (att as any).hash, mime: dto.voiceMime ?? 'audio/webm' },
      });
    }

    const det = reasonText ? detectLanguage(reasonText) : null;
    const reasonLang = dto.lang ?? det?.lang ?? g.detectedLang ?? g.language;

    // AI quick-desk-review analysis: WHY is the citizen reopening, against the
    // resolution record and their background profile.
    const workLogs = await this.prisma.workLog.findMany({ where: { grievanceId: g.id }, orderBy: { createdAt: 'asc' } });
    const profile = await this.citizenProfile(g.petitionerId);
    const aiReview = await this.llm.analyzeReopen({
      complaintEn: g.descriptionEn || g.description,
      resolutionNotes: workLogs.filter((w) => w.noteEn).map((w) => w.noteEn!),
      reopenReason: reasonText || '(voice reason attached — listen to the recording)',
      reasonLang,
      profile,
    });

    // Route the review to a HIGHER authority than the current level.
    const reviewerPick = await this.routing.pickOfficer({
      deptId: g.deptId,
      level: Math.min(g.currentLevel + 1, 4),
      mandal: g.mandal,
    });
    const reviewer =
      reviewerPick.officer ??
      (await this.prisma.officer
        .findFirst({ where: { role: { in: [Roles.SUPERVISOR, Roles.COLLECTOR] }, active: true }, orderBy: { level: 'asc' } })
        .then((o) => (o ? { id: o.id, name: o.name, role: o.role, level: o.level, deptId: o.deptId } : null)));

    await this.prisma.reopen.create({
      data: {
        grievanceId: g.id,
        reasonTe: det?.lang === 'te' ? reasonText : null,
        reasonEn: reasonText || '(voice reason attached)',
        escalatedLevel: Math.min(g.currentLevel + 1, 4),
        channel: dto.voiceBase64 ? 'VOICE' : 'TEXT',
        reasonLang,
        reasonAudioId,
        aiReview: JSON.stringify(aiReview),
        reviewStatus: 'PENDING',
        reviewerId: reviewer?.id ?? null,
      },
    });
    this.assertTransition(g.status, Status.QUICK_DESK_REVIEW);
    await this.prisma.grievance.update({ where: { id: g.id }, data: { status: Status.QUICK_DESK_REVIEW } });
    await this.ledger.append({
      grievanceId: g.id,
      eventType: LedgerEvent.DESK_REVIEW_STARTED,
      actorRole: 'CITIZEN',
      payload: {
        ysr: g.ysr,
        reasonChannel: dto.voiceBase64 ? 'VOICE' : 'TEXT',
        reasonLang,
        aiRecommendation: aiReview.recommendation,
        reviewer: reviewer?.name ?? 'grievance cell',
      },
    });
    await this.notifications.send({
      grievanceId: g.id,
      to: 'citizen',
      template: 'DESK_REVIEW',
      body: `Your reopen request for ${g.ysr} has reached ${reviewer?.name ?? 'the grievance cell'} for a quick desk review. You will hear back soon.`,
    });
    return {
      id: g.id,
      ysr: g.ysr,
      status: Status.QUICK_DESK_REVIEW,
      reviewer: reviewer ? { name: reviewer.name, role: reviewer.role } : null,
      aiRecommendation: aiReview.recommendation,
    };
  }

  /** Desk-review queue for senior officers. */
  async deskReviewQueue(actor: AuthUser) {
    const where: any = { status: Status.QUICK_DESK_REVIEW };
    if (actor.role === Roles.OFFICER && actor.deptId) where.deptId = actor.deptId;
    const items = await this.prisma.grievance.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { department: true, petitioner: true, reopens: { orderBy: { reopenedAt: 'desc' } }, workLogs: { orderBy: { createdAt: 'asc' } } },
    });
    const out: any[] = [];
    for (const g of items) {
      const pending = g.reopens.find((r) => r.reviewStatus === 'PENDING') ?? g.reopens[0];
      if (!pending) continue;
      const profile = await this.citizenProfile(g.petitionerId);
      out.push({
        id: g.id,
        ysr: g.ysr,
        department: g.department ? { id: g.department.id, en: g.department.nameEn, te: g.department.nameTe } : null,
        severity: g.severity,
        urgency: g.urgency,
        mandal: g.mandal,
        village: g.village,
        description: g.description,
        descriptionEn: g.descriptionEn,
        summaryEn: g.summaryEn,
        resolutionNotes: g.workLogs.filter((w) => w.noteEn).map((w) => ({ note: w.noteEn, at: w.createdAt, role: w.actorRole })),
        citizen: {
          name: g.petitioner?.name,
          profile,
        },
        reopen: {
          id: pending.id,
          reason: pending.reasonEn,
          reasonTe: pending.reasonTe,
          channel: pending.channel,
          reasonLang: pending.reasonLang,
          reasonLangName: langName(pending.reasonLang),
          reasonAudioId: pending.reasonAudioId,
          requestedAt: pending.reopenedAt,
          aiReview: parseJson<any>(pending.aiReview, null),
        },
        wasClosed: !!g.closedAt,
        resolvedAt: g.resolvedAt,
        closedAt: g.closedAt,
        createdAt: g.createdAt,
      });
    }
    return out;
  }

  /** Officer decides the desk review: approve the reopen (escalates) or uphold. */
  async deskReviewDecision(id: string, dto: DeskReviewDecisionDto, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    if (g.status !== Status.QUICK_DESK_REVIEW) {
      throw new BadRequestException('This grievance is not under desk review.');
    }
    const pending = await this.prisma.reopen.findFirst({
      where: { grievanceId: id, reviewStatus: 'PENDING' },
      orderBy: { reopenedAt: 'desc' },
    });
    if (!pending) throw new BadRequestException('No pending reopen request found.');

    const officer = await this.prisma.officer.findUnique({ where: { id: actor.sub } });
    await this.prisma.reopen.update({
      where: { id: pending.id },
      data: {
        reviewStatus: dto.decision === 'REOPEN' ? 'REOPEN_APPROVED' : 'CLOSURE_UPHELD',
        reviewedById: actor.sub,
        reviewedByName: officer?.name ?? actor.role ?? 'officer',
        reviewedAt: new Date(),
        reviewNote: dto.note,
      },
    });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.DESK_REVIEW_DECIDED,
      actorRole: actor.role!,
      payload: { ysr: g.ysr, decision: dto.decision, note: dto.note },
    });

    if (dto.decision === 'REOPEN') {
      this.assertTransition(g.status, Status.REOPENED);
      await this.prisma.grievance.update({
        where: { id },
        data: { status: Status.REOPENED, closedAt: null, resolvedAt: null },
      });
      await this.ledger.append({
        grievanceId: id,
        eventType: LedgerEvent.REOPENED,
        actorRole: actor.role!,
        payload: { ysr: g.ysr, reason: pending.reasonEn, approvedBy: officer?.name ?? actor.role },
      });
      // Reopen ALWAYS escalates to a higher authority.
      const escalated = await this.sla.escalate(id, 'REOPEN');
      await this.notifications.send({
        grievanceId: id,
        to: 'citizen',
        template: 'REOPEN_APPROVED',
        body: `Your reopen request for ${g.ysr} was APPROVED by ${officer?.name ?? 'a senior officer'} and escalated to a higher authority.`,
      });
      return { id, status: escalated?.status ?? Status.REOPENED, decision: dto.decision, escalatedToLevel: escalated?.currentLevel };
    }

    // Uphold the closure — restore the pre-review state, with the reason on record.
    const restored = g.closedAt ? Status.CLOSED : Status.RESOLVED;
    this.assertTransition(g.status, restored);
    await this.prisma.grievance.update({ where: { id }, data: { status: restored } });
    await this.notifications.send({
      grievanceId: id,
      to: 'citizen',
      template: 'CLOSURE_UPHELD',
      body: `After desk review of ${g.ysr}, ${officer?.name ?? 'a senior officer'} upheld the closure: ${dto.note}. You may appeal or call 1902.`,
    });
    return { id, status: restored, decision: dto.decision };
  }

  /** Legacy direct reopen (officer/audit-initiated, e.g. bad-closure finding). */
  async reopen(id: string, dto: ReopenDto, by: 'CITIZEN' | 'OFFICER') {
    const g = await this.getOrThrow(id);
    if (![Status.RESOLVED, Status.CLOSED].includes(g.status as any)) {
      throw new BadRequestException('Only a RESOLVED or CLOSED grievance can be reopened.');
    }
    await this.prisma.reopen.create({
      data: { grievanceId: id, reasonTe: dto.reasonTe, reasonEn: dto.reasonEn, escalatedLevel: Math.min(g.currentLevel + 1, 4), reviewStatus: 'APPLIED' },
    });
    await this.prisma.grievance.update({ where: { id }, data: { status: Status.REOPENED, closedAt: null, resolvedAt: null } });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.REOPENED,
      actorRole: by,
      payload: { ysr: g.ysr, reason: dto.reasonEn ?? dto.reasonTe },
    });
    // Reopen ALWAYS escalates to a higher authority (officer can't judge own dismissal).
    const escalated = await this.sla.escalate(id, 'REOPEN');
    return { id, status: escalated?.status ?? Status.REOPENED, escalatedToLevel: escalated?.currentLevel };
  }

  /**
   * Supervisor closure without citizen confirmation — allowed ONLY with mandatory
   * evidence + justification + sign-off, and fully notarised. This is the guarded
   * exception to "no silent closure" (Blueprint E.2 / G.6).
   */
  async forceClose(id: string, dto: ForceCloseDto, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    if (g.status !== Status.RESOLVED) {
      throw new BadRequestException('Force-close is only permitted on a RESOLVED grievance.');
    }
    if (!dto.evidenceIds || dto.evidenceIds.length === 0) {
      throw new BadRequestException('Force-close requires mandatory evidence.');
    }
    if (g.category === Category.FINANCE) {
      throw new BadRequestException('Finance grievances require citizen benefit confirmation and cannot be force-closed.');
    }
    const updated = await this.prisma.grievance.update({ where: { id }, data: { status: Status.CLOSED, closedAt: new Date() } });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.CLOSED,
      actorRole: actor.role!,
      payload: { ysr: g.ysr, forced: true, supervisor: actor.role, justification: dto.justification, evidence: dto.evidenceIds.length },
    });
    return { id, status: updated.status, forced: true };
  }

  async reject(id: string, dto: RejectDto, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertTransition(g.status, Status.REJECTED);
    const updated = await this.prisma.grievance.update({ where: { id }, data: { status: Status.REJECTED } });
    await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.REJECTED, actorRole: actor.role!, payload: { reason: dto.reason } });
    return { id, status: updated.status };
  }

  async reroute(id: string, target: string, reason: string | undefined, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    this.assertTransition(g.status, Status.REROUTED);
    const updated = await this.prisma.grievance.update({ where: { id }, data: { status: Status.REROUTED } });
    await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.REROUTED, actorRole: actor.role!, payload: { target, reason } });
    return { id, status: updated.status, reroutedTo: target };
  }

  async merge(id: string, parentId: string, actor: AuthUser) {
    const g = await this.getOrThrow(id);
    const parent = await this.prisma.grievance.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Parent grievance not found');
    this.assertTransition(g.status, Status.MERGED);
    const merged = await this.mergeIntoCanonical(id, parentId, { similarity: 1, distanceMeters: null, actorRole: actor.role! });
    return { id, status: Status.MERGED, mergedInto: merged.canonicalYsr, reportCount: merged.reportCount };
  }

  // ── X-Road + LLM assist ───────────────────────────────────────────────────
  async xroadLookup(id: string, service: string, actor: AuthUser) {
    const result = await this.dataExchange.lookup({
      grievanceId: id,
      service,
      requestedByRole: actor.role!,
      requestedById: actor.sub,
    });
    await this.prisma.workLog.create({
      data: {
        grievanceId: id,
        actorId: actor.sub,
        actorRole: actor.role!,
        actionType: 'XROAD_LOOKUP',
        noteEn: `X-Road: ${result.label} = ${JSON.stringify(result.fact)} (signed, logged)`,
        evidenceIds: '[]',
      },
    });
    return result;
  }

  async draftAssist(id: string, kind: 'ACK' | 'ENQUIRY_NOTE' | 'RESOLUTION') {
    const g = await this.getFullOrThrow(id);
    const subject = g.subjectId ? await this.prisma.subject.findUnique({ where: { id: g.subjectId } }) : null;
    const facts = g.workLogs.filter((w) => w.noteEn).map((w) => w.noteEn!).slice(-3);
    return this.llm.draftAssist({ kind, subjectEn: subject?.nameEn, mandal: g.mandal, facts });
  }

  /** AI analysis: dept, root cause, actions, orders, officer briefing, X-Road
   *  suggestions + inter-department routing. Advisory only. */
  async aiAnalysis(id: string) {
    const g = await this.getOrThrow(id);
    const analysis = await this.llm.analyzeComplaint({
      text: g.description,
      descriptionEn: g.descriptionEn,
      language: g.language,
      mandal: g.mandal,
      district: g.district,
      category: g.category,
      deptHint: g.deptId,
    });
    // Persist the inter-department suggestion so it shows on the case (routing aid).
    if (analysis.interDepartments.length) {
      await this.prisma.grievance
        .update({ where: { id }, data: { interDepts: JSON.stringify(analysis.interDepartments) } })
        .catch(() => undefined);
    }
    return analysis;
  }

  // ── Saarthi Copilot (citizen assistant on the track page) ──────────────────
  async copilotAsk(dto: CopilotAskDto) {
    if (!dto.ysr) {
      return this.llm.copilotAnswer({ question: dto.question, lang: dto.lang, caseContext: null });
    }
    const g = await this.prisma.grievance.findFirst({
      where: { OR: [{ id: dto.ysr }, { ysr: dto.ysr }] },
      include: { department: true },
    });
    if (!g) return this.llm.copilotAnswer({ question: dto.question, lang: dto.lang, caseContext: null });
    const officer = await this.currentOfficer(g);
    const daysLeft = g.slaDueAt ? Math.ceil((g.slaDueAt.getTime() - Date.now()) / 86400000) : null;
    return this.llm.copilotAnswer({
      question: dto.question,
      lang: dto.lang,
      caseContext: {
        ysr: g.ysr,
        status: g.status,
        departmentEn: g.department?.nameEn,
        departmentTe: g.department?.nameTe,
        officerName: officer?.name ?? null,
        officerDesignation: officer?.designation ?? null,
        slaDueAt: g.slaDueAt,
        daysLeft,
        summaryEn: g.summaryEn ?? g.descriptionEn,
        helpline: g.department?.helpline ?? '1902',
        reportCount: g.reportCount,
      },
    });
  }

  // ── Queries ───────────────────────────────────────────────────────────────
  async publicView(idOrYsr: string) {
    let g = await this.prisma.grievance.findFirst({
      where: { OR: [{ id: idOrYsr }, { ysr: idOrYsr }] },
      include: { department: true },
    });
    if (!g) throw new NotFoundException('Grievance not found');

    // A merged report resolves to its CANONICAL case (§9.2) — honest copy, one ticket.
    let mergedFrom: { ysr: string } | null = null;
    if (g.status === Status.MERGED && g.isDuplicateOf) {
      const canonical = await this.prisma.grievance.findUnique({
        where: { id: g.isDuplicateOf },
        include: { department: true },
      });
      if (canonical) {
        mergedFrom = { ysr: g.ysr };
        g = canonical;
      }
    }

    const subject = g.subjectId ? await this.prisma.subject.findUnique({ where: { id: g.subjectId } }) : null;
    const trail = await this.ledger.grievanceTrail(g.id);
    const officer = await this.currentOfficer(g);
    const plain = this.llm.plainStatus({
      status: mergedFrom ? Status.MERGED : g.status,
      deptNameEn: g.department?.nameEn,
      deptNameTe: g.department?.nameTe,
      subjectEn: subject?.nameEn,
      officerName: officer?.name ?? null,
      slaDueAt: g.slaDueAt,
    });
    const voice = await this.prisma.attachment.findMany({
      where: { grievanceId: g.id, type: { in: ['VOICE', 'REOPEN_VOICE'] } },
      select: { id: true, type: true, mime: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const reopens = await this.prisma.reopen.findMany({ where: { grievanceId: g.id }, orderBy: { reopenedAt: 'desc' } });
    const latestReopen = reopens[0] ?? null;

    return {
      id: g.id,
      ysr: g.ysr,
      status: g.status,
      category: g.category,
      department: g.department
        ? { en: g.department.nameEn, te: g.department.nameTe, helpline: g.department.helpline ?? null }
        : null,
      subject: subject ? { en: subject.nameEn, te: subject.nameTe } : null,
      // The citizen SEES who has their case — name, designation, department.
      officer: officer ? { name: officer.name, designation: officer.designation } : null,
      routedBy: g.routedBy,
      aiConfidence: g.aiConfidence,
      severity: g.severity,
      urgency: g.urgency,
      summary: { en: g.summaryEn, te: g.summaryTe },
      language: g.detectedLang
        ? { code: g.detectedLang, confidence: g.langConfidence, codeSwitched: g.codeSwitched, ...langName(g.detectedLang) }
        : null,
      reportCount: g.reportCount,
      mergedFrom,
      location: {
        district: g.district,
        mandal: g.mandal,
        village: g.village,
        geo: g.geoLat != null ? { lat: g.geoLat, lng: g.geoLng, accuracy: g.geoAccuracy, capturedAt: g.geoCapturedAt } : null,
      },
      plainStatus: plain,
      slaDueAt: g.slaDueAt,
      slaBreachPredicted: g.slaBreachPredicted,
      emergency: g.emergency,
      currentLevel: g.currentLevel,
      createdAt: g.createdAt,
      resolvedAt: g.resolvedAt,
      closedAt: g.closedAt,
      voiceAttachments: voice,
      deskReview: latestReopen
        ? {
            status: latestReopen.reviewStatus,
            reason: latestReopen.reasonEn,
            channel: latestReopen.channel,
            requestedAt: latestReopen.reopenedAt,
            reviewedByName: latestReopen.reviewedByName,
            reviewNote: latestReopen.reviewNote,
            reviewedAt: latestReopen.reviewedAt,
          }
        : null,
      timeline: trail.map((t) => ({ event: t.eventType, role: t.actorRole, at: t.ts, txId: t.ledgerTxId })),
    };
  }

  async fullView(id: string, actor: AuthUser) {
    const g = await this.getFullOrThrow(id);
    // ABAC: officers only see grievances in their department scope (Blueprint G.1).
    if (actor.kind === 'OFFICER' && ![Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR].includes(actor.role as any)) {
      if (g.deptId && actor.deptId && g.deptId !== actor.deptId) {
        throw new ForbiddenException('Grievance is outside your department scope.');
      }
    }
    const subject = g.subjectId ? await this.prisma.subject.findUnique({ where: { id: g.subjectId } }) : null;
    const notifications = await this.notifications.listForGrievance(id);
    const xroad = await this.dataExchange.accessLog(id);
    const integrity = await this.ledger.verifyGrievance(id);
    const profile = await this.citizenProfile(g.petitionerId);
    const verification = await this.prisma.verificationTask.findUnique({ where: { grievanceId: id } });
    return {
      ...this.serializeFull(g, subject),
      citizenProfile: profile,
      verification: verification
        ? {
            status: verification.status,
            suggestions: parseJson<any[]>(verification.suggestions, []),
            llmHint: verification.llmHint,
            slaDeadline: verification.slaDeadline,
            decidedDept: verification.decidedDept,
          }
        : null,
      notifications,
      xroad,
      integrity,
    };
  }

  async listForCitizen(user: AuthUser) {
    if (user.kind !== 'CITIZEN') throw new ForbiddenException('Citizen sign-in required.');
    const items = await this.prisma.grievance.findMany({
      where: { petitionerId: user.sub },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    // Show the assigned officer on each card (citizen-visible by design).
    const officerIds = [...new Set(items.map((g) => g.currentAssigneeId).filter(Boolean))] as string[];
    const officers = officerIds.length
      ? await this.prisma.officer.findMany({ where: { id: { in: officerIds } }, select: { id: true, name: true, designation: true } })
      : [];
    const byId = new Map(officers.map((o) => [o.id, o]));
    return items.map((g) => ({
      ...this.serializeList(g),
      village: g.village,
      officer: g.currentAssigneeId ? (byId.get(g.currentAssigneeId) ?? null) : null,
      summaryEn: g.summaryEn,
      issue: g.issue,
    }));
  }

  async listForOfficer(actor: AuthUser, filters: { status?: string; slaRisk?: boolean }) {
    const where: any = { currentAssigneeId: actor.sub };
    if (filters.status) where.status = filters.status;
    if (filters.slaRisk) where.slaBreachPredicted = true;
    const items = await this.prisma.grievance.findMany({
      where,
      orderBy: [{ slaBreachPredicted: 'desc' }, { priorityScore: 'desc' }, { slaDueAt: 'asc' }],
      include: { department: true },
    });
    return items.map((g) => this.serializeList(g));
  }

  async list(actor: AuthUser, filters: { status?: string; deptId?: string; mandal?: string; slaRisk?: boolean }) {
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.deptId) where.deptId = filters.deptId;
    if (filters.mandal) where.mandal = filters.mandal;
    if (filters.slaRisk) where.slaBreachPredicted = true;
    // Supervisors see their mandal/dept; collectors/auditors see all.
    if (actor.role === Roles.OFFICER && actor.deptId) where.deptId = actor.deptId;
    const items = await this.prisma.grievance.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 500,
      include: { department: true },
    });
    return items.map((g) => this.serializeList(g));
  }

  /** Citizen background profile — desk review + officer context (no raw PII). */
  async citizenProfile(petitionerId: string): Promise<CitizenProfile> {
    const [citizen, grievances, feedback] = await Promise.all([
      this.prisma.citizen.findUnique({ where: { id: petitionerId } }),
      this.prisma.grievance.findMany({ where: { petitionerId }, select: { id: true, status: true, createdAt: true } }),
      this.prisma.feedback.findMany({
        where: { grievance: { petitionerId } },
        select: { rating: true },
      }),
    ]);
    const reopens = await this.prisma.reopen.count({ where: { grievance: { petitionerId } } });
    const resolvedOrClosed = grievances.filter((g) => ['RESOLVED', 'CLOSED'].includes(g.status)).length;
    const avgRating = feedback.length ? feedback.reduce((a, f) => a + f.rating, 0) / feedback.length : null;
    const oldest = grievances.reduce<Date | null>((min, g) => (!min || g.createdAt < min ? g.createdAt : min), null);
    const memberSinceDays = citizen
      ? Math.max(0, Math.round((Date.now() - Math.min(citizen.createdAt.getTime(), oldest?.getTime() ?? Infinity)) / 86400000))
      : 0;
    return {
      totalComplaints: grievances.length,
      resolvedOrClosed,
      reopens,
      avgRating,
      vulnerabilityFlags: parseJson<string[]>(citizen?.vulnerabilityFlags ?? '[]', []),
      memberSinceDays,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private async currentOfficer(g: { currentAssigneeId: string | null }) {
    if (!g.currentAssigneeId) return null;
    return this.prisma.officer.findUnique({
      where: { id: g.currentAssigneeId },
      select: { id: true, name: true, designation: true, role: true, level: true, username: true },
    });
  }

  private triageSummary(
    g: any,
    extraction: Awaited<ReturnType<LlmService['extractComplaint']>>,
    extra: {
      gate: 'AUTO_ROUTED' | 'HUMAN_VERIFICATION' | 'MERGED' | 'OPERATOR';
      top3?: { deptId: string; name: string; probability: number }[];
      confidence?: number;
      merged?: { canonicalYsr: string; reportCount: number };
      officer?: { name: string; designation: string | null } | null;
    },
  ) {
    const names = langName(g.detectedLang ?? extraction.language.detected);
    return {
      gate: extra.gate,
      language: {
        code: g.detectedLang ?? extraction.language.detected,
        confidence: g.langConfidence ?? extraction.language.confidence,
        codeSwitched: g.codeSwitched ?? extraction.language.codeSwitched,
        nameEn: names.en,
        nameNative: names.native,
      },
      issue: extraction.issue,
      summaryEn: extraction.summaryEn,
      summaryTe: extraction.summaryTe,
      severity: g.severity ?? extraction.severity,
      urgency: g.urgency ?? extraction.urgency,
      safetyFlag: g.safetyFlag ?? extraction.safetyFlag,
      department: g.deptId ? { id: g.deptId } : null,
      confidence: extra.confidence ?? g.aiConfidence ?? null,
      routedBy: g.routedBy ?? null,
      top3: extra.top3 ?? null,
      officer: extra.officer ? { name: extra.officer.name, designation: extra.officer.designation } : null,
      slaDueAt: g.slaDueAt ?? null,
      merged: extra.merged ?? null,
      extractionSource: extraction.source,
    };
  }

  private computePriority(input: { distress: boolean; vulnerabilityCount: number; category: string; severity?: string }): number {
    let score = 1;
    if (input.distress) score += 5;
    score += Math.min(input.vulnerabilityCount, 3) * 0.8;
    if (input.category === Category.FINANCE) score += 1.5;
    const sevIdx = SEVERITY_ORDER.indexOf((input.severity ?? 'MEDIUM') as any);
    if (sevIdx >= 0) score += sevIdx * 1.2;
    return Number(score.toFixed(2));
  }

  private async generateYsr(): Promise<string> {
    const year = 2026; // pilot reference year (deterministic; no wall-clock dependency)
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.grievance.count();
      const seq = String(count + 1 + attempt).padStart(6, '0');
      const candidate = `${TRACKING_PREFIX}-AP-${year}-${seq}`;
      const exists = await this.prisma.grievance.findUnique({ where: { ysr: candidate } });
      if (!exists) return candidate;
    }
    // Fallback: guaranteed-unique suffix.
    return `${TRACKING_PREFIX}-AP-${year}-${Date.now().toString().slice(-6)}`;
  }

  private async getOrThrow(id: string) {
    const g = await this.prisma.grievance.findUnique({ where: { id } });
    if (!g) throw new NotFoundException('Grievance not found');
    return g;
  }

  private async getFullOrThrow(id: string) {
    const g = await this.prisma.grievance.findUnique({
      where: { id },
      include: {
        department: true,
        petitioner: true,
        assignments: { orderBy: { assignedAt: 'desc' }, include: { assignee: true } },
        workLogs: { orderBy: { createdAt: 'asc' }, include: { actor: true } },
        escalations: { orderBy: { createdAt: 'asc' } },
        reopens: { orderBy: { reopenedAt: 'asc' } },
        feedback: true,
      },
    });
    if (!g) throw new NotFoundException('Grievance not found');
    return g;
  }

  private assertTransition(from: string, to: StatusType) {
    if (!canTransition(from, to)) throw new BadRequestException(new InvalidTransitionError(from, to).message);
  }

  private assertAssignee(g: { currentAssigneeId: string | null }, actor: AuthUser) {
    if (actor.role === Roles.SUPERVISOR || actor.role === Roles.COLLECTOR) return;
    if (g.currentAssigneeId !== actor.sub) {
      throw new ForbiddenException('You are not the current assignee for this grievance.');
    }
  }

  private serializeList(g: any) {
    return {
      id: g.id,
      ysr: g.ysr,
      status: g.status,
      category: g.category,
      department: g.department ? g.department.nameEn : null,
      mandal: g.mandal,
      priorityScore: g.priorityScore,
      distressFlag: g.distressFlag,
      emergency: g.emergency,
      severity: g.severity,
      urgency: g.urgency,
      reportCount: g.reportCount,
      routedBy: g.routedBy,
      detectedLang: g.detectedLang,
      slaDueAt: g.slaDueAt,
      slaBreachPredicted: g.slaBreachPredicted,
      currentLevel: g.currentLevel,
      createdAt: g.createdAt,
    };
  }

  private serializeFull(g: any, subject: any) {
    return {
      id: g.id,
      ysr: g.ysr,
      status: g.status,
      category: g.category,
      channel: g.channel,
      language: g.language,
      detectedLang: g.detectedLang,
      langConfidence: g.langConfidence,
      codeSwitched: g.codeSwitched,
      langName: langName(g.detectedLang ?? g.language),
      description: g.description,
      descriptionEn: g.descriptionEn,
      issue: g.issue,
      issueCategory: g.issueCategory,
      summaryEn: g.summaryEn,
      summaryTe: g.summaryTe,
      severity: g.severity,
      urgency: g.urgency,
      safetyFlag: g.safetyFlag,
      sentiment: g.sentiment,
      entities: parseJson<Record<string, string>>(g.entities, {}),
      interDepartments: parseJson<any[]>(g.interDepts, []),
      reportCount: g.reportCount,
      routedBy: g.routedBy,
      department: g.department ? { id: g.department.id, en: g.department.nameEn, te: g.department.nameTe, helpline: g.department.helpline ?? null } : null,
      subject: subject ? { id: subject.id, en: subject.nameEn, te: subject.nameTe } : null,
      aiSuggested: {
        deptId: g.aiSuggestedDeptId,
        subjectId: g.aiSuggestedSubjectId,
        confidence: g.aiConfidence,
      },
      priorityScore: g.priorityScore,
      distressFlag: g.distressFlag,
      emergency: g.emergency,
      mandal: g.mandal,
      secretariatCode: g.secretariatCode,
      currentLevel: g.currentLevel,
      currentAssigneeId: g.currentAssigneeId,
      slaDueAt: g.slaDueAt,
      slaBreachPredicted: g.slaBreachPredicted,
      petitioner: {
        name: g.petitioner?.name,
        coName: g.petitioner?.coName,
        gender: g.petitioner?.gender,
        dob: g.petitioner?.dob,
        mobileMasked: g.petitioner ? maskMobileShort(g.petitioner.mobile) : null,
        houseNo: g.petitioner?.houseNo,
        habitation: g.petitioner?.habitation,
        village: g.petitioner?.village,
        mandal: g.petitioner?.mandal,
        district: g.petitioner?.district,
        applicantType: g.petitioner?.applicantType,
        vulnerabilityFlags: parseJson<string[]>(g.petitioner?.vulnerabilityFlags ?? '[]', []),
      },
      location: {
        district: g.district,
        mandal: g.mandal,
        village: g.village,
        // Live location captured at submit — shown to the officer on a map.
        geo: g.geoLat != null ? { lat: g.geoLat, lng: g.geoLng, accuracy: g.geoAccuracy, capturedAt: g.geoCapturedAt } : null,
      },
      assignments: g.assignments?.map((a: any) => ({
        assignee: a.assignee?.name,
        designation: a.assignee?.designation,
        role: a.assignee?.role,
        level: a.level,
        reason: a.reason,
        assignedAt: a.assignedAt,
        acceptedAt: a.acceptedAt,
      })),
      workLogs: g.workLogs?.map((w: any) => ({
        actor: w.actor?.name ?? w.actorRole,
        role: w.actorRole,
        actionType: w.actionType,
        noteTe: w.noteTe,
        noteEn: w.noteEn,
        aiDrafted: w.aiDrafted,
        createdAt: w.createdAt,
      })),
      escalations: g.escalations,
      reopens: g.reopens?.map((r: any) => ({
        id: r.id,
        reasonEn: r.reasonEn,
        reasonTe: r.reasonTe,
        channel: r.channel,
        reasonLang: r.reasonLang,
        reasonAudioId: r.reasonAudioId,
        aiReview: parseJson<any>(r.aiReview, null),
        reviewStatus: r.reviewStatus,
        reviewedByName: r.reviewedByName,
        reviewNote: r.reviewNote,
        reviewedAt: r.reviewedAt,
        reopenedAt: r.reopenedAt,
        escalatedLevel: r.escalatedLevel,
      })),
      feedback: g.feedback,
      createdAt: g.createdAt,
      resolvedAt: g.resolvedAt,
      closedAt: g.closedAt,
    };
  }
}

function maskMobileShort(mobile: string): string {
  if (!mobile || mobile.length < 4) return '****';
  return 'XXXXXX' + mobile.slice(-4);
}

function extFor(mime?: string): string {
  if (!mime) return 'webm';
  if (mime.includes('mp4') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  return 'webm';
}
