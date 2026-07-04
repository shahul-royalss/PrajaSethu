import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { jaccard, normalize, parseJson, tokenSet } from '../../common/util';
import { Category } from '../../common/constants';

export interface ClassificationResult {
  deptId: string | null;
  subjectId: string | null;
  subSubjectId: string | null;
  category: string;
  confidence: number;
  rationale: string;
}

export interface DistressResult {
  distress: boolean;
  emergency: boolean;
  reasons: string[];
}

export interface DuplicateResult {
  isDuplicate: boolean;
  duplicateOf: string | null;
  similarity: number;
}

const DISTRESS_KEYWORDS = [
  'emergency', 'urgent', 'danger', 'death', 'die', 'suicide', 'self harm', 'kill',
  'threat', 'violence', 'assault', 'harass', 'women safety', 'child', 'fire', 'collapse',
  // Telugu cues
  'ప్రాణ', 'ప్రమాద', 'అత్యవసర', 'ప్రాణాపాయం', 'చనిపోత', 'వేధింపు', 'భయం', 'ప్రాణహాని',
];

/**
 * NLP classification, dedup and distress detection — pilot models (Blueprint D.3).
 * The blueprint says: ship rules first, learn from pilot data later, and ALWAYS
 * present AI output as a human-confirmed suggestion with a confidence score.
 *  - classify(): keyword match against the seeded Spandana-style taxonomy.
 *  - findDuplicate(): Jaccard token similarity (pilot substitute for pgvector embeddings).
 *  - detectDistress(): keyword cues → emergency fast-lane; never auto-resolves.
 */
@Injectable()
export class ClassificationService {
  constructor(private readonly prisma: PrismaService) {}

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

    // Confidence scales with the number of distinct keyword hits (capped).
    const confidence = Math.min(0.6 + best.hits.length * 0.12, 0.97);

    // Try to refine to a sub-subject if any child keyword also matches.
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

  detectDistress(text: string): DistressResult {
    const norm = normalize(text);
    const reasons = DISTRESS_KEYWORDS.filter((k) => norm.includes(normalize(k)));
    const distress = reasons.length > 0;
    return { distress, emergency: distress, reasons };
  }

  /** Near-duplicate detection against recent open grievances (excludes self). */
  async findDuplicate(text: string, opts: { excludeId?: string; mandal?: string | null } = {}): Promise<DuplicateResult> {
    const candidates = await this.prisma.grievance.findMany({
      where: {
        id: opts.excludeId ? { not: opts.excludeId } : undefined,
        status: { notIn: ['CLOSED', 'MERGED', 'REJECTED', 'REROUTED'] },
        ...(opts.mandal ? { mandal: opts.mandal } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, description: true },
    });

    const target = tokenSet(text);
    let best: { id: string; similarity: number } | null = null;
    for (const c of candidates) {
      const sim = jaccard(target, tokenSet(c.description));
      if (!best || sim > best.similarity) best = { id: c.id, similarity: sim };
    }

    const THRESHOLD = 0.6;
    if (best && best.similarity >= THRESHOLD) {
      return { isDuplicate: true, duplicateOf: best.id, similarity: Number(best.similarity.toFixed(2)) };
    }
    return { isDuplicate: false, duplicateOf: null, similarity: best ? Number(best.similarity.toFixed(2)) : 0 };
  }
}
