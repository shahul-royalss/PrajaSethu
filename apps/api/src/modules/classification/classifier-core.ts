/**
 * Stage-B classifier core (pure — no DB, no framework). A TF-IDF weighted
 * k-nearest-neighbour model over the labelled AP grievance corpus:
 *
 *   features  — word unigrams + word bigrams + character 3/4-grams. The char
 *               n-grams are what make it script-robust: "కరెంటు", "karentu"
 *               and "current bill" all light up ENERGY even with typos and
 *               romanised spellings the word features would miss.
 *   weighting — smoothed inverse document frequency learnt from the corpus, so
 *               filler that appears everywhere ("not", "working", "మా") stops
 *               deciding departments and the discriminative vocabulary does.
 *   scoring   — cosine similarity to every labelled example; the top-K nearest
 *               neighbours vote for their department with weight sim², fused
 *               with curated lexicon hits (department KB + subject taxonomy).
 *   output    — temperature-scaled softmax over department votes: a calibrated
 *               probability the auto-route/audit gate can actually trust, plus
 *               the top-1/top-2 margin and the evidence behind the choice.
 *
 * The index is precomputed once per corpus revision (buildIndex) — classify()
 * itself is a few hundred sparse dot products, fast enough for every intake.
 */

export interface CorpusExample {
  deptId: string;
  text: string;
}

export interface CoreProbability {
  deptId: string;
  probability: number;
}

export interface CoreResult {
  probs: CoreProbability[]; // sorted desc
  top1: CoreProbability | null;
  margin: number; // top1 − top2 probability
  neighbors: { deptId: string; sim: number; text: string }[];
  evidence: string[]; // lexicon hits supporting top1
  /** Per-department blend components — populated for tooling/eval only. */
  debug?: { deptId: string; knn: number; lex: number; hits: string[]; blended: number }[];
}

// Tuned on leave-one-out over the corpus (scripts/eval-classifier.ts):
// K controls vote breadth, SOFTMAX_SCALE controls calibration sharpness.
const K_NEIGHBORS = 8;
const SOFTMAX_SCALE = 10;
const MIN_SIM = 0.02;
const LEXICON_BLEND = 0.45; // curated lexicons carry near-equal weight to kNN

