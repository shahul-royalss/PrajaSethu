/**
 * Praja Setu — pilot seed.
 *
 * Reference data (departments, the Spandana-style subject taxonomy, officers,
 * citizens) is written directly. Sample grievances are driven through the REAL
 * GrievancesService lifecycle via a Nest application context, so every ledger
 * trail, SLA clock, dashboard aggregate and anomaly is genuine — not faked rows.
 */
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { GrievancesService } from '../src/modules/grievances/grievances.service';
import { LedgerService } from '../src/modules/ledger/ledger.service';
import { Category, Channels, Roles } from '../src/common/constants';
import { AuthUser } from '../src/common/auth/current-user.decorator';

const PILOT_MANDAL = 'Kuppam';
const NEAR_MANDAL = 'Ramakuppam';
const PASSWORD = 'Praja@123';

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function minutesAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

async function main() {
  // Quiet bootstrap; disable the background SLA sweep while we craft demo states.
  process.env.SLA_SWEEP_DISABLED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const grievances = app.get(GrievancesService);
  const log = new Logger('seed');

  // ── Wipe (FK-safe order) for idempotent re-seeding ───────────────────────
  await prisma.dataExchangeLog.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.reopen.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.workLog.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.grievance.deleteMany();
  await prisma.consentRecord.deleteMany();
  await prisma.otp.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.officer.deleteMany();
  await prisma.citizen.deleteMany();
  await prisma.department.deleteMany();

  // ── Genesis ledger block ─────────────────────────────────────────────────
  const ledger = app.get(LedgerService);
  await ledger.append({ eventType: 'GENESIS', actorRole: 'SYSTEM', payload: { system: 'praja-setu', pilot: PILOT_MANDAL } });

  // ── Departments (pilot top-5 by volume + a confidential vigilance desk) ──
  const departments = [
    { id: 'CS', nameEn: 'Civil Supplies', nameTe: 'పౌర సరఫరాలు' },
    { id: 'PEN', nameEn: 'Pensions', nameTe: 'పెన్షన్లు' },
    { id: 'ENERGY', nameEn: 'Energy (APSPDCL)', nameTe: 'విద్యుత్ (APSPDCL)' },
    { id: 'RWS', nameEn: 'Rural Water Supply', nameTe: 'గ్రామీణ నీటి సరఫరా' },
    { id: 'REVENUE', nameEn: 'Revenue (Land)', nameTe: 'రెవెన్యూ (భూమి)' },
    { id: 'VIG', nameEn: 'Vigilance / Anti-Corruption', nameTe: 'విజిలెన్స్ / అవినీతి నిరోధక' },
  ];
  for (const d of departments) {
    await prisma.department.create({ data: { ...d, slaMatrix: JSON.stringify({ 1: 168, 2: 120, 3: 72, 4: 48 }) } });
  }

  // ── Subjects (Spandana-style taxonomy) with classifier keywords ──────────
  const subjects = [
    { id: 'CS_RATION_STOPPED', deptId: 'CS', nameEn: 'Ration card stopped', nameTe: 'రేషన్ కార్డు నిలిపివేత', cat: Category.FINANCE, sla: 168, kw: ['ration', 'ration card', 'రేషన్', 'రేషన్ కార్డు', 'rice card', 'card stopped', 'card blocked'] },
    { id: 'CS_RATION_QUALITY', deptId: 'CS', nameEn: 'Ration quality issue', nameTe: 'రేషన్ నాణ్యత సమస్య', cat: Category.NON_FINANCE, sla: 120, kw: ['ration quality', 'bad rice', 'kalthi', 'కల్తీ', 'poor quality'] },
    { id: 'PEN_STOPPED', deptId: 'PEN', nameEn: 'Pension stopped / not received', nameTe: 'పెన్షన్ నిలిపివేత', cat: Category.FINANCE, sla: 168, kw: ['pension', 'పెన్షన్', 'pension stopped', 'not getting pension', 'pension not received'] },
    { id: 'ENERGY_OUTAGE', deptId: 'ENERGY', nameEn: 'Power outage / no supply', nameTe: 'విద్యుత్ అంతరాయం', cat: Category.NON_FINANCE, sla: 72, kw: ['power', 'electricity', 'కరెంటు', 'outage', 'no current', 'transformer', 'no power', 'no supply'] },
    { id: 'ENERGY_BILL', deptId: 'ENERGY', nameEn: 'Wrong / high electricity bill', nameTe: 'తప్పు విద్యుత్ బిల్లు', cat: Category.NON_FINANCE, sla: 120, kw: ['bill', 'high bill', 'wrong bill', 'బిల్లు'] },
    { id: 'RWS_BOREWELL', deptId: 'RWS', nameEn: 'Borewell / drinking water', nameTe: 'బోరు / తాగు నీరు', cat: Category.NON_FINANCE, sla: 96, kw: ['borewell', 'bore', 'బోరు', 'water', 'నీళ్లు', 'drinking water', 'hand pump', 'tap'] },
    { id: 'REVENUE_MUTATION', deptId: 'REVENUE', nameEn: 'Land mutation / record', nameTe: 'భూమి మ్యుటేషన్', cat: Category.NON_FINANCE, sla: 168, kw: ['land', 'mutation', 'భూమి', 'survey', 'patta', 'record', 'pahani'] },
    { id: 'VIG_BRIBE', deptId: 'VIG', nameEn: 'Bribe / corruption complaint', nameTe: 'లంచం / అవినీతి ఫిర్యాదు', cat: Category.NON_FINANCE, sla: 168, kw: ['bribe', 'corruption', 'లంచం', 'demanded money', 'mamool', 'మామూలు'] },
  ];
  for (const s of subjects) {
    await prisma.subject.create({
      data: { id: s.id, deptId: s.deptId, nameEn: s.nameEn, nameTe: s.nameTe, categoryHint: s.cat, defaultSlaHrs: s.sla, keywords: JSON.stringify(s.kw) },
    });
  }

  // ── Officers (mock Keycloak accounts; bcrypt-hashed passwords) ───────────
  const hash = await bcrypt.hash(PASSWORD, 10);
  const jKuppam = JSON.stringify({ mandal: PILOT_MANDAL, secretariatCodes: ['AP-KPM-021', 'AP-KPM-022'] });
  const jDistrict = JSON.stringify({});

  type OfficerSeed = { username: string; name: string; designation: string; role: string; deptId: string | null; level: number; jurisdiction: string };
  const officerSeeds: OfficerSeed[] = [
    { username: 'da1', name: 'Lakshmi', designation: 'Digital Assistant (Sachivalayam)', role: Roles.DA, deptId: null, level: 1, jurisdiction: jKuppam },
    { username: 'cs.officer', name: 'K. Srinivas', designation: 'Tahsildar — Civil Supplies', role: Roles.OFFICER, deptId: 'CS', level: 2, jurisdiction: jKuppam },
    { username: 'vro', name: 'M. Ramana', designation: 'Village Revenue Officer (VRO)', role: Roles.OFFICER, deptId: 'REVENUE', level: 1, jurisdiction: jKuppam },
    { username: 'rev.officer', name: 'P. Anitha', designation: 'Revenue Inspector (RI)', role: Roles.OFFICER, deptId: 'REVENUE', level: 1, jurisdiction: jKuppam },
    { username: 'rdo', name: 'S. Bhaskar', designation: 'Revenue Divisional Officer (RDO)', role: Roles.SUPERVISOR, deptId: 'REVENUE', level: 3, jurisdiction: jDistrict },
    { username: 'pen.officer', name: 'G. Padma', designation: 'Welfare & Education Assistant (WEA)', role: Roles.OFFICER, deptId: 'PEN', level: 1, jurisdiction: jKuppam },
    { username: 'energy.officer', name: 'T. Naresh', designation: 'Assistant Engineer (APSPDCL)', role: Roles.OFFICER, deptId: 'ENERGY', level: 1, jurisdiction: jKuppam },
    { username: 'energy.officer2', name: 'V. Rao', designation: 'Deputy Engineer (APSPDCL)', role: Roles.OFFICER, deptId: 'ENERGY', level: 2, jurisdiction: jDistrict },
    { username: 'rws.officer', name: 'B. Kiran', designation: 'Panchayat Secretary / AE (Rural Water)', role: Roles.OFFICER, deptId: 'RWS', level: 1, jurisdiction: jKuppam },
    { username: 'ee.rws', name: 'D. Sudha', designation: 'Executive Engineer (Rural Water)', role: Roles.SUPERVISOR, deptId: 'RWS', level: 3, jurisdiction: jDistrict },
    { username: 'cs.officer2', name: 'R. Latha', designation: 'Deputy Tahsildar — Civil Supplies', role: Roles.OFFICER, deptId: 'CS', level: 3, jurisdiction: jDistrict },
    { username: 'vig.officer', name: 'A. Khan', designation: 'Vigilance & Enforcement Officer', role: Roles.OFFICER, deptId: 'VIG', level: 2, jurisdiction: jDistrict },
    { username: 'mpdo', name: 'N. Sailaja', designation: 'Mandal Parishad Development Officer (MPDO)', role: Roles.SUPERVISOR, deptId: null, level: 2, jurisdiction: jKuppam },
    { username: 'supervisor', name: 'Mandal Grievance Cell', designation: 'Mandal Grievance Cell', role: Roles.SUPERVISOR, deptId: null, level: 2, jurisdiction: jKuppam },
    { username: 'joint.collector', name: 'Smt. Rao', designation: 'Joint Collector', role: Roles.COLLECTOR, deptId: null, level: 4, jurisdiction: jDistrict },
    { username: 'collector', name: 'Sri Kumar IAS', designation: 'District Collector', role: Roles.COLLECTOR, deptId: null, level: 4, jurisdiction: jDistrict },
    { username: 'auditor', name: 'Audit Cell', designation: 'District Audit Officer', role: Roles.AUDITOR, deptId: null, level: 3, jurisdiction: jDistrict },
  ];
  const officersByUsername: Record<string, string> = {};
  for (const o of officerSeeds) {
    const created = await prisma.officer.create({
      data: {
        username: o.username,
        passwordHash: hash,
        name: o.name,
        role: o.role,
        designation: o.designation,
        deptId: o.deptId,
        level: o.level,
        jurisdiction: o.jurisdiction,
        iamSubject: `keycloak:${o.username}`,
      },
    });
    officersByUsername[o.username] = created.id;
  }

  // Helper: act as the grievance's current assignee.
  async function assignee(grievanceId: string): Promise<AuthUser> {
    const g = await prisma.grievance.findUnique({ where: { id: grievanceId } });
    const o = await prisma.officer.findUnique({ where: { id: g!.currentAssigneeId! } });
    return { sub: o!.id, kind: 'OFFICER', role: o!.role, deptId: o!.deptId, level: o!.level };
  }
  const supervisor: AuthUser = { sub: officersByUsername['supervisor'], kind: 'OFFICER', role: Roles.SUPERVISOR, deptId: null, level: 2 };

  // Helper: file a grievance (operator-confirmed dept → straight to ASSIGNED).
  async function file(input: {
    channel: string; mobile: string; name: string; description: string;
    deptId: string; subjectId: string; category: string; mandal: string; secretariatCode?: string;
    aadhaar?: string; vulnerabilityFlags?: string[];
  }) {
    const res = await grievances.create(
      {
        channel: input.channel as any,
        language: 'te',
        description: input.description,
        mobile: input.mobile,
        name: input.name,
        aadhaar: input.aadhaar,
        district: 'Chittoor',
        grievanceDistrict: 'Chittoor',
        mandal: input.mandal,
        applicantType: 'INDIVIDUAL',
        secretariatCode: input.secretariatCode ?? 'AP-KPM-021',
        deptId: input.deptId,
        subjectId: input.subjectId,
        category: input.category,
        consent: true,
        consentScope: [],
        vulnerabilityFlags: input.vulnerabilityFlags,
      } as any,
      undefined,
    );
    return res.id;
  }

  // ── Sample grievances driven through the real lifecycle ──────────────────
  // Hotspot: 3 borewell complaints in Kuppam (RWS) — feeds command-centre clustering.
  const g1 = await file({ channel: Channels.SACHIVALAYAM_ASSISTED, mobile: '9876500001', name: 'Ramana', description: 'మా ఊరి బోరు పని చేయట్లేదు, తాగు నీళ్లకు ఇబ్బంది (borewell not working, drinking water problem)', deptId: 'RWS', subjectId: 'RWS_BOREWELL', category: Category.NON_FINANCE, mandal: PILOT_MANDAL });
  const g2 = await file({ channel: Channels.IVR, mobile: '9876500002', name: 'Sita', description: 'Borewell hand pump broken in our hamlet, no drinking water for 5 days', deptId: 'RWS', subjectId: 'RWS_BOREWELL', category: Category.NON_FINANCE, mandal: PILOT_MANDAL });
  const g3 = await file({ channel: Channels.WHATSAPP, mobile: '9876500003', name: 'Anil', description: 'బోరు repair కావాలి, నీళ్లు రావట్లేదు borewell water not coming', deptId: 'RWS', subjectId: 'RWS_BOREWELL', category: Category.NON_FINANCE, mandal: PILOT_MANDAL });

  // G1 → under enquiry (officer accepted + started enquiry).
  {
    const a = await assignee(g1);
    await grievances.accept(g1, a);
    await grievances.recordAction(g1, { actionType: 'ENQUIRY', noteEn: 'Visited site; ~40 households affected, motor burnt.' }, a);
  }
  // G3 → accepted only.
  await grievances.accept(g3, await assignee(g3));

  // G4 — Pension (FINANCE) full happy path → citizen-confirmed CLOSED with feedback.
  const g4 = await file({ channel: Channels.SACHIVALAYAM_ASSISTED, mobile: '9876500004', name: 'Subbamma', description: 'నా పెన్షన్ ఆగిపోయింది, మూడు నెలలుగా రాలేదు (my pension stopped, not received for 3 months)', deptId: 'PEN', subjectId: 'PEN_STOPPED', category: Category.FINANCE, mandal: PILOT_MANDAL, aadhaar: '234523452345', vulnerabilityFlags: ['ELDERLY'] });
  {
    const a = await assignee(g4);
    await grievances.accept(g4, a);
    await grievances.recordAction(g4, { actionType: 'ACTION_TAKEN', noteEn: 'eKYC re-verified, pension reinstated from this month.', evidenceIds: ['ev-pension-1'] }, a);
    await grievances.resolve(g4, { resolutionNote: 'Pension reinstated and arrears released.', evidenceIds: ['ev-pension-1'] }, a);
    await grievances.citizenConfirmClosure(g4, { satisfied: true, benefitReceived: true, rating: 5, comment: 'Thank you, pension restored.' });
  }

  // G5 — Power (ENERGY) resolved suspiciously fast with NO evidence → audit anomaly.
  const g5 = await file({ channel: Channels.CALL_1902, mobile: '9876500005', name: 'Mohan', description: 'No power supply since morning, transformer issue కరెంటు లేదు', deptId: 'ENERGY', subjectId: 'ENERGY_OUTAGE', category: Category.NON_FINANCE, mandal: NEAR_MANDAL, secretariatCode: 'AP-RMK-005' });
  {
    const a = await assignee(g5);
    await grievances.accept(g5, a);
    await grievances.resolve(g5, { resolutionNote: 'Closed.', evidenceIds: [] }, a);
  }

  // G6 — Ration (FINANCE) resolved, awaiting citizen confirmation (with evidence).
  const g6 = await file({ channel: Channels.SACHIVALAYAM_ASSISTED, mobile: '9876500006', name: 'Fatima', description: 'రేషన్ కార్డు stopped, బియ్యం రావట్లేదు ration card blocked', deptId: 'CS', subjectId: 'CS_RATION_STOPPED', category: Category.FINANCE, mandal: PILOT_MANDAL });
  {
    const a = await assignee(g6);
    await grievances.accept(g6, a);
    await grievances.recordAction(g6, { actionType: 'ACTION_TAKEN', noteEn: 'Card unblocked after Aadhaar seeding.', evidenceIds: ['ev-ration-1'] }, a);
    await grievances.resolve(g6, { resolutionNote: 'Ration card reactivated.', evidenceIds: ['ev-ration-1'] }, a);
  }

  // G7 — Land mutation (REVENUE), OVERDUE (SLA in the past) → live sweep will escalate.
  const g7 = await file({ channel: Channels.WEB, mobile: '9876500007', name: 'Govind', description: 'భూమి mutation pending, survey number 123/4A land record not updated', deptId: 'REVENUE', subjectId: 'REVENUE_MUTATION', category: Category.NON_FINANCE, mandal: PILOT_MANDAL });
  await grievances.accept(g7, await assignee(g7));

  // G8 — High bill (ENERGY) predicted to breach SLA (workbench ⚠pred flag).
  const g8 = await file({ channel: Channels.CITIZEN_APP, mobile: '9876500008', name: 'Prasad', description: 'Wrong high electricity bill received this month తప్పు బిల్లు', deptId: 'ENERGY', subjectId: 'ENERGY_BILL', category: Category.NON_FINANCE, mandal: NEAR_MANDAL, secretariatCode: 'AP-RMK-005' });

  // G9 — Emergency lane: distress keywords → ~24h SLA, prioritised.
  const g9 = await file({ channel: Channels.CALL_1902, mobile: '9876500009', name: 'Kumar', description: 'Borewell pit open near school, child fell in danger emergency! ప్రమాదం', deptId: 'RWS', subjectId: 'RWS_BOREWELL', category: Category.NON_FINANCE, mandal: PILOT_MANDAL });

  // G10 — Confidential corruption complaint → masked audit queue.
  const g10 = await file({ channel: Channels.SACHIVALAYAM_ASSISTED, mobile: '9876500010', name: 'Anonymous', description: 'Official demanded bribe లంచం to process my application, corruption', deptId: 'VIG', subjectId: 'VIG_BRIBE', category: Category.NON_FINANCE, mandal: PILOT_MANDAL });

  // G11 — Reopen path: resolved → citizen NOT satisfied → reopened + escalated to L2.
  const g11 = await file({ channel: Channels.SACHIVALAYAM_ASSISTED, mobile: '9876500011', name: 'Venkat', description: 'Ration rice poor quality కల్తీ బియ్యం bad quality', deptId: 'CS', subjectId: 'CS_RATION_QUALITY', category: Category.NON_FINANCE, mandal: PILOT_MANDAL });
  {
    const a = await assignee(g11);
    await grievances.accept(g11, a);
    await grievances.resolve(g11, { resolutionNote: 'Replaced stock at FPS.', evidenceIds: ['ev-q1'] }, a);
    await grievances.citizenConfirmClosure(g11, { satisfied: false, comment: 'Still receiving poor quality rice.' });
  }

  // G12 — A second pension closed earlier, for satisfaction/SLA-compliance stats.
  const g12 = await file({ channel: Channels.SACHIVALAYAM_ASSISTED, mobile: '9876500012', name: 'Rajamma', description: 'పెన్షన్ amount short credited pension partial', deptId: 'PEN', subjectId: 'PEN_STOPPED', category: Category.FINANCE, mandal: PILOT_MANDAL, vulnerabilityFlags: ['ELDERLY', 'WIDOW'] });
  {
    const a = await assignee(g12);
    await grievances.accept(g12, a);
    await grievances.recordAction(g12, { actionType: 'ACTION_TAKEN', noteEn: 'Shortfall corrected.', evidenceIds: ['ev-p2'] }, a);
    await grievances.resolve(g12, { resolutionNote: 'Balance credited.', evidenceIds: ['ev-p2'] }, a);
    await grievances.citizenConfirmClosure(g12, { satisfied: true, benefitReceived: true, rating: 4 });
  }

  // ── Backdate timestamps for realistic durations & SLA states ─────────────
  // Spread creation over the last ~12 days.
  await backdate(prisma, g1, { created: daysAgo(2) });
  await backdate(prisma, g2, { created: daysAgo(2) });
  await backdate(prisma, g3, { created: daysAgo(1) });
  // G4 closed after ~3 days (legitimate duration, not an anomaly).
  await backdate(prisma, g4, { created: daysAgo(9), assigned: daysAgo(9), resolved: daysAgo(6), closed: daysAgo(5) });
  // G5 fast closure: resolved ~2 min after assignment, no evidence (anomaly lead).
  await backdate(prisma, g5, { created: minutesAgo(10), assigned: minutesAgo(9), resolved: minutesAgo(7) });
  // G6 resolved ~2 days after assignment (legitimate), awaiting confirmation.
  await backdate(prisma, g6, { created: daysAgo(4), assigned: daysAgo(4), resolved: daysAgo(2) });
  // G7 overdue: SLA due in the past.
  await prisma.grievance.update({ where: { id: g7 }, data: { createdAt: daysAgo(10), registeredAt: daysAgo(10), slaDueAt: daysAgo(1) } });
  // G8 predicted breach: 85% of the window elapsed.
  await prisma.grievance.update({ where: { id: g8 }, data: { createdAt: daysAgo(4), registeredAt: daysAgo(4), slaDueAt: new Date(Date.now() + 12 * 60 * 60 * 1000), slaBreachPredicted: true } });
  await backdate(prisma, g11, { created: daysAgo(7), assigned: daysAgo(7), resolved: daysAgo(4) });
  await backdate(prisma, g12, { created: daysAgo(8), assigned: daysAgo(8), resolved: daysAgo(5), closed: daysAgo(4) });

  const counts = {
    departments: await prisma.department.count(),
    subjects: await prisma.subject.count(),
    officers: await prisma.officer.count(),
    citizens: await prisma.citizen.count(),
    grievances: await prisma.grievance.count(),
    ledgerEvents: await prisma.auditEvent.count(),
  };
  log.log(`Seed complete: ${JSON.stringify(counts)}`);
  log.log(`Logins (password "${PASSWORD}"): da1, cs.officer, rws.officer, supervisor, collector, auditor`);

  await app.close();
}

async function backdate(
  prisma: PrismaService,
  grievanceId: string,
  t: { created?: Date; assigned?: Date; resolved?: Date; closed?: Date },
) {
  const data: any = {};
  if (t.created) {
    data.createdAt = t.created;
    data.registeredAt = t.created;
  }
  if (t.resolved) data.resolvedAt = t.resolved;
  if (t.closed) data.closedAt = t.closed;
  if (Object.keys(data).length) await prisma.grievance.update({ where: { id: grievanceId }, data });
  if (t.assigned) {
    await prisma.assignment.updateMany({ where: { grievanceId }, data: { assignedAt: t.assigned } });
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
