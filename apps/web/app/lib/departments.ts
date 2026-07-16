// Department directory (pilot) — single web-side source for department labels
// and helpline numbers, keyed by the ids seeded in apps/api/prisma/seed.ts.
// The public tracking API returns the department as bilingual names only (no
// id), so helplineFor matches on the English name; unknown/missing departments
// fall back to the general grievance helpline.
export const GENERAL_HELPLINE = '1902';

export const DEPARTMENTS: Record<string, { en: string; te: string; helpline: string }> = {
  CS: { en: 'Civil Supplies', te: 'పౌర సరఫరాలు', helpline: '1967' }, // ration / PDS
  PEN: { en: 'Pensions', te: 'పెన్షన్లు', helpline: '14567' }, // pensions & elder support
  ENERGY: { en: 'Energy (APSPDCL)', te: 'విద్యుత్ (APSPDCL)', helpline: '1912' }, // electricity complaints
  RWS: { en: 'Rural Water Supply', te: 'గ్రామీణ నీటి సరఫరా', helpline: '1916' }, // water supply grievances
  REVENUE: { en: 'Revenue (Land)', te: 'రెవెన్యూ (భూమి)', helpline: '1100' }, // state services / land records
  VIG: { en: 'Vigilance / Anti-Corruption', te: 'విజిలెన్స్ / అవినీతి నిరోధక', helpline: '14400' }, // anti-corruption toll-free
};

export function helplineFor(deptEn?: string | null): string {
  if (!deptEn) return GENERAL_HELPLINE;
  return Object.values(DEPARTMENTS).find((d) => d.en === deptEn)?.helpline ?? GENERAL_HELPLINE;
}
