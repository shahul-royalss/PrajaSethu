/**
 * Idempotent platform baseline — departments, subjects and officers that must
 * exist for the always-route classifier to have somewhere to send every kind
 * of complaint. Applied by ensure-baseline.ts on EVERY container start
 * (upserts only, no deletes), so an existing production database gains new
 * departments on redeploy without reseeding or losing data. seed.ts calls the
 * same definitions after its demo seed, keeping fresh and existing databases
 * identical in shape.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const SLA_MATRIX = JSON.stringify({ 1: 168, 2: 120, 3: 72, 4: 48 });
const OFFICER_PASSWORD = 'Praja@123'; // pilot demo credential, same as seed.ts

export const BASELINE_DEPARTMENTS = [
  // The original nine (seeded on fresh databases; upserted here for existing ones).
  { id: 'CS', nameEn: 'Civil Supplies', nameTe: 'పౌర సరఫరాలు', helpline: '1967' },
  { id: 'PEN', nameEn: 'Pensions', nameTe: 'పెన్షన్లు', helpline: '14567' },
  { id: 'ENERGY', nameEn: 'Energy (APSPDCL)', nameTe: 'విద్యుత్ (APSPDCL)', helpline: '1912' },
  { id: 'RWS', nameEn: 'Rural Water Supply', nameTe: 'గ్రామీణ నీటి సరఫరా', helpline: '1916' },
  { id: 'REVENUE', nameEn: 'Revenue (Land)', nameTe: 'రెవెన్యూ (భూమి)', helpline: '1100' },
  { id: 'PR', nameEn: 'Panchayat Raj (Streetlights & Sanitation)', nameTe: 'పంచాయతీ రాజ్ (వీధి దీపాలు & పారిశుధ్యం)', helpline: '1100' },
  { id: 'RB', nameEn: 'Roads & Buildings', nameTe: 'రహదారులు & భవనాలు', helpline: '1100' },
  { id: 'HEALTH', nameEn: 'Health & Family Welfare', nameTe: 'వైద్య ఆరోగ్య శాఖ', helpline: '104' },
  { id: 'VIG', nameEn: 'Vigilance / Anti-Corruption', nameTe: 'విజిలెన్స్ / అవినీతి నిరోధక', helpline: '14400' },
  // The six that complete the taxonomy — every KB department is now routable.
  { id: 'MA', nameEn: 'Municipal Administration', nameTe: 'పురపాలక శాఖ', helpline: '1100' },
  { id: 'EDU', nameEn: 'School Education', nameTe: 'పాఠశాల విద్య', helpline: '14417' },
  { id: 'AGRI', nameEn: 'Agriculture & Allied', nameTe: 'వ్యవసాయ శాఖ', helpline: '1907' },
  { id: 'POLICE', nameEn: 'Police / Law & Order', nameTe: 'పోలీసు శాఖ', helpline: '112' },
  { id: 'TRANSPORT', nameEn: 'Transport (RTA / RTC)', nameTe: 'రవాణా శాఖ', helpline: '1800-425-2977' },
  { id: 'HOUSING', nameEn: 'Housing', nameTe: 'గృహ నిర్మాణ శాఖ', helpline: '1100' },
];

export const BASELINE_SUBJECTS = [
  { id: 'MA_TAX', deptId: 'MA', nameEn: 'Property / water tax issue', nameTe: 'ఆస్తి / నీటి పన్ను సమస్య', cat: 'NON_FINANCE', sla: 168, kw: ['property tax', 'water tax', 'house tax', 'municipal tax', 'ఆస్తి పన్ను'] },
  { id: 'MA_WARD', deptId: 'MA', nameEn: 'Ward sanitation / sewerage', nameTe: 'వార్డు పారిశుధ్యం / మురుగు', cat: 'NON_FINANCE', sla: 96, kw: ['manhole', 'sewerage', 'sewer', 'ward', 'municipal', 'మున్సిపల్'] },
  { id: 'EDU_SCHOOL', deptId: 'EDU', nameEn: 'School staffing & facilities', nameTe: 'పాఠశాల సిబ్బంది & సౌకర్యాలు', cat: 'NON_FINANCE', sla: 168, kw: ['school', 'teacher', 'classroom', 'పాఠశాల', 'బడి', 'ఉపాధ్యాయ'] },
  { id: 'EDU_BENEFIT', deptId: 'EDU', nameEn: 'Scholarship / Amma Vodi / meals', nameTe: 'స్కాలర్‌షిప్ / అమ్మ ఒడి / భోజనం', cat: 'FINANCE', sla: 168, kw: ['scholarship', 'amma vodi', 'mid day meal', 'మధ్యాహ్న భోజనం'] },
  { id: 'AGRI_BENEFIT', deptId: 'AGRI', nameEn: 'Rythu Bharosa / insurance / subsidy', nameTe: 'రైతు భరోసా / బీమా / సబ్సిడీ', cat: 'FINANCE', sla: 360, kw: ['rythu bharosa', 'crop insurance', 'pm kisan', 'input subsidy', 'రైతు భరోసా'] },
  { id: 'AGRI_INPUT', deptId: 'AGRI', nameEn: 'Seeds / fertilizer / procurement', nameTe: 'విత్తనాలు / ఎరువులు / కొనుగోలు', cat: 'NON_FINANCE', sla: 120, kw: ['seed', 'fertilizer', 'urea', 'procurement', 'విత్తనం', 'ఎరువు'] },
  { id: 'POLICE_FIR', deptId: 'POLICE', nameEn: 'FIR / no action on complaint', nameTe: 'ఎఫ్‌ఐఆర్ / చర్య లేదు', cat: 'NON_FINANCE', sla: 168, kw: ['fir', 'police', 'theft', 'పోలీసు', 'దొంగతనం'] },
  { id: 'POLICE_SAFETY', deptId: 'POLICE', nameEn: 'Harassment / safety / patrolling', nameTe: 'వేధింపు / భద్రత / గస్తీ', cat: 'NON_FINANCE', sla: 72, kw: ['harassment', 'women safety', 'eve teasing', 'patrolling', 'వేధింపు', 'గస్తీ'] },
  { id: 'TRANSPORT_RTA', deptId: 'TRANSPORT', nameEn: 'Licence / RC / permit', nameTe: 'లైసెన్స్ / ఆర్‌సీ / పర్మిట్', cat: 'NON_FINANCE', sla: 168, kw: ['driving licence', 'license', 'rc', 'permit', 'rta', 'లైసెన్స్'] },
  { id: 'TRANSPORT_BUS', deptId: 'TRANSPORT', nameEn: 'Bus service (APSRTC)', nameTe: 'బస్సు సర్వీసు (APSRTC)', cat: 'NON_FINANCE', sla: 120, kw: ['bus', 'apsrtc', 'rtc', 'bus pass', 'బస్సు'] },
  { id: 'HOUSING_FUNDS', deptId: 'HOUSING', nameEn: 'House scheme instalment', nameTe: 'ఇంటి పథకం విడత', cat: 'FINANCE', sla: 360, kw: ['instalment', 'installment', 'pmay', 'house construction', 'ఇంటి నిర్మాణ'] },
  { id: 'HOUSING_SITE', deptId: 'HOUSING', nameEn: 'House site / beneficiary list', nameTe: 'ఇంటి స్థలం / లబ్ధిదారుల జాబితా', cat: 'NON_FINANCE', sla: 360, kw: ['house site', 'beneficiary list', 'layout', 'plot', 'ఇంటి స్థలం'] },
];

export const BASELINE_OFFICERS = [
  { username: 'ma.officer', name: 'K. Prasad', designation: 'Municipal Ward Officer', role: 'OFFICER', deptId: 'MA', level: 1 },
  { username: 'edu.officer', name: 'S. Vani', designation: 'Mandal Education Officer (MEO)', role: 'OFFICER', deptId: 'EDU', level: 2 },
  { username: 'agri.officer', name: 'R. Chandra', designation: 'Mandal Agriculture Officer', role: 'OFFICER', deptId: 'AGRI', level: 2 },
  { username: 'police.officer', name: 'V. Kumar', designation: 'Station House Officer (SHO)', role: 'OFFICER', deptId: 'POLICE', level: 2 },
  { username: 'transport.officer', name: 'J. Ravi', designation: 'Motor Vehicle Inspector (MVI)', role: 'OFFICER', deptId: 'TRANSPORT', level: 2 },
  { username: 'housing.officer', name: 'P. Swapna', designation: 'Housing Assistant Engineer', role: 'OFFICER', deptId: 'HOUSING', level: 1 },
];

/** Upsert everything above. Safe to run on every boot; never deletes. */
export async function ensureBaseline(prisma: PrismaClient, log: (m: string) => void = () => undefined) {
  for (const d of BASELINE_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: d.id },
      create: { ...d, slaMatrix: SLA_MATRIX },
      update: { nameEn: d.nameEn, nameTe: d.nameTe, helpline: d.helpline },
    });
  }
  for (const s of BASELINE_SUBJECTS) {
    await prisma.subject.upsert({
      where: { id: s.id },
      create: { id: s.id, deptId: s.deptId, nameEn: s.nameEn, nameTe: s.nameTe, categoryHint: s.cat, defaultSlaHrs: s.sla, keywords: JSON.stringify(s.kw) },
      update: { keywords: JSON.stringify(s.kw), nameEn: s.nameEn, nameTe: s.nameTe },
    });
  }
  const hash = await bcrypt.hash(OFFICER_PASSWORD, 10);
  const jurisdiction = JSON.stringify({ mandal: 'Kuppam' });
  for (const o of BASELINE_OFFICERS) {
    const existing = await prisma.officer.findFirst({ where: { username: o.username } });
    if (!existing) {
      await prisma.officer.create({
        data: { username: o.username, name: o.name, designation: o.designation, role: o.role, deptId: o.deptId, level: o.level, passwordHash: hash, active: true, jurisdiction },
      });
    }
  }
  log(`baseline ensured: ${BASELINE_DEPARTMENTS.length} departments, ${BASELINE_SUBJECTS.length} subjects, ${BASELINE_OFFICERS.length} officers`);
}
