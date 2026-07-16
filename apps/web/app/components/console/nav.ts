// Console view registry — the single source of truth for which views exist and
// which roles may open them. Data-only (no components) so lightweight chrome
// like the global bottom app-nav can derive its tabs without pulling in the
// whole console bundle.
import type { IconName } from './Icon';

export type ViewId =
  | 'overview' | 'workbench' | 'verify' | 'desk' | 'grievances' | 'gis' | 'analytics' | 'citizens' | 'audit' | 'admin';

export interface NavDef {
  id: ViewId; icon: IconName; en: string; te: string; roles: string[];
  tag?: { text: string; amber?: boolean };
  group: 'ops' | 'intel' | 'gov';
}

export const NAV: NavDef[] = [
  { id: 'overview', icon: 'grid', en: 'District Command', te: 'జిల్లా కమాండ్', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'ops' },
  { id: 'workbench', icon: 'layers', en: 'Officer Workbench', te: 'అధికారి వర్క్‌బెంచ్', roles: ['OFFICER', 'SUPERVISOR', 'COLLECTOR'], group: 'ops' },
  { id: 'verify', icon: 'sparkle', en: 'AI Gate · Verify', te: 'AI గేట్ · ధృవీకరణ', roles: ['DA', 'OFFICER', 'SUPERVISOR', 'COLLECTOR'], group: 'ops' },
  { id: 'desk', icon: 'scale', en: 'Desk Review', te: 'డెస్క్ సమీక్ష', roles: ['OFFICER', 'SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'ops' },
  { id: 'grievances', icon: 'inbox', en: 'All Grievances', te: 'అన్ని ఫిర్యాదులు', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'ops' },
  { id: 'gis', icon: 'map', en: 'GIS & Hotspots', te: 'GIS & హాట్‌స్పాట్‌లు', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'intel' },
  { id: 'analytics', icon: 'chart', en: 'Analytics', te: 'విశ్లేషణ', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'intel' },
  { id: 'citizens', icon: 'users', en: 'Citizens', te: 'పౌరులు', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'intel' },
  { id: 'audit', icon: 'shield', en: 'Audit & Ledger', te: 'ఆడిట్ & లెడ్జర్', roles: ['AUDITOR', 'COLLECTOR'], group: 'gov' },
  { id: 'admin', icon: 'cog', en: 'Administration', te: 'అడ్మినిస్ట్రేషన్', roles: ['COLLECTOR', 'AUDITOR'], group: 'gov' },
];

export function canSeeView(role: string, id: ViewId): boolean {
  return NAV.some((n) => n.id === id && n.roles.includes(role));
}
