export interface Bilingual {
  en: string;
  te: string;
}

export interface PlainStatus {
  te: string;
  en: string;
  aiGenerated: boolean;
}

export interface TimelineEvent {
  event: string;
  role: string;
  at: string;
  txId: string;
}

export interface PublicGrievance {
  id: string;
  ysr: string;
  status: string;
  category: string;
  department: (Bilingual & { helpline?: string | null }) | null;
  subject: Bilingual | null;
  officer: { name: string; designation: string | null } | null;
  routedBy: string | null;
  aiConfidence: number | null;
  severity: string | null;
  urgency: string | null;
  summary: { en: string | null; te: string | null };
  language: { code: string; confidence: number | null; codeSwitched: boolean; en: string; native: string } | null;
  reportCount: number;
  mergedFrom: { ysr: string } | null;
  location: {
    district: string | null;
    mandal: string | null;
    village: string | null;
    geo: { lat: number; lng: number; accuracy: number | null; capturedAt: string | null } | null;
  };
  plainStatus: PlainStatus;
  slaDueAt: string | null;
  slaBreachPredicted: boolean;
  emergency: boolean;
  currentLevel: number;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  voiceAttachments: { id: string; type: string; mime: string; createdAt: string }[];
  deskReview: {
    status: string;
    reason: string | null;
    channel: string;
    requestedAt: string;
    reviewedByName: string | null;
    reviewNote: string | null;
    reviewedAt: string | null;
  } | null;
  timeline: TimelineEvent[];
}

export interface ChainBlock {
  seq: number;
  eventType: string;
  actorRole: string;
  grievanceId: string | null;
  ysr: string | null;
  payload: unknown;
  payloadHash: string;
  prevHash: string;
  blockHash: string;
  ledgerTxId: string;
  ts: string;
  verified: boolean;
}

export interface ChainFeed {
  blocks: ChainBlock[];
  total: number;
  head: { seq: number; blockHash: string; ts: string } | null;
  genesisPrev: string;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  events?: number;
  brokenAt?: number;
  reason?: string;
  lastCheckedAt: string;
}

export interface ListGrievance {
  id: string;
  ysr: string;
  status: string;
  category: string;
  department: string | null;
  mandal: string | null;
  priorityScore: number;
  distressFlag: boolean;
  emergency: boolean;
  severity?: string | null;
  urgency?: string | null;
  reportCount?: number;
  routedBy?: string | null;
  detectedLang?: string | null;
  slaDueAt: string | null;
  slaBreachPredicted: boolean;
  currentLevel: number;
  createdAt: string;
  // citizen list extras
  officer?: { id: string; name: string; designation: string | null } | null;
  summaryEn?: string | null;
  issue?: string | null;
  village?: string | null;
}

export interface ClassificationPreview {
  classification: {
    deptId: string | null;
    subjectId: string | null;
    subSubjectId: string | null;
    category: string;
    confidence: number;
    rationale: string;
  };
  distress: { distress: boolean; emergency: boolean; reasons: string[] };
  duplicate: { isDuplicate: boolean; duplicateOf: string | null; similarity: number };
}

export interface RefItem {
  id: string;
  en: string;
  te: string;
  deptId?: string;
  category?: string;
  defaultSlaHrs?: number;
}
