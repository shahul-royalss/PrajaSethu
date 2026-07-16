/**
 * Department knowledge base for the SAARTHI grievance-analysis AI. This is the
 * in-context "training": every public-facing department under the AP Public
 * Grievance Redressal System, with the grievance types it owns, the usual ROOT
 * CAUSES behind those grievances, the governing rules/orders, and an SLA hint.
 *
 * It is used two ways:
 *  1) Injected into the Claude system prompt so the model reasons like a seasoned
 *     district officer grounded in real departments and orders (not guessing).
 *  2) As the heuristic fallback when no LLM key is configured.
 *
 * Guardrail: this powers ANALYSIS and SUGGESTIONS only. The AI never decides,
 * assigns or closes a grievance — an officer always acts on the suggestion.
 */
export interface DeptKnowledge {
  deptId: string;
  name: string;
  category: 'FINANCE' | 'NON_FINANCE';
  keywords: string[];
  grievanceTypes: string[];
  rootCauses: string[];
  orders: string[];
  slaDays: number;
}

export const DEPARTMENT_KB: DeptKnowledge[] = [
  {
    deptId: 'RWS', name: 'Rural Water Supply', category: 'NON_FINANCE',
    keywords: ['water', 'drinking water', 'borewell', 'bore', 'hand pump', 'tanker', 'pipeline', 'tap', 'overhead tank', 'నీరు', 'తాగునీరు', 'బోరు', 'ట్యాంకర్'],
    grievanceTypes: ['No drinking water supply', 'Borewell/handpump not working', 'Contaminated water', 'Tanker not arriving', 'Pipeline leakage/burst', 'Overhead tank not filled'],
    rootCauses: ['Borewell motor burnt out / pump failure', 'Power supply to the pumping station cut', 'Falling groundwater table / dry borewell', 'Pipeline damage during road works', 'Tanker contractor lapse / no fuel', 'Source contamination (no chlorination)'],
    orders: ['AP Water, Land & Trees Act, 2002', 'AP Public Services Guarantee Act, 2017 — drinking water restoration SLA: 3 days', 'Jal Jeevan Mission operating guidelines', 'RWS field manual §4.2 — borewell motor replacement'],
    slaDays: 3,
  },
  {
    deptId: 'ENERGY', name: 'Energy (APSPDCL / APEPDCL)', category: 'NON_FINANCE',
    keywords: ['power', 'electricity', 'current', 'transformer', 'pole', 'wire', 'outage', 'voltage', 'bill', 'meter', 'కరెంటు', 'విద్యుత్', 'ట్రాన్స్‌ఫార్మర్'],
    grievanceTypes: ['Frequent power outages', 'Transformer damaged/burnt', 'Pole/live wire hazard', 'High/wrong electricity bill', 'No new connection', 'Low voltage'],
    rootCauses: ['Distribution transformer overload/failure', 'Snapped conductor or leaning pole (storm damage)', 'Meter fault / wrong meter reading', 'Pending feeder maintenance', 'Unbalanced load on the feeder', 'Delayed release of new service connection'],
    orders: ['Electricity Act, 2003', 'APERC Distribution Standards of Performance', 'AP Public Services Guarantee Act, 2017 — fault restoration timelines', 'DISCOM safety SOP for live-wire hazards (immediate)'],
    slaDays: 3,
  },
  {
    deptId: 'CS', name: 'Civil Supplies (PDS / Ration)', category: 'FINANCE',
    keywords: ['ration', 'rice', 'pds', 'card', 'fair price', 'dealer', 'kerosene', 'sugar', 'రేషన్', 'బియ్యం', 'కార్డు'],
    grievanceTypes: ['Ration not given this month', 'Ration card blocked/cancelled', 'Less quantity / short weight', 'New ration card application pending', 'Dealer malpractice / overcharging', 'eKYC / biometric failure'],
    rootCauses: ['Aadhaar–card eKYC mismatch / biometric authentication failure', 'Card flagged inactive for non-transaction', 'FP shop stock not lifted from MLS point', 'Dealer diversion / black-marketing', 'Portability/server downtime at the ePOS', 'Pending field verification of new application'],
    orders: ['National Food Security Act, 2013', 'AP State Food Commission norms', 'Targeted PDS Control Order', 'AP Public Services Guarantee Act, 2017 — ration card services'],
    slaDays: 7,
  },
  {
    deptId: 'PEN', name: 'Pensions & Welfare (NTR Bharosa / Social Security)', category: 'FINANCE',
    keywords: ['pension', 'old age', 'widow', 'disability', 'divyang', 'bharosa', 'scholarship', 'arrears', 'పింఛను', 'పెన్షన్', 'వితంతు'],
    grievanceTypes: ['Pension stopped/not credited', 'New pension sanction pending', 'Wrong category/amount', 'Scholarship not credited', 'Deceased pensioner removal/transfer'],
    rootCauses: ['Annual eKYC / life-certificate not done', 'Aadhaar seeding or DBT bank mapping failure', 'Pensioner marked ineligible during re-verification', 'Field functionary (WEA/WWDS) data-entry lapse', 'NPCI mapping mismatch / inactive bank account', 'Sanction pending at mandal/secretariat level'],
    orders: ['AP Social Security Pension guidelines', 'DBT / Aadhaar Payment Bridge norms', 'AP Public Services Guarantee Act, 2017 — pension sanction timelines'],
    slaDays: 15,
  },
  {
    deptId: 'REVENUE', name: 'Revenue & Land Records', category: 'NON_FINANCE',
    keywords: ['land', 'mutation', 'survey', 'patta', 'ror', '1b', 'adangal', 'caste certificate', 'income certificate', 'encroachment', 'భూమి', 'మ్యుటేషన్', 'పట్టా'],
    grievanceTypes: ['Land mutation delay', 'Survey/sub-division dispute', 'Caste/income/residence certificate delay', 'RoR (1-B/Adangal) correction', 'Land encroachment', 'Title/ownership correction'],
    rootCauses: ['Pending field measurement by the surveyor', 'Webland/RoR data mismatch', 'VRO/RI verification report not submitted', 'Objection/dispute requiring enquiry', 'Court stay or pending litigation', 'Backlog at the Tahsildar/RDO desk'],
    orders: ['AP Rights in Land & Pattadar Pass Books Act', 'AP Survey & Boundaries Act', 'AP Public Services Guarantee Act, 2017 — certificates: 7 days', 'Webland / Dharani mutation SOP'],
    slaDays: 7,
  },
  {
    deptId: 'PR', name: 'Panchayat Raj & Rural Development', category: 'NON_FINANCE',
    keywords: ['panchayat', 'street light', 'streetlight', 'streetlights', 'drainage', 'drain', 'garbage', 'sanitation', 'sewage', 'cc road', 'mgnrega', 'job card', 'wages', 'వీధి దీపం', 'వీధి దీపాలు', 'డ్రైనేజీ', 'పారిశుధ్యం', 'చెత్త', 'మురుగు'],
    grievanceTypes: ['Streetlight not working', 'Drainage/sewage overflow', 'Garbage not cleared', 'Internal CC road damaged', 'MGNREGA wages/job card', 'Drinking water in habitation'],
    rootCauses: ['Panchayat maintenance fund/staff shortage', 'Blocked or broken drain / no desilting', 'Sanitation worker / vehicle not deployed', 'Estimate/work order pending sanction', 'MGNREGA muster/payment data lapse', 'Contractor delay on the sanctioned work'],
    orders: ['AP Panchayat Raj Act, 1994', 'MGNREGA operational guidelines', '15th Finance Commission grant norms', 'Swachh Bharat (Gramin) guidelines'],
    slaDays: 7,
  },
  {
    deptId: 'MA', name: 'Municipal Administration & Urban Development', category: 'NON_FINANCE',
    keywords: ['municipal', 'corporation', 'property tax', 'water tax', 'building permission', 'town planning', 'sewerage', 'streetlight', 'ward', 'మునిసిపల్', 'ఆస్తి పన్ను'],
    grievanceTypes: ['Property/water tax assessment issue', 'Building permission delay', 'Sewerage/manhole overflow', 'Garbage/sanitation in ward', 'Encroachment on roads/footpaths', 'Birth/death certificate'],
    rootCauses: ['Assessment data mismatch in the municipal system', 'Pending site inspection by town planning', 'Sewer line choke / pumping station failure', 'Sanitation contractor lapse', 'Unauthorised construction not acted upon', 'Backlog at the Commissioner/ward office'],
    orders: ['AP Municipalities Act, 1965', 'AP Building Rules', 'CDMA service standards', 'AP Public Services Guarantee Act, 2017'],
    slaDays: 7,
  },
  {
    deptId: 'RB', name: 'Roads & Buildings (R&B)', category: 'NON_FINANCE',
    keywords: ['road', 'pothole', 'bridge', 'culvert', 'highway', 'speed breaker', 'రహదారి', 'గుంత', 'వంతెన'],
    grievanceTypes: ['Pothole-ridden / damaged road', 'Bridge/culvert damage', 'Missing road safety works', 'Black-spot / accident-prone stretch', 'Pending road repair after utility works'],
    rootCauses: ['Monsoon damage / poor drainage on the carriageway', 'Deferred periodic maintenance', 'Utility (water/power) trench not restored', 'Heavy traffic load beyond design', 'Estimate/funds for repair not sanctioned', 'Contractor delay or sub-standard work'],
    orders: ['AP R&B maintenance manual', 'IRC road standards', 'Road safety audit guidelines', 'AP Public Services Guarantee Act, 2017'],
    slaDays: 15,
  },
  {
    deptId: 'HEALTH', name: 'Health & Family Welfare', category: 'NON_FINANCE',
    keywords: ['hospital', 'phc', 'chc', 'doctor', 'medicine', 'ambulance', '108', 'aarogyasri', 'fever', 'dengue', 'ఆసుపత్రి', 'వైద్యం', 'మందులు'],
    grievanceTypes: ['Doctor/staff absent at PHC/CHC', 'Medicines unavailable', 'Ambulance (108) delay', 'Aarogyasri treatment denied', 'Sanitation/disease outbreak', 'Maternal/child health service gap'],
    rootCauses: ['Staff vacancy / unauthorised absence', 'Drug stock-out at the facility', 'Ambulance fleet/maintenance shortage', 'Empanelled-hospital coordination gap', 'Vector control not done (outbreak)', 'Equipment non-functional'],
    orders: ['AP Aarogyasri scheme guidelines', 'IPHS facility standards', 'National Health Mission norms', 'Epidemic Diseases Act (for outbreaks)'],
    slaDays: 3,
  },
  {
    deptId: 'EDU', name: 'School Education', category: 'NON_FINANCE',
    keywords: ['school', 'teacher', 'mid day meal', 'midday', 'scholarship', 'admission', 'uniform', 'textbook', 'amma vodi', 'పాఠశాల', 'ఉపాధ్యాయుడు', 'స్కాలర్‌షిప్'],
    grievanceTypes: ['Teacher absent/shortage', 'Mid-day meal quality/absence', 'Scholarship/Amma Vodi not credited', 'Admission denied', 'Infrastructure (toilets/classrooms)', 'Textbooks/uniforms not supplied'],
    rootCauses: ['Teacher vacancy / deputation imbalance', 'MDM agency supply or fund lapse', 'DBT/Aadhaar mapping failure for benefit', 'Pending verification of eligibility', 'Civil works estimate not sanctioned', 'Supply-chain delay for kits'],
    orders: ['Right to Education Act, 2009', 'Mid-Day Meal scheme guidelines', 'Jagananna Amma Vodi / Vidya Kanuka norms', 'Samagra Shiksha guidelines'],
    slaDays: 7,
  },
  {
    deptId: 'AGRI', name: 'Agriculture & Allied', category: 'FINANCE',
    keywords: ['crop', 'farmer', 'seed', 'fertilizer', 'urea', 'rythu bharosa', 'crop insurance', 'input subsidy', 'pm kisan', 'పంట', 'రైతు', 'విత్తనం', 'ఎరువు'],
    grievanceTypes: ['Rythu Bharosa / PM-Kisan not credited', 'Crop insurance claim pending', 'Seed/fertilizer shortage or spurious input', 'Input subsidy for crop loss', 'Soil health / advisory'],
    rootCauses: ['Aadhaar/land-record (e-crop) seeding mismatch', 'Bank DBT mapping failure', 'Insurance enrolment/assessment lapse', 'Supply-chain shortfall at the RBK', 'Pending e-crop booking / field verification', 'Quality-control action on spurious inputs'],
    orders: ['PM-KISAN operational guidelines', 'PM Fasal Bima Yojana norms', 'YSR Rythu Bharosa guidelines', 'AP RBK (Rythu Bharosa Kendra) SOP'],
    slaDays: 15,
  },
  {
    deptId: 'POLICE', name: 'Police / Law & Order', category: 'NON_FINANCE',
    keywords: ['police', 'fir', 'complaint', 'theft', 'harassment', 'dispute', 'cyber', 'women safety', 'disha', 'పోలీసు', 'ఫిర్యాదు', 'వేధింపు'],
    grievanceTypes: ['FIR not registered', 'No action on complaint', 'Women safety / harassment', 'Cybercrime', 'Public nuisance / law & order', 'Petition follow-up'],
    rootCauses: ['Jurisdiction / inter-station coordination', 'Investigation pending evidence', 'Complaint not escalated to the right cell (Disha/Cyber)', 'Repeat offender / community dispute', 'Resource or staffing constraint'],
    orders: ['CrPC (FIR registration is mandatory for cognizable offences)', 'AP Disha Act provisions', 'CCTNS / citizen-services SOP', 'Supreme Court Lalita Kumari guidelines'],
    slaDays: 7,
  },
  {
    deptId: 'TRANSPORT', name: 'Transport (RTA / RTC)', category: 'NON_FINANCE',
    keywords: ['rta', 'driving licence', 'license', 'rc', 'permit', 'bus', 'apsrtc', 'vehicle', 'రవాణా', 'లైసెన్స్', 'బస్సు'],
    grievanceTypes: ['Driving licence / RC delay', 'Permit / fitness issue', 'APSRTC bus service gap', 'Overcharging / refund', 'Vehicle registration'],
    rootCauses: ['Slot/appointment backlog at the RTA', 'Document verification pending', 'Route rationalisation / crew shortage (RTC)', 'System/portal downtime', 'Pending inspection'],
    orders: ['Motor Vehicles Act, 1988', 'AP Transport citizen-services charter', 'APSRTC operational norms'],
    slaDays: 7,
  },
  {
    deptId: 'HOUSING', name: 'Housing (Pedalandariki Illu)', category: 'FINANCE',
    keywords: ['house', 'housing', 'illu', 'pucca house', 'house site', 'pmay', 'ఇల్లు', 'గృహ', 'స్థలం'],
    grievanceTypes: ['House-site pattadar not allotted', 'House-construction instalment pending', 'Beneficiary list omission', 'Quality/construction issue'],
    rootCauses: ['Beneficiary verification pending', 'Stage-wise inspection not done (instalment release)', 'Layout/site readiness issue', 'DBT/bank mapping failure', 'Land litigation on the layout'],
    orders: ['PMAY (Gramin/Urban) guidelines', 'YSR/Jagananna housing scheme norms', 'AP Housing Corporation SOP'],
    slaDays: 30,
  },
];

export const KNOWN_DEPT_IDS = DEPARTMENT_KB.map((d) => d.deptId);

/** Compact reference block injected into the LLM system prompt. */
export function departmentBriefing(): string {
  return DEPARTMENT_KB.map(
    (d) =>
      `• ${d.name} [${d.deptId}] (${d.category}) — handles: ${d.grievanceTypes.join('; ')}. ` +
      `common root causes: ${d.rootCauses.join('; ')}. governing: ${d.orders.join('; ')}. typical SLA: ${d.slaDays} days.`,
  ).join('\n');
}

/** Heuristic department match (fallback when no LLM is configured). */
export function matchDepartment(text: string): DeptKnowledge | null {
  const t = (text || '').toLowerCase();
  let best: { d: DeptKnowledge; score: number } | null = null;
  for (const d of DEPARTMENT_KB) {
    const score = d.keywords.reduce((n, k) => (t.includes(k.toLowerCase()) ? n + 1 : n), 0);
    if (score > 0 && (!best || score > best.score)) best = { d, score };
  }
  return best?.d ?? null;
}
