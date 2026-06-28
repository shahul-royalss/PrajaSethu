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
import { LlmService } from '../llm/llm.service';
import { DataExchangeService } from '../dataexchange/dataexchange.service';
import { AuthUser } from '../../common/auth/current-user.decorator';
import { canTransition, InvalidTransitionError } from '../../common/state-machine';
import { Category, LedgerEvent, Roles, Status, StatusType } from '../../common/constants';
import { parseJson } from '../../common/util';
import {
  ActionDto,
  ConfirmClassificationDto,
  ConfirmClosureDto,
  CreateGrievanceDto,
  ForceCloseDto,
  ReassignDto,
  RejectDto,
  ReopenDto,
  ResolveDto,
} from './grievances.dto';

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
  ) {}

  // ── Intake (Blueprint H.2.1, Appendix A) ──────────────────────────────────
  async create(dto: CreateGrievanceDto, actor?: AuthUser) {
    // 1) Voice → text via Bhashini ASR if a blob ref was supplied.
    let description = dto.description?.trim() ?? '';
    let voiceTranscript: string | null = null;
    if (!description && dto.voiceInputRef) {
      const asr = await this.bhashini.asr(dto.voiceInputRef, dto.language ?? 'te');
      description = asr.transcript;
      voiceTranscript = asr.transcript;
    }
    if (!description) {
      throw new BadRequestException('A description (typed) or voiceInputRef (spoken) is required.');
    }

    // 2) Telugu → English gist for officers/analytics.
    const language = dto.language ?? 'te';
    const descriptionEn = language === 'te' ? (await this.bhashini.nmt(description, 'te', 'en')).text : description;

    // 3) Resolve / create the petitioner (Aadhaar tokenised, never raw).
    const citizen = await this.identity.resolveCitizen({
      aadhaar: dto.aadhaar,
      mobile: dto.mobile,
      name: dto.name,
      mandal: dto.mandal,
      secretariatCode: dto.secretariatCode,
      languagePref: language,
      vulnerabilityFlags: dto.vulnerabilityFlags,
    });

    // 4) NLP: classify (suggestion), distress, dedup.
    const [suggestion, distress, duplicate] = await Promise.all([
      this.classification.classify(description),
      Promise.resolve(this.classification.detectDistress(description)),
      this.classification.findDuplicate(description, { mandal: dto.mandal ?? citizen.mandal }),
    ]);

    // 5) Priority score (severity + vulnerability + finance + distress) — ordering only.
    const vulnerability = parseJson<string[]>(citizen.vulnerabilityFlags, []);
    const category = dto.category ?? suggestion.category ?? Category.NON_FINANCE;
    const priorityScore = this.computePriority({
      distress: distress.distress,
      vulnerabilityCount: vulnerability.length,
      category,
    });

    // 6) Persist as REGISTERED with a unique YSR code.
    const ysr = await this.generateYsr();
    const grievance = await this.prisma.grievance.create({
      data: {
        ysr,
        petitionerId: citizen.id,
        channel: dto.channel,
        language,
        description,
        descriptionEn,
        voiceInputRef: dto.voiceInputRef,
        aiSuggestedDeptId: suggestion.deptId,
        aiSuggestedSubjectId: suggestion.subjectId,
        aiConfidence: suggestion.confidence,
        category,
        distressFlag: distress.distress,
        emergency: distress.emergency,
        priorityScore,
        geoLat: dto.geoLat,
        geoLng: dto.geoLng,
        mandal: dto.mandal ?? citizen.mandal,
        secretariatCode: dto.secretariatCode ?? citizen.secretariatCode,
        status: Status.REGISTERED,
        currentLevel: 1,
        registeredAt: new Date(),
      },
    });

    // 7) Assisted path: record citizen consent (lawful basis + X-Road gate).
    if (dto.consent) {
      await this.consent.grant({
        petitionerId: citizen.id,
        purpose: `grievance:${ysr}`,
        scope: dto.consentScope ?? [],
        grantedBy: actor?.kind === 'OFFICER' ? 'DA' : 'SELF',
        daId: actor?.kind === 'OFFICER' ? actor.sub : null,
      });
    }

    // 8) Acknowledge (SMS) + notarise REGISTERED.
    await this.notifications.send({
      grievanceId: grievance.id,
      to: citizen.mobile,
      template: 'ACK',
      body: `Your grievance is registered. Tracking ID ${ysr}. Track at praja-setu / call 1902.`,
    });
    await this.ledger.append({
      grievanceId: grievance.id,
      eventType: LedgerEvent.REGISTERED,
      actorRole: actor?.role ?? 'CITIZEN',
      payload: { ysr, channel: dto.channel, category, distress: distress.distress },
    });

    // 9) If the operator confirmed a department, classify + assign immediately.
    let assigned = false;
    if (dto.deptId) {
      await this.classifyAndAssign(
        grievance.id,
        { deptId: dto.deptId, subjectId: dto.subjectId, subSubjectId: dto.subSubjectId, category },
        actor,
        true,
      );
      assigned = true;
    }

    return {
      id: grievance.id,
      ysr,
      status: assigned ? Status.ASSIGNED : Status.REGISTERED,
      aiSuggested: {
        deptId: suggestion.deptId,
        subjectId: suggestion.subjectId,
        subSubjectId: suggestion.subSubjectId,
        category: suggestion.category,
        confidence: suggestion.confidence,
        rationale: suggestion.rationale,
      },
      distress,
      duplicate,
      voiceTranscript,
      smsSent: true,
    };
  }

  // ── Classification confirmation + routing (Blueprint H.2.2) ────────────────
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
      },
    });
    await this.ledger.append({
      grievanceId: id,
      eventType: LedgerEvent.CLASSIFIED,
      actorRole: actor?.role ?? 'SYSTEM',
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
      payload: { assigneeRole: pick.officer.role, level: pick.level, reason: pick.reason },
    });
    await this.notifications.send({
      grievanceId: id,
      to: 'citizen',
      template: 'ASSIGNED',
      body: `Your grievance ${g.ysr} has been assigned to an officer.`,
    });
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

  // ── Closure & reopen (anti-gaming rules — Blueprint E.2, G.6) ──────────────
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

    // Not satisfied → reopen to a higher authority.
    return this.reopen(id, { reasonTe: dto.comment ?? 'పౌరుడు సంతృప్తి చెందలేదు', reasonEn: dto.comment }, 'CITIZEN');
  }

  async reopen(id: string, dto: ReopenDto, by: 'CITIZEN' | 'OFFICER') {
    const g = await this.getOrThrow(id);
    if (![Status.RESOLVED, Status.CLOSED].includes(g.status as any)) {
      throw new BadRequestException('Only a RESOLVED or CLOSED grievance can be reopened.');
    }
    await this.prisma.reopen.create({
      data: { grievanceId: id, reasonTe: dto.reasonTe, reasonEn: dto.reasonEn, escalatedLevel: Math.min(g.currentLevel + 1, 4) },
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
    const updated = await this.prisma.grievance.update({ where: { id }, data: { status: Status.MERGED, isDuplicateOf: parentId } });
    await this.ledger.append({ grievanceId: id, eventType: LedgerEvent.MERGED, actorRole: actor.role!, payload: { parent: parent.ysr } });
    return { id, status: updated.status, mergedInto: parent.ysr };
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

  // ── Queries ───────────────────────────────────────────────────────────────
  async publicView(idOrYsr: string) {
    const g = await this.prisma.grievance.findFirst({
      where: { OR: [{ id: idOrYsr }, { ysr: idOrYsr }] },
      include: { department: true },
    });
    if (!g) throw new NotFoundException('Grievance not found');
    const subject = g.subjectId ? await this.prisma.subject.findUnique({ where: { id: g.subjectId } }) : null;
    const trail = await this.ledger.grievanceTrail(g.id);
    const plain = this.llm.plainStatus({
      status: g.status,
      deptNameEn: g.department?.nameEn,
      deptNameTe: g.department?.nameTe,
      subjectEn: subject?.nameEn,
      slaDueAt: g.slaDueAt,
    });
    return {
      id: g.id,
      ysr: g.ysr,
      status: g.status,
      category: g.category,
      department: g.department ? { en: g.department.nameEn, te: g.department.nameTe } : null,
      subject: subject ? { en: subject.nameEn, te: subject.nameTe } : null,
      plainStatus: plain,
      slaDueAt: g.slaDueAt,
      slaBreachPredicted: g.slaBreachPredicted,
      emergency: g.emergency,
      currentLevel: g.currentLevel,
      createdAt: g.createdAt,
      resolvedAt: g.resolvedAt,
      closedAt: g.closedAt,
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
    return {
      ...this.serializeFull(g, subject),
      notifications,
      xroad,
      integrity,
    };
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

  // ── Helpers ───────────────────────────────────────────────────────────────
  private computePriority(input: { distress: boolean; vulnerabilityCount: number; category: string }): number {
    let score = 1;
    if (input.distress) score += 5;
    score += Math.min(input.vulnerabilityCount, 3) * 0.8;
    if (input.category === Category.FINANCE) score += 1.5;
    return Number(score.toFixed(2));
  }

  private async generateYsr(): Promise<string> {
    const year = 2026; // pilot reference year (deterministic; no wall-clock dependency)
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.prisma.grievance.count();
      const seq = String(count + 1 + attempt).padStart(6, '0');
      const candidate = `YSR-AP-${year}-${seq}`;
      const exists = await this.prisma.grievance.findUnique({ where: { ysr: candidate } });
      if (!exists) return candidate;
    }
    // Fallback: guaranteed-unique suffix.
    return `YSR-AP-${year}-${Date.now().toString().slice(-6)}`;
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
        attachments: true,
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
      description: g.description,
      descriptionEn: g.descriptionEn,
      department: g.department ? { id: g.department.id, en: g.department.nameEn, te: g.department.nameTe } : null,
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
        mobileMasked: g.petitioner ? maskMobileShort(g.petitioner.mobile) : null,
        mandal: g.petitioner?.mandal,
        vulnerabilityFlags: parseJson<string[]>(g.petitioner?.vulnerabilityFlags ?? '[]', []),
      },
      assignments: g.assignments?.map((a: any) => ({
        assignee: a.assignee?.name,
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
      reopens: g.reopens,
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
