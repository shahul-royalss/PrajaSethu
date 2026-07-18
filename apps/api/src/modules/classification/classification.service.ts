import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { jaccard, normalize, parseJson, tokenSet } from '../../common/util';
import { Category } from '../../common/constants';
import { AP_GRIEVANCE_CORPUS, CorpusExample, corpusWith } from './ap-grievance-corpus';
import { buildIndex, ClassifierIndex, DeptLexicon } from './classifier-core';
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

/**
 * NLP classification, dedup and distress detection (Saarthi 2.0 §8–§9).
 *
 * Stage B of the two-stage classifier lives here, backed by the pure
 * classifier core (classifier-core.ts): a TF-IDF k-nearest-neighbour model
 * over the labelled AP grievance corpus, fused with the department KB and the
 * seeded subject-taxonomy lexicons, calibrated into real probabilities —
 * validated by scripts/eval-classifier.ts (leave-one-out + held-out novel
 * phrasings). Human verification decisions (TrainingEvent) are folded into
 * the index at inference time, closing the active-learning loop: every
 * officer correction makes the next classification better. The production
 * path swaps the core for a fine-tuned MuRIL/IndicBERT checkpoint behind the
 * same interface.
 */
@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

  // The index is precomputed and reused; it rebuilds only when the training
  // signal changes (new active-learning examples / taxonomy edits).
  private indexCache: { key: string; index: ClassifierIndex } | null = null;

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
   * TF-IDF k-NN over the corpus (+ active-learning examples), fused with the
   * department KB and the seeded subject-taxonomy lexicons in the core.
   */
  async classifyProbabilities(text: string): Promise<StageBResult> {
    const learned = await this.activeLearningExamples();
    const subjects = await this.prisma.subject.findMany({ where: { parentId: null } }).catch(() => []);

    const key = `${AP_GRIEVANCE_CORPUS.length}+al${learned.length}+sub${subjects.length}`;
    if (!this.indexCache || this.indexCache.key !== key) {
      // Merge KB keywords with the DB taxonomy keywords, per department.
      const byDept = new Map<string, string[]>();
      for (const d of DEPARTMENT_KB) byDept.set(d.deptId, [...d.keywords]);
      for (const s of subjects) {
        const kws = parseJson<string[]>(s.keywords, []);
        byDept.set(s.deptId, [...(byDept.get(s.deptId) ?? []), ...kws]);
      }
      const lexicons: DeptLexicon[] = [...byDept.entries()].map(([deptId, keywords]) => ({ deptId, keywords }));
      this.indexCache = { key, index: buildIndex(corpusWith(learned), lexicons) };
    }

    const r = this.indexCache.index.classify(text);
    const modelVersion = `saarthi-stageB-knn-v3${learned.length ? `+al${learned.length}` : ''}`;
    if (!r.top1) {
      return { probs: r.probs, top1: null, rationale: 'No lexical or learned signal matched — needs human categorisation.', modelVersion };
    }
    const nearest = r.neighbors[0];
    return {
      probs: r.probs,
      top1: r.top1,
      rationale:
        `TF-IDF kNN + lexicon fusion → ${r.top1.deptId} at p=${(r.top1.probability * 100).toFixed(1)}% (margin ${(r.margin * 100).toFixed(0)}pt)` +
        (r.evidence.length ? ` · signals: ${[...new Set(r.evidence)].slice(0, 5).join(', ')}` : '') +
        (nearest ? ` · nearest case: "${nearest.text.slice(0, 60)}" [${nearest.deptId}]` : ''),
      modelVersion,
    };
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
