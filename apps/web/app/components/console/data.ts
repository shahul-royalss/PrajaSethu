'use client';

import { ListGrievance } from '../../lib/types';

// ── Status → console pill ───────────────────────────────────────────────────
export function statusPill(status: string, overdue?: boolean): { cls: string; en: string; te: string } {
  if (overdue && !['RESOLVED', 'CLOSED'].includes(status)) return { cls: 'p-brk', en: 'SLA breached', te: 'SLA దాటింది' };
  switch (status) {
    case 'REGISTERED': return { cls: 'p-new', en: 'Registered', te: 'నమోదు' };
    case 'CLASSIFIED': return { cls: 'p-new', en: 'Classified', te: 'వర్గీకరించబడింది' };
    case 'ASSIGNED': return { cls: 'p-new', en: 'Assigned', te: 'కేటాయించబడింది' };
    case 'UNDER_ENQUIRY': return { cls: 'p-prog', en: 'In progress', te: 'ప్రోగ్రెస్‌లో' };
    case 'ACTION_TAKEN': return { cls: 'p-prog', en: 'Action taken', te: 'చర్య తీసుకోబడింది' };
    case 'ON_HOLD': return { cls: 'p-prog', en: 'On hold', te: 'హోల్డ్‌లో' };
    case 'RESOLVED': return { cls: 'p-res', en: 'Resolved', te: 'పరిష్కరించబడింది' };
    case 'CLOSED': return { cls: 'p-res', en: 'Closed', te: 'మూసివేయబడింది' };
    case 'REOPENED': return { cls: 'p-esc', en: 'Reopened', te: 'తిరిగి తెరవబడింది' };
    case 'REROUTED': return { cls: 'p-esc', en: 'Rerouted', te: 'రీరూట్ చేయబడింది' };
    case 'REJECTED': return { cls: 'p-brk', en: 'Rejected', te: 'తిరస్కరించబడింది' };
    case 'MERGED': return { cls: 'p-esc', en: 'Merged', te: 'విలీనం' };
    default: return { cls: 'p-new', en: status, te: status };
  }
}

export function isOverdue(g: { slaDueAt: string | null; status: string }): boolean {
  if (!g.slaDueAt) return false;
  if (['RESOLVED', 'CLOSED', 'REJECTED'].includes(g.status)) return false;
  return new Date(g.slaDueAt).getTime() < Date.now();
}

// ── Priority → HIGH / MED / LOW + a 0..100 display score ─────────────────────
export function priority(g: ListGrievance): { level: 'hi' | 'md' | 'lo'; label: { en: string; te: string }; score: number } {
  // Synthesize a 0..100 explainability score from the signals we hold.
  let score = 30 + Math.min(40, Math.round((g.priorityScore || 0) * 6));
  if (g.slaBreachPredicted) score += 14;
  if (isOverdue(g)) score += 16;
  if (g.emergency) score += 22;
  if (g.currentLevel > 1) score += 6 * (g.currentLevel - 1);
  score = Math.max(5, Math.min(99, score));
  const level = score >= 70 ? 'hi' : score >= 45 ? 'md' : 'lo';
  const label = level === 'hi' ? { en: 'HIGH', te: 'అధికం' } : level === 'md' ? { en: 'MEDIUM', te: 'మధ్యమం' } : { en: 'LOW', te: 'తక్కువ' };
  return { level, label, score };
}

// ── SLA timer text + tone ───────────────────────────────────────────────────
export function slaTimer(g: { slaDueAt: string | null; status: string }): { tone: 'ok' | 'warn' | 'danger'; en: string; te: string; icon: 'clock' | 'alert' | 'check2' } {
  if (['RESOLVED', 'CLOSED'].includes(g.status)) return { tone: 'ok', en: 'Closed', te: 'మూసివేయబడింది', icon: 'check2' };
  if (!g.slaDueAt) return { tone: 'ok', en: '—', te: '—', icon: 'clock' };
  const ms = new Date(g.slaDueAt).getTime() - Date.now();
  if (ms < 0) return { tone: 'danger', en: 'Overdue', te: 'గడువు మించింది', icon: 'alert' };
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  const txt = d >= 1 ? `${d}d ${h % 24}h` : `${h}h`;
  return { tone: h <= 36 ? 'warn' : 'ok', en: txt, te: txt, icon: 'clock' };
}

// Representative pilot baseline (used as graceful fallback so the console always
// renders fully even before the API warms up — mirrors the approved prototype).
export const DEMO = {
  kpi: { open: 1284, atRisk: 96, withinSla: 87.4, avgDays: 2.8 },
  flow: {
    labels: ['16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29'],
    received: [82, 90, 76, 110, 98, 120, 140, 95, 88, 130, 115, 142, 160, 138],
    resolved: [70, 78, 80, 88, 92, 100, 110, 118, 90, 112, 120, 128, 140, 150],
  },
  dept: { labels: ['Revenue', 'Civil Sup.', 'Water', 'APSPDCL', 'Panchayat', 'Health', 'Edu.'], data: [286, 241, 198, 164, 142, 96, 87] },
  sla: { within: 1122, atRisk: 98, breached: 64 },
};
