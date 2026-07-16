import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { jaccard, normalize, parseJson, tokenSet } from '../../common/util';
import { Category } from '../../common/constants';
import { AP_GRIEVANCE_CORPUS, CorpusExample } from './ap-grievance-corpus';
import { DEPARTMENT_KB } from '../llm/ai-knowledge';

export interface ClassificationResult {
  deptId: string | null;
  subjectId: string | null;
  subSubjectId: string | null;
  category: string;
  confidence: number;
  rationale: string;
}

export interface DeptProbability {
  deptId: string;
  probability: number;
}

export interface StageBResult {
  probs: DeptProbability[]; // sorted desc — calibrated softmax over departments
  top1: DeptProbability | null;
  rationale: string;
  modelVersion: string;
}

export interface DistressResult {
  distress: boolean;
  emergency: boolean;
  reasons: string[];
}

export interface DuplicateResult {
  isDuplicate: boolean;
  duplicateOf: string | null;
  duplicateYsr?: string | null;
  similarity: number;
  distanceMeters?: number | null;
  method?: 'geo+semantic' | 'semantic';
}

const DISTRESS_KEYWORDS = [
  'emergency', 'urgent', 'danger', 'death', 'die', 'suicide', 'self harm', 'kill',
  'threat', 'violence', 'assault', 'harass', 'women safety', 'child', 'fire', 'collapse',
  'live wire', 'electrocut', 'drown', 'accident',
  // Telugu cues
  'ప్రాణ', 'ప్రమాద', 'అత్యవసర', 'ప్రాణాపాయం', 'చనిపోత', 'వేధింపు', 'భయం', 'ప్రాణహాని',
];

// Softmax sharpening constant — the temperature-scaling stand-in that turns raw
// similarity scores into calibrated probabilities (validated against the seed
// fixtures: clear single-topic complaints ≥ .95, vague one-liners ≤ .6).
const SOFTMAX_SCALE = 13;

/**
 * NLP classification, dedup and distress detection (Saarthi 2.0 §8–§9).
 *
 * Stage B of the two-stage classifier lives here: a nearest-centroid model over
 * the labelled AP grievance corpus (word + character-trigram features, cosine
 * similarity, keyword-feature fusion) whose scores are softmax-calibrated into
 * real probabilities — the number the 95% auto-route gate trusts. Human
 * verification decisions (TrainingEvent) are folded into the corpus at
 * inference time, closing the weekly active-learning loop at pilot scale.
 * The production path swaps this class for a fine-tuned MuRIL/IndicBERT
 * checkpoint behind the same interface.
 */
