// Status colour + label semantics (Blueprint F.1). Colour is ALWAYS paired with
// an icon + text label — never colour alone (accessibility).
export interface StatusMeta {
  labelEn: string;
  labelTe: string;
  className: string; // tailwind classes for the badge
  icon: string;
}

export const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: { labelEn: 'Draft', labelTe: 'డ్రాఫ్ట్', className: 'bg-slate-100 text-slate-700 border-slate-300', icon: '✎' },
  REGISTERED: { labelEn: 'Registered', labelTe: 'నమోదైంది', className: 'bg-blue-50 text-blue-700 border-blue-300', icon: '●' },
  CLASSIFIED: { labelEn: 'Classified', labelTe: 'వర్గీకరించబడింది', className: 'bg-blue-50 text-blue-700 border-blue-300', icon: '◐' },
  ASSIGNED: { labelEn: 'Assigned', labelTe: 'అప్పగించబడింది', className: 'bg-indigo-50 text-indigo-700 border-indigo-300', icon: '➔' },
  UNDER_ENQUIRY: { labelEn: 'In progress', labelTe: 'విచారణలో', className: 'bg-amber-50 text-amber-700 border-amber-300', icon: '⏳' },
  ACTION_TAKEN: { labelEn: 'Action taken', labelTe: 'చర్య తీసుకోబడింది', className: 'bg-amber-50 text-amber-700 border-amber-300', icon: '⚙' },
  RESOLVED: { labelEn: 'Resolved', labelTe: 'పరిష్కరించబడింది', className: 'bg-green-50 text-green-700 border-green-300', icon: '✔' },
  CLOSED: { labelEn: 'Closed', labelTe: 'మూసివేయబడింది', className: 'bg-gray-100 text-gray-600 border-gray-300', icon: '✓' },
  REOPENED: { labelEn: 'Reopened', labelTe: 'తిరిగి తెరవబడింది', className: 'bg-purple-50 text-purple-700 border-purple-300', icon: '↻' },
  ON_HOLD: { labelEn: 'On hold', labelTe: 'నిలిపివేయబడింది', className: 'bg-slate-100 text-slate-600 border-slate-300', icon: '⏸' },
  REROUTED: { labelEn: 'Rerouted', labelTe: 'మళ్లించబడింది', className: 'bg-slate-100 text-slate-600 border-slate-300', icon: '⇄' },
  MERGED: { labelEn: 'Merged', labelTe: 'కలపబడింది', className: 'bg-slate-100 text-slate-600 border-slate-300', icon: '⊕' },
  REJECTED: { labelEn: 'Rejected', labelTe: 'తిరస్కరించబడింది', className: 'bg-red-50 text-red-700 border-red-300', icon: '✕' },
};

export function statusMeta(status: string): StatusMeta {
  return STATUS_META[status] ?? { labelEn: status, labelTe: status, className: 'bg-slate-100 text-slate-700 border-slate-300', icon: '•' };
}

export const LEVEL_LABEL: Record<number, string> = {
  1: 'L1 · Local / Nodal Officer',
  2: 'L2 · District grievance cell',
  3: 'L3 · State / Head of Dept',
  4: "L4 · CM's grievance cell",
};

export const CHANNEL_LABEL: Record<string, string> = {
  SACHIVALAYAM_ASSISTED: 'Sachivalayam (assisted)',
  CITIZEN_APP: 'Citizen app',
  WEB: 'Web portal',
  IVR: 'IVR / 1902',
  WHATSAPP: 'WhatsApp',
  SMS: 'SMS',
  CALL_1902: '1902 call center',
};

export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d;
  }
}

export function daysLeft(due?: string | null): number | null {
  if (!due) return null;
  return Math.round((new Date(due).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}