function norm(text: string): string {
  // \p{M} (combining marks) MUST be kept: Indic vowel signs and the virama are
  // Marks, not Letters — dropping them shreds "నీళ్లు" into "న ళ ల" and the
  // whole model degenerates into single-consonant soup for Telugu/Hindi text.
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Multilingual glue words. Left in, they dominate cosine similarity — a
// complaint shares ten of these with EVERY example and only one or two topical
// words with the right one, so neighbours match on grammar instead of subject.
// (Negations are glue too: "not working" appears in every department.)
const STOPWORDS = new Set([
  // English
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'and', 'or', 'but', 'not', 'no',
  'in', 'on', 'at', 'of', 'for', 'to', 'from', 'with', 'by', 'about', 'into', 'over', 'under', 'near',
  'our', 'my', 'we', 'us', 'you', 'your', 'they', 'their', 'them', 'he', 'she', 'it', 'its', 'me', 'i',
  'this', 'that', 'these', 'those', 'there', 'here', 'has', 'have', 'had', 'do', 'does', 'did', 'done',
  'will', 'would', 'can', 'could', 'should', 'may', 'might', 'very', 'so', 'too', 'also', 'even', 'still',
  'since', 'ago', 'now', 'today', 'yesterday', 'please', 'kindly', 'sir', 'madam', 'help', 'us',
  'after', 'before', 'when', 'what', 'who', 'why', 'how', 'all', 'any', 'some', 'every', 'each', 'per',
  'one', 'two', 'three', 'days', 'day', 'week', 'weeks', 'month', 'months', 'year', 'years', 'time', 'times',
  'getting', 'giving', 'given', 'get', 'got', 'going', 'come', 'came', 'coming', 'take', 'taken', 'make',
  'working', 'work', 'works', 'worked', 'issue', 'problem', 'problems', 'complaint', 'village', 'without',
  // Cross-department PROCESS vocabulary — "application pending at the office"
  // describes bureaucracy, not a department; left in, it routes a licence
  // renewal to whichever department mentions renewals most.
  'pending', 'office', 'officer', 'official', 'officials', 'staff', 'renewal', 'renew', 'applied', 'apply',
  'application', 'delay', 'delayed', 'sanction', 'sanctioned', 'waiting', 'request', 'status', 'action',
  'register', 'registered', 'government', 'service', 'services', 'department', 'stuck', 'response',
  'someone', 'anyone', 'else', 'keep', 'keeps', 'keeping', 'monthly',
  // Benefit-delivery glue: schemes, money, accounts — every FINANCE department
  // shares this vocabulary, so it separates nothing. (Curated PHRASES like
  // "demanded money" or "rythu bharosa" still match — the lexicon runs on the
  // raw text, not on these filtered features.)
  'scheme', 'yojana', 'money', 'amount', 'credited', 'credit', 'bank', 'account', 'paid', 'payment', 'rupees',
  // Certificate vocabulary spans REVENUE / MA / EDU — the qualifying word
  // (caste, income, birth, జనన, కుల…) is what separates them.
  'certificate', 'certificates', 'సర్టిఫికెట్', 'ధృవీకరణ', 'పత్రం', 'प्रमाण',
  'दफ्तर', 'कार्यालय', 'अधिकारी', 'आवेदन', 'लंबित', 'सरकारी', 'योजना', 'पैसा', 'पैसे', 'खाता', 'रुपये', 'महीना',
  'దరఖాస్తు', 'కార్యాలయం', 'అధికారి', 'అధికారులు', 'పెండింగ్', 'ఆఫీసు', 'పథకం', 'పథకంలో', 'డబ్బులు', 'డబ్బు', 'ఖాతాలో', 'నెల',
  'dabbulu', 'dabbu', 'khata',
  // Telugu
  'మా', 'మన', 'నా', 'నేను', 'మేము', 'మీరు', 'ఈ', 'ఆ', 'అది', 'ఇది', 'మరియు', 'కాని', 'కానీ',
  'లేదు', 'కాదు', 'ఉంది', 'ఉన్నాయి', 'ఉన్న', 'చాలా', 'దయచేసి', 'కోసం', 'నుండి', 'నుంచి', 'వల్ల',
  'రోజుల', 'రోజులుగా', 'నెలల', 'నెలలుగా', 'వారం', 'ఇంకా', 'మళ్ళీ', 'కూడా', 'అని', 'అంటున్నారు',
  'చేయడం', 'చేస్తున్నారు', 'అవుతోంది', 'జరుగుతున్నాయి', 'సమస్య', 'ఊరిలో', 'ఊరి', 'గ్రామంలో',
  // Romanised Telugu glue
  'na', 'maa', 'mana', 'chala', 'unnayi', 'undi', 'ledu', 'kadu', 'lo', 'ki', 'ku', 'nundi', 'kosam',
  'chesanu', 'chesi', 'ayindi', 'avtunnayi', 'antunnaru', 'pani', 'cheyandi', 'cheyatledu', 'raledu', 'ravatledu',
  // Hindi
  'है', 'हैं', 'था', 'थी', 'थे', 'नहीं', 'और', 'या', 'का', 'की', 'के', 'को', 'में', 'से', 'पर', 'हो',
  'रहा', 'रही', 'रहे', 'गया', 'गयी', 'हुआ', 'हुई', 'कर', 'करें', 'कराएं', 'कृपया', 'हमारे', 'हमारा',
  'मेरा', 'मेरी', 'यह', 'वह', 'इस', 'उस', 'भी', 'तो', 'अब', 'बहुत', 'दिन', 'महीने', 'साल', 'गांव',
]);

/** Light, language-aware canonicalisation: strip English plurals and the
 *  Telugu plural suffix so "streetlights"/"streetlight"/"వీధి దీపాలు" meet. */
function stem(w: string): string {
  if (/^[a-z0-9]+$/.test(w)) {
    if (w.length >= 5 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
    if (w.length >= 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
    return w;
  }
  if (w.length > 3 && w.endsWith('లు')) return w.slice(0, -2);
  return w;
}

export function featurize(text: string): Map<string, number> {
  const f = new Map<string, number>();
  const add = (k: string, w: number) => f.set(k, (f.get(k) ?? 0) + w);
  const words = norm(text)
    .split(' ')
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map(stem);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    add(`w:${w}`, 1);
    if (i + 1 < words.length) {
      add(`b:${w}_${words[i + 1]}`, 1.25);
      // Compound merge: "street light" ⇄ "streetlight", "bore well" ⇄
      // "borewell" — spaced and joined spellings become the same feature.
      add(`w:${w}${words[i + 1]}`, 0.8);
    }
    // Char n-grams bridge typos, romanised spellings and inflection. Kept
    // faint — trigrams especially collide across unrelated Indic words
    // (వాగు/తాగు share "ాగు") and must never outvote whole-word evidence.
    const chars = [...w];
    for (let j = 0; j + 3 <= chars.length; j++) add(`g3:${chars.slice(j, j + 3).join('')}`, 0.12);
    for (let j = 0; j + 4 <= chars.length; j++) add(`g4:${chars.slice(j, j + 4).join('')}`, 0.22);
  }
  return f;
}

interface IndexedDoc {
  deptId: string;
  text: string;
  vec: Map<string, number>; // idf-weighted
  norm: number;
}

export interface DeptLexicon {
  deptId: string;
  keywords: string[];
}

export class ClassifierIndex {
  private docs: IndexedDoc[] = [];
  private idf = new Map<string, number>();
  private lexicons: { deptId: string; keywords: string[] }[] = [];
  readonly deptIds: string[] = [];
  readonly size: number;

  constructor(corpus: CorpusExample[], lexicons: DeptLexicon[] = []) {
    this.size = corpus.length;
    this.lexicons = lexicons.map((l) => ({ deptId: l.deptId, keywords: l.keywords.map((k) => norm(k)).filter(Boolean) }));

    // Document frequency → smoothed idf.
    const df = new Map<string, number>();
    const rawFeatures = corpus.map((ex) => featurize(ex.text));
    for (const f of rawFeatures) {
      for (const k of f.keys()) df.set(k, (df.get(k) ?? 0) + 1);
    }
    // SQUARED idf: a word in 2 documents outweighs a word in 40 by ~5×, not
    // ~2× — the discriminative vocabulary decides, residual glue does not.
    const n = Math.max(1, corpus.length);
    for (const [k, d] of df) this.idf.set(k, Math.log(1 + n / (1 + d)) ** 2);

    const depts = new Set<string>();
    corpus.forEach((ex, i) => {
      const vec = new Map<string, number>();
      for (const [k, v] of rawFeatures[i]) vec.set(k, v * (this.idf.get(k) ?? 1));
      let sq = 0;
      for (const [, v] of vec) sq += v * v;
      this.docs.push({ deptId: ex.deptId, text: ex.text, vec, norm: Math.sqrt(sq) || 1 });
      depts.add(ex.deptId);
    });
    for (const l of lexicons) depts.add(l.deptId);
    this.deptIds.push(...depts);
  }

  classify(text: string): CoreResult {
    const raw = featurize(text);
    const q = new Map<string, number>();
    for (const [k, v] of raw) q.set(k, v * (this.idf.get(k) ?? 1));
    let qs = 0;
    for (const [, v] of q) qs += v * v;
    const qn = Math.sqrt(qs) || 1;

    // Cosine against every labelled example (sparse dot on the smaller map).
    const sims: { deptId: string; sim: number; text: string }[] = [];
    for (const d of this.docs) {
      let dot = 0;
      const [small, large] = q.size <= d.vec.size ? [q, d.vec] : [d.vec, q];
      for (const [k, v] of small) {
        const w = large.get(k);
        if (w) dot += v * w;
      }
      const sim = dot / (qn * d.norm);
      if (sim > MIN_SIM) sims.push({ deptId: d.deptId, sim, text: d.text });
    }
    sims.sort((a, b) => b.sim - a.sim);
    const neighbors = sims.slice(0, K_NEIGHBORS);

    // Per-department evidence: the best two matches of EACH department, sim²
    // weighted. A global top-K vote lets one dense same-language cluster crowd
    // out the right answer; per-department bests are immune to that crowding.
    const votes = new Map<string, number>();
    const perDeptTop = new Map<string, number[]>();
    for (const s of sims) {
      const arr = perDeptTop.get(s.deptId) ?? [];
      if (arr.length < 2) {
        arr.push(s.sim);
        perDeptTop.set(s.deptId, arr);
      }
    }
    for (const [dept, arr] of perDeptTop) {
      const s1 = arr[0] ?? 0;
      const s2 = arr[1] ?? 0;
      votes.set(dept, s1 * s1 + 0.6 * s2 * s2);
    }
    const maxVote = Math.max(...votes.values(), 0);

    // Curated lexicon hits (KB + taxonomy keywords, all languages). Multiword
    // and long keywords are worth more — "ration card" hitting is far stronger
    // evidence than "card" alone.
    const normText = ` ${norm(text)} `;
    const stemmedText = ` ${norm(text).split(' ').map(stem).join(' ')} `;
    const lexScore = new Map<string, number>();
    const lexHits = new Map<string, string[]>();
    for (const l of this.lexicons) {
      let weight = 0;
      const hits: string[] = [];
      for (const k of l.keywords) {
        if (k.length < 3) continue;
        const ks = k.split(' ').map(stem).join(' ');
        if (normText.includes(k) || stemmedText.includes(ks)) {
          hits.push(k);
          weight += k.includes(' ') || k.length >= 8 ? 1.6 : 1;
        }
      }
      if (weight > 0) {
        lexScore.set(l.deptId, Math.min(1, weight * 0.3));
        lexHits.set(l.deptId, hits);
      }
    }
    const maxLex = Math.max(...lexScore.values(), 0);

    if (maxVote <= 0 && maxLex <= 0) {
      const p = this.deptIds.length ? 1 / this.deptIds.length : 0;
      return {
        probs: this.deptIds.map((deptId) => ({ deptId, probability: Number(p.toFixed(4)) })),
        top1: null,
        margin: 0,
        neighbors: [],
        evidence: [],
      };
    }

    // Trust-weighted blend. Normalising votes guarantees SOME department a
    // perfect k-NN score even when the best cosine is 0.1 noise — so each side
    // is additionally weighted by its ABSOLUTE strength: k-NN counts in
    // proportion to how similar its best neighbour actually was, the lexicon
    // in proportion to how much curated vocabulary actually matched. Garbage
    // neighbours then lose to a real keyword hit instead of outranking it.
    const bestSim = sims[0]?.sim ?? 0;
    const knnTrust = Math.min(1, (bestSim / 0.32) ** 2);
    const scores = new Map<string, number>();
    for (const dept of this.deptIds) {
      const knn = maxVote > 0 ? (votes.get(dept) ?? 0) / maxVote : 0;
      const lex = maxLex > 0 ? (lexScore.get(dept) ?? 0) / maxLex : 0;
      const blended = (1 - LEXICON_BLEND) * knn * knnTrust + LEXICON_BLEND * lex * maxLex;
      if (blended > 0) scores.set(dept, blended);
    }

    const entries = [...scores.entries()];
    const maxScore = Math.max(...entries.map(([, s]) => s));
    const exps = entries.map(([deptId, s]) => ({ deptId, e: Math.exp((s - maxScore) * SOFTMAX_SCALE) }));
    // Departments with zero signal share a tiny floor so probabilities stay honest.
    const zeroCount = this.deptIds.length - entries.length;
    const zeroMass = zeroCount * Math.exp(-maxScore * SOFTMAX_SCALE - 1.5);
    const z = exps.reduce((a, x) => a + x.e, 0) + zeroMass;
    const probs = exps
      .map((x) => ({ deptId: x.deptId, probability: Number((x.e / z).toFixed(4)) }))
      .sort((a, b) => b.probability - a.probability);

    const top1 = probs[0] ?? null;
    const top2p = probs[1]?.probability ?? 0;
    return {
      probs,
      top1,
      margin: top1 ? Number((top1.probability - top2p).toFixed(4)) : 0,
      neighbors,
      evidence: top1 ? (lexHits.get(top1.deptId) ?? []).slice(0, 6) : [],
      debug: [...scores.entries()]
        .map(([deptId, blended]) => ({
          deptId,
          knn: Number(((maxVote > 0 ? (votes.get(deptId) ?? 0) / maxVote : 0) * knnTrust).toFixed(3)),
          lex: Number((lexScore.get(deptId) ?? 0).toFixed(3)),
          hits: lexHits.get(deptId) ?? [],
          blended: Number(blended.toFixed(3)),
        }))
        .sort((a, b) => b.blended - a.blended)
        .slice(0, 4),
    };
  }
}

export function buildIndex(corpus: CorpusExample[], lexicons: DeptLexicon[] = []): ClassifierIndex {
  return new ClassifierIndex(corpus, lexicons);
}