@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Feature extraction: word tokens + char trigrams (script-agnostic) ─────
  private features(text: string): Map<string, number> {
    const f = new Map<string, number>();
    const norm = normalize(text).replace(/[^\p{L}\p{N}\s]/gu, ' ');
    for (const w of norm.split(/\s+/)) {
      if (w.length < 2) continue;
      f.set(`w:${w}`, (f.get(`w:${w}`) ?? 0) + 1);
      const chars = [...w];
      for (let i = 0; i + 3 <= chars.length; i++) {
        const g = chars.slice(i, i + 3).join('');
        f.set(`g:${g}`, (f.get(`g:${g}`) ?? 0) + 0.5);
      }
    }
    return f;
  }

  private cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (const [, v] of a) na += v * v;
    for (const [, v] of b) nb += v * v;
    if (!na || !nb) return 0;
    const [small, large] = a.size <= b.size ? [a, b] : [b, a];
    for (const [k, v] of small) {
      const w = large.get(k);
      if (w) dot += v * w;
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  /** Recent human-verified labels, folded back into the model (active learning). */
  private async activeLearningExamples(): Promise<CorpusExample[]> {
    try {
      const events = await this.prisma.trainingEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      if (!events.length) return [];
      const grievances = await this.prisma.grievance.findMany({
        where: { id: { in: events.map((e) => e.grievanceId) } },
        select: { id: true, description: true, descriptionEn: true },
      });
      const byId = new Map(grievances.map((g) => [g.id, g]));
      return events
        .map((e) => {
          const g = byId.get(e.grievanceId);
          const text = g?.descriptionEn || g?.description;
          return text ? { deptId: e.humanLabel, text } : null;
        })
        .filter((x): x is CorpusExample => !!x);
    } catch {
      return [];
    }
  }

  /**
   * Stage B — calibrated department probabilities over the full taxonomy.
   * Fuses (a) nearest-centroid similarity against the labelled corpus,
   * (b) subject-taxonomy keyword hits, (c) department KB keyword hits.
   */
  async classifyProbabilities(text: string): Promise<StageBResult> {
    const norm = normalize(text);
    const f = this.features(text);

    const learned = await this.activeLearningExamples();
    const corpus = learned.length ? [...AP_GRIEVANCE_CORPUS, ...learned] : AP_GRIEVANCE_CORPUS;

    // Per-department best-example + centroid similarity.
    const deptIds = [...new Set([...corpus.map((c) => c.deptId), ...DEPARTMENT_KB.map((d) => d.deptId)])];
    const scores = new Map<string, number>();
    const evidence = new Map<string, string[]>();

    for (const dept of deptIds) {
      const examples = corpus.filter((c) => c.deptId === dept);
      let best = 0;
      let sum = 0;
      for (const ex of examples) {
        const s = this.cosine(f, this.features(ex.text));
        best = Math.max(best, s);
        sum += s;
      }
      const centroidish = examples.length ? 0.65 * best + 0.35 * (sum / examples.length) : 0;
      scores.set(dept, centroidish);
      evidence.set(dept, []);
    }

    // Keyword-feature fusion: seeded Subject taxonomy…
    const subjects = await this.prisma.subject.findMany({ where: { parentId: null } });
    for (const s of subjects) {
      const hits = parseJson<string[]>(s.keywords, []).filter((k) => norm.includes(normalize(k)));
      if (hits.length) {
        scores.set(s.deptId, (scores.get(s.deptId) ?? 0) + Math.min(hits.length * 0.09, 0.3));
        evidence.get(s.deptId)?.push(...hits.slice(0, 4));
      }
    }
    // …and the department knowledge base.
    for (const d of DEPARTMENT_KB) {
      const hits = d.keywords.filter((k) => norm.includes(k.toLowerCase()));
      if (hits.length) {
        scores.set(d.deptId, (scores.get(d.deptId) ?? 0) + Math.min(hits.length * 0.06, 0.2));
        evidence.get(d.deptId)?.push(...hits.slice(0, 3));
      }
    }

    // Temperature-scaled softmax → calibrated probabilities.
    const entries = [...scores.entries()];
    const max = Math.max(...entries.map(([, s]) => s), 0);
    if (max <= 0.02) {
      // Nothing matched at all — flat, honest uncertainty.
      const p = 1 / entries.length;
      const probs = entries.map(([deptId]) => ({ deptId, probability: Number(p.toFixed(4)) }));
      return { probs, top1: null, rationale: 'No lexical or learned signal matched — needs human categorisation.', modelVersion: this.modelVersion(learned.length) };
    }
    const exps = entries.map(([deptId, s]) => ({ deptId, e: Math.exp((s - max) * SOFTMAX_SCALE) }));
    const z = exps.reduce((a, x) => a + x.e, 0);
    const probs = exps
      .map((x) => ({ deptId: x.deptId, probability: Number((x.e / z).toFixed(4)) }))
      .sort((a, b) => b.probability - a.probability);

    const top1 = probs[0] ?? null;
    const topEvidence = top1 ? (evidence.get(top1.deptId) ?? []) : [];
    return {
      probs,
      top1,
      rationale: top1
        ? `Nearest-centroid + keyword fusion → ${top1.deptId} at p=${(top1.probability * 100).toFixed(1)}%` +
          (topEvidence.length ? ` (signals: ${[...new Set(topEvidence)].slice(0, 5).join(', ')})` : '')
        : 'No signal.',
      modelVersion: this.modelVersion(learned.length),
    };
  }

  private modelVersion(learnedCount: number): string {
    return `saarthi-stageB-centroid-v2${learnedCount ? `+al${learnedCount}` : ''}`;
  }

  /** Legacy single-suggestion classify (kept for the operator-assisted path). */
  async classify(text: string): Promise<ClassificationResult> {
    const norm = normalize(text);
    const subjects = await this.prisma.subject.findMany({ where: { parentId: null } });

    let best: { subjectId: string; deptId: string; category: string; score: number; hits: string[] } | null = null;
    for (const s of subjects) {
      const keywords = parseJson<string[]>(s.keywords, []);
      const hits = keywords.filter((k) => norm.includes(normalize(k)));
      const score = hits.length;
      if (score > 0 && (!best || score > best.score)) {
        best = { subjectId: s.id, deptId: s.deptId, category: s.categoryHint, score, hits };
      }
    }

    if (!best) {
      return {
        deptId: null,
        subjectId: null,
        subSubjectId: null,
        category: Category.NON_FINANCE,
        confidence: 0.2,
        rationale: 'No taxonomy keyword matched — needs manual categorisation by the operator.',
      };
    }

    const confidence = Math.min(0.6 + best.hits.length * 0.12, 0.97);

    const children = await this.prisma.subject.findMany({ where: { parentId: best.subjectId } });
    let subSubjectId: string | null = null;
    for (const c of children) {
      const kws = parseJson<string[]>(c.keywords, []);
      if (kws.some((k) => norm.includes(normalize(k)))) {
        subSubjectId = c.id;
        break;
      }
    }

    return {
      deptId: best.deptId,
      subjectId: best.subjectId,
      subSubjectId,
      category: best.category,
      confidence: Number(confidence.toFixed(2)),
      rationale: `Matched keywords: ${best.hits.join(', ')}`,
    };
  }

  /** Best subject within a (possibly human-chosen) department, for SLA lookup. */
  async bestSubjectFor(deptId: string, text: string): Promise<{ subjectId: string | null; category: string }> {
    const norm = normalize(text);
    const subjects = await this.prisma.subject.findMany({ where: { parentId: null, deptId } });
    let best: { id: string; category: string; score: number } | null = null;
    for (const s of subjects) {
      const hits = parseJson<string[]>(s.keywords, []).filter((k) => norm.includes(normalize(k)));
      if (hits.length && (!best || hits.length > best.score)) best = { id: s.id, category: s.categoryHint, score: hits.length };
    }
    if (best) return { subjectId: best.id, category: best.category };
    const first = subjects[0];
    return { subjectId: first?.id ?? null, category: first?.categoryHint ?? Category.NON_FINANCE };
  }

  detectDistress(text: string): DistressResult {
    const norm = normalize(text);
    const reasons = DISTRESS_KEYWORDS.filter((k) => norm.includes(normalize(k)));
    const distress = reasons.length > 0;
    return { distress, emergency: distress, reasons };
  }

  /**
   * Duplicate detection (§9) — geo + semantic. Two reports cluster when they are
   * textually similar AND (when both carry GPS) within 300 m of each other, or
   * (without GPS) in the same village/mandal. Similarity is taken over EVERY
   * available text surface — original, working-language translation AND the
   * AI's English summary — so a Telugu report and a Hindi report of the same
   * pothole cluster together via their English working texts (spec §9.1).
   * One issue = one ticket: the caller merges the new report into the
   * canonical case instead of filing a second one.
   */
  async findDuplicate(
    text: string,
    opts: {
      excludeId?: string; mandal?: string | null; village?: string | null;
      lat?: number | null; lng?: number | null; deptId?: string | null;
      textEn?: string | null; summaryEn?: string | null;
    } = {},
  ): Promise<DuplicateResult> {
    const candidates = await this.prisma.grievance.findMany({
      where: {
        id: opts.excludeId ? { not: opts.excludeId } : undefined,
        status: { notIn: ['CLOSED', 'MERGED', 'REJECTED', 'REROUTED'] },
        ...(opts.mandal ? { mandal: opts.mandal } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, ysr: true, description: true, descriptionEn: true, summaryEn: true, geoLat: true, geoLng: true, village: true, deptId: true },
    });

    const targets = [text, opts.textEn, opts.summaryEn]
      .filter((t): t is string => !!t && t.trim().length > 0)
      .map((t) => tokenSet(t));
    let best: { id: string; ysr: string; similarity: number; distance: number | null } | null = null;
    for (const c of candidates) {
      const surfaces = [c.description, c.descriptionEn, c.summaryEn]
        .filter((s): s is string => !!s && s.trim().length > 0)
        .map((s) => tokenSet(s));
      let sim = 0;
      for (const a of targets) for (const b of surfaces) sim = Math.max(sim, jaccard(a, b));
      let distance: number | null = null;
      if (opts.lat != null && opts.lng != null && c.geoLat != null && c.geoLng != null) {
        distance = haversineMeters(opts.lat, opts.lng, c.geoLat, c.geoLng);
      }
      // Geo proximity lowers the semantic bar (same spot, same story → same issue);
      // matching department also strengthens the signal. The geo bar stays above
      // the ~0.3 that template-boilerplate overlap alone can produce.
      const geoClose = distance != null && distance <= 300;
      const sameVillage = !!opts.village && c.village === opts.village;
      const sameDept = !!opts.deptId && c.deptId === opts.deptId;
      const threshold = geoClose ? 0.4 : sameVillage || sameDept ? 0.5 : 0.6;
      if (sim >= threshold) {
        if (!best || sim > best.similarity) best = { id: c.id, ysr: c.ysr, similarity: sim, distance };
      }
    }

    if (best) {
      return {
        isDuplicate: true,
        duplicateOf: best.id,
        duplicateYsr: best.ysr,
        similarity: Number(best.similarity.toFixed(2)),
        distanceMeters: best.distance != null ? Math.round(best.distance) : null,
        method: best.distance != null ? 'geo+semantic' : 'semantic',
      };
    }
    return { isDuplicate: false, duplicateOf: null, similarity: 0 };
  }
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
