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
  department: Bilingual | null;
  subject: Bilingual | null;
  plainStatus: PlainStatus;
  slaDueAt: string | null;
  slaBreachPredicted: boolean;
  emergency: boolean;
  currentLevel: number;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  timeline: TimelineEvent[];
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
  slaDueAt: string | null;
  slaBreachPredicted: boolean;
  currentLevel: number;
  createdAt: string;
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
