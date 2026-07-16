/**
 * AP grievance training corpus — the installed dataset behind Stage B of the
 * two-stage department classifier (Saarthi 2.0 §8.2).
 *
 * Each row is a real-shaped, human-labelled grievance utterance (English,
 * Telugu, romanised Telugu, Hindi — the mix the pilot actually receives).
 * Stage B is a nearest-centroid / TF-cosine model over this corpus, fused with
 * taxonomy keyword features and temperature-scaled into a calibrated softmax —
 * the probability the 95% gate trusts. Every human verification decision is
 * appended to `TrainingEvent`, and the weekly active-learning job folds those
 * corrections back into this corpus (the pilot-scale stand-in for the
 * MuRIL/IndicBERT fine-tune described in the spec; same interface, same gate).
 */

export interface CorpusExample {
  deptId: string;
  text: string;
}

export const AP_GRIEVANCE_CORPUS: CorpusExample[] = [
  // ── RWS — Rural Water Supply ──────────────────────────────────────────────
  { deptId: 'RWS', text: 'No drinking water in our village for five days, borewell motor burnt' },
  { deptId: 'RWS', text: 'మా ఊరిలో తాగునీరు రావడం లేదు, బోరు చెడిపోయింది' },
  { deptId: 'RWS', text: 'Hand pump broken near the school, children have no water' },
  { deptId: 'RWS', text: 'water tanker is not coming to our hamlet since one week' },
  { deptId: 'RWS', text: 'pipeline leakage on main road, water being wasted, low pressure in taps' },
  { deptId: 'RWS', text: 'oorilo neellu ravatledu boru pani cheyatledu' },
  { deptId: 'RWS', text: 'overhead tank not being filled, taps dry every morning' },
  { deptId: 'RWS', text: 'हमारे गांव में पीने का पानी नहीं आ रहा है, बोरवेल खराब है' },
  { deptId: 'RWS', text: 'dirty smelly water coming from the tap, people falling sick after drinking' },
  { deptId: 'RWS', text: 'తాగు నీటి పైపులైన్ పగిలింది, నీళ్లు కలుషితం అవుతున్నాయి' },

  // ── ENERGY — power distribution ───────────────────────────────────────────
  { deptId: 'ENERGY', text: 'No power supply since yesterday morning, transformer sparking' },
  { deptId: 'ENERGY', text: 'కరెంటు పోయింది, ట్రాన్స్‌ఫార్మర్ కాలిపోయింది' },
  { deptId: 'ENERGY', text: 'frequent power cuts every evening, motors not working' },
  { deptId: 'ENERGY', text: 'electric pole leaning dangerously after the storm, wire hanging low' },
  { deptId: 'ENERGY', text: 'live wire fell on the road near the school, very dangerous' },
  { deptId: 'ENERGY', text: 'current bill chala ekkuva vachindi, meter reading wrong' },
  { deptId: 'ENERGY', text: 'high electricity bill this month, meter seems faulty' },
  { deptId: 'ENERGY', text: 'బిల్లు తప్పుగా వచ్చింది, మీటర్ రీడింగ్ సరిగా తీయలేదు' },
  { deptId: 'ENERGY', text: 'बिजली नहीं है दो दिन से, ट्रांसफार्मर जल गया है' },
  { deptId: 'ENERGY', text: 'low voltage problem, fans and lights very dim at night' },
  { deptId: 'ENERGY', text: 'new electricity connection applied three months ago still not given' },

  // ── CS — Civil Supplies / ration ──────────────────────────────────────────
  { deptId: 'CS', text: 'My ration card is blocked, not getting rice this month' },
  { deptId: 'CS', text: 'రేషన్ కార్డు పనిచేయడం లేదు, బియ్యం ఇవ్వడం లేదు' },
  { deptId: 'CS', text: 'ration dealer giving less quantity, weighing machine wrong' },
  { deptId: 'CS', text: 'fingerprint not working at ration shop, ekyc failure, no rice given' },
  { deptId: 'CS', text: 'ration shop dealer asking extra money for rice bags' },
  { deptId: 'CS', text: 'kalthi biyyam poor quality rice full of stones and worms' },
  { deptId: 'CS', text: 'new ration card application pending since six months' },
  { deptId: 'CS', text: 'राशन कार्ड बंद हो गया है, चावल नहीं मिल रहा' },
  { deptId: 'CS', text: 'రేషన్ డీలర్ సమయానికి షాప్ తెరవడం లేదు, సరుకులు ఇవ్వడం లేదు' },

  // ── PEN — Pensions & welfare ──────────────────────────────────────────────
  { deptId: 'PEN', text: 'My old age pension stopped, not received for three months' },
  { deptId: 'PEN', text: 'పెన్షన్ ఆగిపోయింది, మూడు నెలలుగా డబ్బులు పడలేదు' },
  { deptId: 'PEN', text: 'widow pension application pending, no response from secretariat' },
  { deptId: 'PEN', text: 'pension amount short credited, got 2000 instead of 3000' },
  { deptId: 'PEN', text: 'disability pension rejected wrongly, I have sadarem certificate' },
  { deptId: 'PEN', text: 'pension raledu ee nela, bank account lo padaledu' },
  { deptId: 'PEN', text: 'पेंशन तीन महीने से नहीं मिली है, कृपया मदद करें' },
  { deptId: 'PEN', text: 'life certificate ekyc done but pension still not restarted' },

  // ── REVENUE — land records ────────────────────────────────────────────────
  { deptId: 'REVENUE', text: 'Land mutation pending for one year, survey number 123/4A' },
  { deptId: 'REVENUE', text: 'భూమి మ్యుటేషన్ కాలేదు, పట్టా పేరు మారలేదు' },
  { deptId: 'REVENUE', text: 'caste certificate application rejected without reason' },
  { deptId: 'REVENUE', text: 'income certificate delayed, needed for college admission urgently' },
  { deptId: 'REVENUE', text: 'neighbour encroached on my land, survey not being done' },
  { deptId: 'REVENUE', text: 'adangal and 1B record showing wrong extent, correction needed' },
  { deptId: 'REVENUE', text: 'जमीन का म्यूटेशन नहीं हुआ है, पटवारी सुनता नहीं' },
  { deptId: 'REVENUE', text: 'patta transfer aagipoindi, tahsildar office chuttu tirugutunnanu' },

  // ── PR — Panchayat Raj (streetlights, drains, garbage, village roads) ─────
  { deptId: 'PR', text: 'Streetlights not working on our lane for ten days, very dark at night unsafe' },
  { deptId: 'PR', text: 'వీధి దీపాలు వెలగడం లేదు, రాత్రి చీకటిగా ఉంది, భయంగా ఉంది' },
  { deptId: 'PR', text: 'drainage overflowing near our houses, mosquitoes and bad smell' },
  { deptId: 'PR', text: 'garbage not collected for two weeks, heap growing near the temple' },
  { deptId: 'PR', text: 'village internal cc road full of potholes and mud, cannot walk in rain' },
  { deptId: 'PR', text: 'mgnrega wages not paid for the work done last month' },
  { deptId: 'PR', text: 'street light repair cheyandi, mottham veedhi antha cheekati' },
  { deptId: 'PR', text: 'नाली का पानी सड़क पर बह रहा है, सफाई नहीं होती' },
  { deptId: 'PR', text: 'డ్రైనేజీ పొంగి పొర్లుతోంది, పరిశుభ్రత లేదు, దోమలు పెరిగాయి' },
  { deptId: 'PR', text: 'sanitation worker not coming, garbage dump near school gate' },

  // ── RB — Roads & Buildings (major roads, bridges) ─────────────────────────
  { deptId: 'RB', text: 'Main road to the mandal full of big potholes, buses skidding, accidents happening' },
  { deptId: 'RB', text: 'రహదారి పూర్తిగా పాడైంది, పెద్ద గుంతలు, ప్రమాదాలు జరుగుతున్నాయి' },
  { deptId: 'RB', text: 'bridge over the stream damaged, railing broken, dangerous for vehicles' },
  { deptId: 'RB', text: 'culvert collapsed after rains, village cut off from the highway' },
  { deptId: 'RB', text: 'road dug up for pipeline six months ago, never restored' },
  { deptId: 'RB', text: 'speed breakers needed near the school on the main road, vehicles too fast' },
  { deptId: 'RB', text: 'सड़क पर बड़े गड्ढे हैं, हादसे हो रहे हैं, मरम्मत कराएं' },

  // ── HEALTH ────────────────────────────────────────────────────────────────
  { deptId: 'HEALTH', text: 'No doctor at the PHC for a week, patients returning without treatment' },
  { deptId: 'HEALTH', text: 'ఆసుపత్రిలో డాక్టర్ లేరు, మందులు ఇవ్వడం లేదు' },
  { deptId: 'HEALTH', text: 'medicines out of stock at government hospital, asked to buy outside' },
  { deptId: 'HEALTH', text: '108 ambulance came very late, patient condition became serious' },
  { deptId: 'HEALTH', text: 'dengue fever cases increasing in our village, no fogging done' },
  { deptId: 'HEALTH', text: 'aarogyasri treatment denied by the private hospital wrongly' },
  { deptId: 'HEALTH', text: 'सरकारी अस्पताल में दवाई नहीं मिल रही, डॉक्टर नहीं आते' },

  // ── VIG — vigilance / corruption ──────────────────────────────────────────
  { deptId: 'VIG', text: 'Official demanded bribe to process my application' },
  { deptId: 'VIG', text: 'లంచం అడుగుతున్నారు, డబ్బు ఇవ్వకపోతే పని చేయరు అంటున్నారు' },
  { deptId: 'VIG', text: 'clerk asking mamool money for issuing certificate, corruption' },
  { deptId: 'VIG', text: 'contractor and officer colluding, fake bills passed for work not done' },
  { deptId: 'VIG', text: 'रिश्वत मांगी जा रही है काम के लिए, शिकायत दर्ज करें' },
  { deptId: 'VIG', text: 'lancham istene pani avtundi antunnaru, illegal collection at office' },
];

/** Fold verified human decisions back in at runtime (active-learning loop). */
export function corpusWith(extra: CorpusExample[]): CorpusExample[] {
  return extra.length ? [...AP_GRIEVANCE_CORPUS, ...extra] : AP_GRIEVANCE_CORPUS;
}
