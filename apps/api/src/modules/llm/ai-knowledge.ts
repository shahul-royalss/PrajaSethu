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
    keywords: [
      'water', 'drinking water', 'borewell', 'bore', 'boring', 'hand pump', 'handpump', 'tanker', 'pipeline', 'tap',
      'overhead tank', 'water tank', 'water supply', 'chlorination', 'contaminated water', 'salty water', 'jal jeevan',
      'నీరు', 'నీళ్లు', 'నీళ్ళు', 'తాగునీరు', 'తాగు నీరు', 'మంచినీటి', 'మంచినీరు', 'బోరు', 'బోరింగ్', 'ట్యాంకర్', 'నల్లా', 'కుళాయి', 'పైపులైన్',
      'neellu', 'nillu', 'taagu', 'boru', 'పానీ', 'पानी', 'पीने का पानी', 'बोरवेल', 'नल', 'टंकी', 'हैंडपंप',
    ],
    grievanceTypes: ['No drinking water supply', 'Borewell/handpump not working', 'Contaminated water', 'Tanker not arriving', 'Pipeline leakage/burst', 'Overhead tank not filled'],
    rootCauses: ['Borewell motor burnt out / pump failure', 'Power supply to the pumping station cut', 'Falling groundwater table / dry borewell', 'Pipeline damage during road works', 'Tanker contractor lapse / no fuel', 'Source contamination (no chlorination)'],
    orders: ['AP Water, Land & Trees Act, 2002', 'AP Public Services Guarantee Act, 2017 — drinking water restoration SLA: 3 days', 'Jal Jeevan Mission operating guidelines', 'RWS field manual §4.2 — borewell motor replacement'],
    slaDays: 3,
  },
  {
    deptId: 'ENERGY', name: 'Energy (APSPDCL / APEPDCL)', category: 'NON_FINANCE',
    keywords: [
      'power', 'electricity', 'current', 'transformer', 'electric pole', 'live wire', 'wire', 'outage', 'power cut',
      'voltage', 'low voltage', 'electricity bill', 'current bill', 'meter', 'meter reading', 'fuse', 'feeder',
      'shock', 'electrocut', 'connection', 'apspdcl', 'apepdcl', 'discom',
      'కరెంటు', 'కరెంట్', 'విద్యుత్', 'ట్రాన్స్‌ఫార్మర్', 'స్తంభం', 'తీగ', 'తీగలు', 'వోల్టేజ్', 'మీటర్', 'బిల్లు',
      'karentu', 'karent', 'transformer', 'बिजली', 'करंट', 'ट्रांसफार्मर', 'बिजली का बिल', 'खंभा', 'तार', 'मीटर',
    ],
    grievanceTypes: ['Frequent power outages', 'Transformer damaged/burnt', 'Pole/live wire hazard', 'High/wrong electricity bill', 'No new connection', 'Low voltage'],
    rootCauses: ['Distribution transformer overload/failure', 'Snapped conductor or leaning pole (storm damage)', 'Meter fault / wrong meter reading', 'Pending feeder maintenance', 'Unbalanced load on the feeder', 'Delayed release of new service connection'],
    orders: ['Electricity Act, 2003', 'APERC Distribution Standards of Performance', 'AP Public Services Guarantee Act, 2017 — fault restoration timelines', 'DISCOM safety SOP for live-wire hazards (immediate)'],
    slaDays: 3,
  },
  {
    deptId: 'CS', name: 'Civil Supplies (PDS / Ration)', category: 'FINANCE',
    keywords: [
      'ration', 'ration card', 'ration shop', 'ration dealer', 'rice', 'rice card', 'pds', 'fair price', 'dealer',
      'kerosene', 'sugar', 'ekyc', 'e-kyc', 'epos', 'fingerprint', 'thumb impression', 'biometric', 'kalthi',
      'civil supplies', 'portability', 'card blocked', 'less quantity', 'short weight',
      'రేషన్', 'రేషన్ కార్డు', 'రేషన్ షాపు', 'రేషన్ డీలర్', 'బియ్యం', 'కార్డు', 'సరుకులు', 'చక్కెర', 'కందిపప్పు', 'కల్తీ',
      'biyyam', 'sarukulu', 'राशन', 'राशन कार्ड', 'चावल', 'डीलर', 'दुकान पर अंगूठा', 'तौल',
    ],
    grievanceTypes: ['Ration not given this month', 'Ration card blocked/cancelled', 'Less quantity / short weight', 'New ration card application pending', 'Dealer malpractice / overcharging', 'eKYC / biometric failure'],
    rootCauses: ['Aadhaar–card eKYC mismatch / biometric authentication failure', 'Card flagged inactive for non-transaction', 'FP shop stock not lifted from MLS point', 'Dealer diversion / black-marketing', 'Portability/server downtime at the ePOS', 'Pending field verification of new application'],
    orders: ['National Food Security Act, 2013', 'AP State Food Commission norms', 'Targeted PDS Control Order', 'AP Public Services Guarantee Act, 2017 — ration card services'],
    slaDays: 7,
  },
  {
    deptId: 'PEN', name: 'Pensions & Welfare (NTR Bharosa / Social Security)', category: 'FINANCE',
    keywords: [
      'pension', 'old age pension', 'old age', 'widow', 'widow pension', 'disability pension', 'disability', 'divyang',
      'sadarem', 'life certificate', 'pensioner', 'ntr bharosa', 'social security', 'arrears', 'volunteer',
      'not credited', 'short credited', 'welfare amount',
      'పింఛను', 'పెన్షన్', 'వితంతు', 'వృద్ధాప్య', 'దివ్యాంగ', 'వికలాంగ', 'సదరం', 'వాలంటీర్',
      'pension raledu', 'pinchanu', 'पेंशन', 'विधवा पेंशन', 'बुढ़ापा पेंशन', 'वृद्धावस्था',
    ],
    grievanceTypes: ['Pension stopped/not credited', 'New pension sanction pending', 'Wrong category/amount', 'Scholarship not credited', 'Deceased pensioner removal/transfer'],
    rootCauses: ['Annual eKYC / life-certificate not done', 'Aadhaar seeding or DBT bank mapping failure', 'Pensioner marked ineligible during re-verification', 'Field functionary (WEA/WWDS) data-entry lapse', 'NPCI mapping mismatch / inactive bank account', 'Sanction pending at mandal/secretariat level'],
    orders: ['AP Social Security Pension guidelines', 'DBT / Aadhaar Payment Bridge norms', 'AP Public Services Guarantee Act, 2017 — pension sanction timelines'],
    slaDays: 15,
  },
  {
    deptId: 'REVENUE', name: 'Revenue & Land Records', category: 'NON_FINANCE',
    keywords: [
      'land', 'mutation', 'survey', 'survey number', 'patta', 'pattadar', 'passbook', 'ror', '1b', 'adangal', 'pahani',
      'caste certificate', 'income certificate', 'residence certificate', 'encroachment', 'encroached', 'webland',
      'tahsildar', 'vro', 'patwari', 'meeseva', 'sub division', 'boundary', 'poramboke', 'extent', 'acres', 'land records',
      'భూమి', 'మ్యుటేషన్', 'పట్టా', 'పట్టాదారు', 'పాసుపుస్తకం', 'సర్వే', 'సర్వేయర్', 'కుల ధృవీకరణ', 'ఆదాయ ధృవీకరణ', 'పొలం', 'సరిహద్దు', 'రికార్డుల్లో',
      'bhoomi', 'bhumi', 'patta', 'जमीन', 'भूमि', 'म्यूटेशन', 'पटवारी', 'जाति प्रमाण', 'आय प्रमाण', 'रकबा',
    ],
    grievanceTypes: ['Land mutation delay', 'Survey/sub-division dispute', 'Caste/income/residence certificate delay', 'RoR (1-B/Adangal) correction', 'Land encroachment', 'Title/ownership correction'],
    rootCauses: ['Pending field measurement by the surveyor', 'Webland/RoR data mismatch', 'VRO/RI verification report not submitted', 'Objection/dispute requiring enquiry', 'Court stay or pending litigation', 'Backlog at the Tahsildar/RDO desk'],
    orders: ['AP Rights in Land & Pattadar Pass Books Act', 'AP Survey & Boundaries Act', 'AP Public Services Guarantee Act, 2017 — certificates: 7 days', 'Webland / Dharani mutation SOP'],
    slaDays: 7,
  },
  {
    deptId: 'PR', name: 'Panchayat Raj & Rural Development', category: 'NON_FINANCE',
    keywords: [
      'panchayat', 'street light', 'streetlight', 'lamp post', 'dark street', 'drainage', 'drain', 'garbage',
      'sanitation', 'sewage', 'dustbin', 'cc road', 'internal road', 'mgnrega', 'nrega', 'job card', 'wages', 'muster',
      'upadhi', 'sanitation worker', 'sweeper', 'mosquito', 'community hall', 'burial ground', 'anganwadi road',
      'వీధి దీపం', 'వీధి దీపాలు', 'వీధి లైట్', 'డ్రైనేజీ', 'పారిశుధ్యం', 'చెత్త', 'చెత్త బండి', 'కుప్పలు', 'మురుగు', 'కాలువ', 'దోమలు', 'పంచాయతీ', 'ఉపాధి హామీ', 'కూలి',
      'cheekati', 'veedhi', 'kuli', 'नाली', 'कचरा', 'सफाई', 'स्ट्रीट लाइट', 'मनरेगा', 'मजदूरी', 'पंचायत',
    ],
    grievanceTypes: ['Streetlight not working', 'Drainage/sewage overflow', 'Garbage not cleared', 'Internal CC road damaged', 'MGNREGA wages/job card', 'Drinking water in habitation'],
    rootCauses: ['Panchayat maintenance fund/staff shortage', 'Blocked or broken drain / no desilting', 'Sanitation worker / vehicle not deployed', 'Estimate/work order pending sanction', 'MGNREGA muster/payment data lapse', 'Contractor delay on the sanctioned work'],
    orders: ['AP Panchayat Raj Act, 1994', 'MGNREGA operational guidelines', '15th Finance Commission grant norms', 'Swachh Bharat (Gramin) guidelines'],
    slaDays: 7,
  },
  {
    deptId: 'MA', name: 'Municipal Administration & Urban Development', category: 'NON_FINANCE',
    keywords: [
      'municipal', 'municipality', 'corporation', 'commissioner', 'property tax', 'water tax', 'house tax',
      'building permission', 'town planning', 'sewerage', 'sewer', 'manhole', 'ward', 'colony', 'footpath',
      'birth certificate', 'death certificate', 'trade licence', 'trade license', 'unauthorized construction',
      'septic', 'town', 'park', 'market area',
      'మునిసిపల్', 'మున్సిపల్', 'మున్సిపాలిటీ', 'కార్పొరేషన్', 'ఆస్తి పన్ను', 'వార్డు', 'జనన ధృవీకరణ', 'డెత్ సర్టిఫికెట్',
      'मुनिसिपल', 'नगर पालिका', 'निगम', 'संपत्ति कर', 'वार्ड', 'सीवर', 'जन्म प्रमाण',
    ],
    grievanceTypes: ['Property/water tax assessment issue', 'Building permission delay', 'Sewerage/manhole overflow', 'Garbage/sanitation in ward', 'Encroachment on roads/footpaths', 'Birth/death certificate'],
    rootCauses: ['Assessment data mismatch in the municipal system', 'Pending site inspection by town planning', 'Sewer line choke / pumping station failure', 'Sanitation contractor lapse', 'Unauthorised construction not acted upon', 'Backlog at the Commissioner/ward office'],
    orders: ['AP Municipalities Act, 1965', 'AP Building Rules', 'CDMA service standards', 'AP Public Services Guarantee Act, 2017'],
    slaDays: 7,
  },
  {
    deptId: 'RB', name: 'Roads & Buildings (R&B)', category: 'NON_FINANCE',
    keywords: [
      'road', 'main road', 'pothole', 'bridge', 'culvert', 'highway', 'ghat road', 'speed breaker', 'tar road',
      'road repair', 'road damaged', 'road signs', 'carriageway', 'accidents happening', 'skidding', 'trench',
      'road widening', 'bus route road', 'railing',
      'రహదారి', 'రోడ్డు', 'గుంత', 'గుంతలు', 'వంతెన', 'కల్వర్టు', 'హైవే', 'ప్రమాదాలు',
      'gunthalu', 'road meeda', 'सड़क', 'गड्ढे', 'पुल', 'पुलिया', 'हाईवे', 'हादसे',
    ],
    grievanceTypes: ['Pothole-ridden / damaged road', 'Bridge/culvert damage', 'Missing road safety works', 'Black-spot / accident-prone stretch', 'Pending road repair after utility works'],
    rootCauses: ['Monsoon damage / poor drainage on the carriageway', 'Deferred periodic maintenance', 'Utility (water/power) trench not restored', 'Heavy traffic load beyond design', 'Estimate/funds for repair not sanctioned', 'Contractor delay or sub-standard work'],
    orders: ['AP R&B maintenance manual', 'IRC road standards', 'Road safety audit guidelines', 'AP Public Services Guarantee Act, 2017'],
    slaDays: 15,
  },
  {
    deptId: 'HEALTH', name: 'Health & Family Welfare', category: 'NON_FINANCE',
    keywords: [
      'hospital', 'phc', 'chc', 'dispensary', 'doctor', 'nurse', 'medicine', 'ambulance', '108', 'aarogyasri',
      'fever', 'dengue', 'malaria', 'fogging', 'vaccination', 'treatment', 'patients', 'x-ray', 'scan', 'asha worker',
      'antenatal', 'pregnant', 'nutrition', 'outbreak', 'health camp',
      'ఆసుపత్రి', 'ఆస్పత్రి', 'వైద్యం', 'వైద్య', 'మందులు', 'డాక్టర్', 'జ్వరం', 'జ్వరాలు', 'డెంగ్యూ', 'ఆరోగ్యశ్రీ', 'అంబులెన్స్', 'చికిత్స',
      'doctor undadu', 'mandulu', 'अस्पताल', 'डॉक्टर', 'दवाई', 'एंबुलेंस', 'बुखार', 'मलेरिया', 'इलाज',
    ],
    grievanceTypes: ['Doctor/staff absent at PHC/CHC', 'Medicines unavailable', 'Ambulance (108) delay', 'Aarogyasri treatment denied', 'Sanitation/disease outbreak', 'Maternal/child health service gap'],
    rootCauses: ['Staff vacancy / unauthorised absence', 'Drug stock-out at the facility', 'Ambulance fleet/maintenance shortage', 'Empanelled-hospital coordination gap', 'Vector control not done (outbreak)', 'Equipment non-functional'],
    orders: ['AP Aarogyasri scheme guidelines', 'IPHS facility standards', 'National Health Mission norms', 'Epidemic Diseases Act (for outbreaks)'],
    slaDays: 3,
  },
  {
    deptId: 'EDU', name: 'School Education', category: 'NON_FINANCE',
    keywords: [
      'school', 'teacher', 'headmaster', 'mid day meal', 'midday meal', 'scholarship', 'admission', 'uniform',
      'textbook', 'amma vodi', 'vidya kanuka', 'classes', 'classroom', 'students', 'benches', 'school toilets',
      'school building', 'compound wall', 'donation', 'single teacher', 'school bus',
      'పాఠశాల', 'బడి', 'బడికి', 'ఉపాధ్యాయుడు', 'ఉపాధ్యాయులు', 'టీచర్', 'స్కాలర్‌షిప్', 'మధ్యాహ్న భోజనం', 'మరుగుదొడ్లు', 'విద్యార్థుల',
      'school lo', 'badi', 'स्कूल', 'शिक्षक', 'मिड डे मील', 'छात्रवृत्ति', 'दाखिला', 'बेंच', 'पढ़ाई',
    ],
    grievanceTypes: ['Teacher absent/shortage', 'Mid-day meal quality/absence', 'Scholarship/Amma Vodi not credited', 'Admission denied', 'Infrastructure (toilets/classrooms)', 'Textbooks/uniforms not supplied'],
    rootCauses: ['Teacher vacancy / deputation imbalance', 'MDM agency supply or fund lapse', 'DBT/Aadhaar mapping failure for benefit', 'Pending verification of eligibility', 'Civil works estimate not sanctioned', 'Supply-chain delay for kits'],
    orders: ['Right to Education Act, 2009', 'Mid-Day Meal scheme guidelines', 'Jagananna Amma Vodi / Vidya Kanuka norms', 'Samagra Shiksha guidelines'],
    slaDays: 7,
  },
  {
    deptId: 'AGRI', name: 'Agriculture & Allied', category: 'FINANCE',
    keywords: [
      'crop', 'farmer', 'tenant farmer', 'seed', 'fertilizer', 'fertiliser', 'urea', 'rythu bharosa', 'rythu',
      'crop insurance', 'crop loss', 'input subsidy', 'pm kisan', 'e-crop', 'ecrop', 'rbk', 'paddy', 'procurement',
      'groundnut', 'cotton', 'chilli', 'pest', 'sowing', 'harvest', 'grain payment', 'spurious',
      'పంట', 'రైతు', 'రైతు భరోసా', 'విత్తనం', 'విత్తనాలు', 'ఎరువు', 'ఎరువులు', 'వ్యవసాయం', 'పంట నష్టం', 'ఆర్బీకే', 'ధాన్యం',
      'panta', 'rythu bharosa raledu', 'vyavasayam', 'फसल', 'किसान', 'बीज', 'खाद', 'यूरिया', 'फसल बीमा', 'धान', 'खरीद',
    ],
    grievanceTypes: ['Rythu Bharosa / PM-Kisan not credited', 'Crop insurance claim pending', 'Seed/fertilizer shortage or spurious input', 'Input subsidy for crop loss', 'Soil health / advisory'],
    rootCauses: ['Aadhaar/land-record (e-crop) seeding mismatch', 'Bank DBT mapping failure', 'Insurance enrolment/assessment lapse', 'Supply-chain shortfall at the RBK', 'Pending e-crop booking / field verification', 'Quality-control action on spurious inputs'],
    orders: ['PM-KISAN operational guidelines', 'PM Fasal Bima Yojana norms', 'YSR Rythu Bharosa guidelines', 'AP RBK (Rythu Bharosa Kendra) SOP'],
    slaDays: 15,
  },
  {
    deptId: 'POLICE', name: 'Police / Law & Order', category: 'NON_FINANCE',
    keywords: [
      'police', 'police station', 'fir', 'theft', 'stolen', 'robbery', 'burglary', 'harassment', 'harassing',
      'eve teasing', 'rowdy', 'cyber', 'cybercrime', 'fraud', 'women safety', 'disha', 'patrolling', 'threat',
      'attacked', 'assault', 'missing person', 'illegal liquor', 'constable', 'nuisance', 'lock broken',
      'broke', 'break in', 'crime', 'criminal', 'case', 'stole', 'gundas', 'kidnap',
      'పోలీసు', 'పోలీసులు', 'పోలీస్', 'ఎఫ్‌ఐఆర్', 'దొంగతనం', 'దొంగతనాలు', 'వేధింపు', 'వేధిస్తున్నారు', 'రౌడీలు', 'గస్తీ', 'రక్షణ',
      'dongatanam', 'पुलिस', 'एफआईआर', 'चोरी', 'छेड़खानी', 'धमकी', 'गश्त', 'साइबर',
    ],
    grievanceTypes: ['FIR not registered', 'No action on complaint', 'Women safety / harassment', 'Cybercrime', 'Public nuisance / law & order', 'Petition follow-up'],
    rootCauses: ['Jurisdiction / inter-station coordination', 'Investigation pending evidence', 'Complaint not escalated to the right cell (Disha/Cyber)', 'Repeat offender / community dispute', 'Resource or staffing constraint'],
    orders: ['CrPC (FIR registration is mandatory for cognizable offences)', 'AP Disha Act provisions', 'CCTNS / citizen-services SOP', 'Supreme Court Lalita Kumari guidelines'],
    slaDays: 7,
  },
  {
    deptId: 'TRANSPORT', name: 'Transport (RTA / RTC)', category: 'NON_FINANCE',
    keywords: [
      'rta', 'driving licence', 'driving license', 'licence', 'license', 'learner licence', 'rc', 'rc card',
      'rc transfer', 'permit', 'fitness certificate', 'bus', 'bus service', 'bus pass', 'bus depot', 'apsrtc', 'rtc',
      'vehicle', 'vehicle registration', 'auto', 'fare', 'overloaded', 'slot booking', 'engine number',
      'రవాణా', 'లైసెన్స్', 'డ్రైవింగ్ లైసెన్స్', 'బస్సు', 'బస్', 'ఆర్టీసీ', 'ఆర్టీఏ', 'బస్ పాస్', 'ఛార్జీలు',
      'bus depot', 'बस', 'लाइसेंस', 'आरटीए', 'परमिट', 'गाड़ी', 'किराया',
    ],
    grievanceTypes: ['Driving licence / RC delay', 'Permit / fitness issue', 'APSRTC bus service gap', 'Overcharging / refund', 'Vehicle registration'],
    rootCauses: ['Slot/appointment backlog at the RTA', 'Document verification pending', 'Route rationalisation / crew shortage (RTC)', 'System/portal downtime', 'Pending inspection'],
    orders: ['Motor Vehicles Act, 1988', 'AP Transport citizen-services charter', 'APSRTC operational norms'],
    slaDays: 7,
  },
  {
    deptId: 'HOUSING', name: 'Housing (Pedalandariki Illu)', category: 'FINANCE',
    keywords: [
      'house', 'housing', 'illu', 'pucca house', 'house site', 'house sites', 'pmay', 'awas', 'instalment',
      'installment', 'beneficiary list', 'geo tagging', 'layout', 'plot', 'house construction', 'scheme house',
      'housing corporation', 'basement stage', 'allotment', 'allotted',
      'ఇల్లు', 'ఇళ్లు', 'ఇళ్ల', 'ఇంటి నిర్మాణ', 'గృహ', 'పట్టా స్థలం', 'ఇంటి స్థలం', 'పేదలందరికీ ఇళ్లు', 'లేఅవుట్', 'ప్లాట్',
      'illu manjuru', 'stalam', 'मकान', 'आवास', 'किस्त', 'प्लॉट', 'लाभार्थी',
    ],
    grievanceTypes: ['House-site pattadar not allotted', 'House-construction instalment pending', 'Beneficiary list omission', 'Quality/construction issue'],
    rootCauses: ['Beneficiary verification pending', 'Stage-wise inspection not done (instalment release)', 'Layout/site readiness issue', 'DBT/bank mapping failure', 'Land litigation on the layout'],
    orders: ['PMAY (Gramin/Urban) guidelines', 'YSR/Jagananna housing scheme norms', 'AP Housing Corporation SOP'],
    slaDays: 30,
  },
  {
    deptId: 'VIG', name: 'Vigilance / Anti-Corruption', category: 'NON_FINANCE',
    keywords: [
      'bribe', 'bribery', 'corruption', 'corrupt', 'demanded money', 'asking money', 'mamool', 'commission',
      'kickback', 'fake bills', 'ghost workers', 'muster roll', 'tender', 'colluding', 'collusion', 'overcharging',
      'illegal collection', 'vigilance', 'anti corruption', 'acb', 'without paying', 'pay them', 'scheme money',
      'లంచం', 'లంచాలు', 'అవినీతి', 'మామూలు', 'మామూళ్లు', 'డబ్బులు అడుగుతున్నారు', 'డబ్బు ఇవ్వకపోతే', 'వాటా', 'బిల్లులు పాస్',
      'lancham', 'lancham istene', 'रिश्वत', 'भ्रष्टाचार', 'घूस', 'पैसे मांग', 'बिना पैसे',
    ],
    grievanceTypes: ['Bribe demanded for a service', 'Misappropriation of scheme funds', 'Fake bills / ghost beneficiaries', 'Tender irregularity', 'Official–contractor collusion'],
    rootCauses: ['Discretionary bottleneck exploited for rent-seeking', 'Weak muster/bill verification', 'No third-party audit of works', 'Concentration of sanction powers', 'Fear of retaliation suppressing complaints'],
    orders: ['Prevention of Corruption Act, 1988', 'AP Vigilance Commission procedures', 'ACB citizen-complaint SOP', 'CVC guidelines on whistle-blower protection'],
    slaDays: 15,
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
