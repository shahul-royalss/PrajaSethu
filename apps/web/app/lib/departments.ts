// Department directory (pilot) — single web-side source for department labels
// and helpline numbers, keyed by the ids seeded in apps/api/prisma/seed.ts.
// The tracking API now also returns each department's helpline directly
// (department.helpline); this map is the fallback for older payloads and for
// UI surfaces that only carry the English name.
export const GENERAL_HELPLINE = '1902';

export const DEPARTMENTS: Record<string, { en: string; te: string; helpline: string }> = {
  CS: { en: 'Civil Supplies', te: 'పౌర సరఫరాలు', helpline: '1967' }, // ration / PDS
  PEN: { en: 'Pensions', te: 'పెన్షన్లు', helpline: '14567' }, // pensions & elder support
  ENERGY: { en: 'Energy (APSPDCL)', te: 'విద్యుత్ (APSPDCL)', helpline: '1912' }, // electricity complaints
  RWS: { en: 'Rural Water Supply', te: 'గ్రామీణ నీటి సరఫరా', helpline: '1916' }, // water supply grievances
  REVENUE: { en: 'Revenue (Land)', te: 'రెవెన్యూ (భూమి)', helpline: '1100' }, // state services / land records
  PR: { en: 'Panchayat Raj (Streetlights & Sanitation)', te: 'పంచాయతీ రాజ్ (వీధి దీపాలు & పారిశుధ్యం)', helpline: '1100' },
  RB: { en: 'Roads & Buildings', te: 'రహదారులు & భవనాలు', helpline: '1100' },
  HEALTH: { en: 'Health & Family Welfare', te: 'వైద్య ఆరోగ్య శాఖ', helpline: '104' },
  VIG: { en: 'Vigilance / Anti-Corruption', te: 'విజిలెన్స్ / అవినీతి నిరోధక', helpline: '14400' }, // anti-corruption toll-free
};

export function helplineFor(deptEn?: string | null): string {
  if (!deptEn) return GENERAL_HELPLINE;
  return Object.values(DEPARTMENTS).find((d) => d.en === deptEn)?.helpline ?? GENERAL_HELPLINE;
}
