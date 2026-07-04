import { createHash } from 'crypto';

// Deterministic, canonical JSON (sorted keys) so a payload always hashes the same.
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, k) => {
        acc[k] = sortKeys(value[k]);
        return acc;
      }, {});
  }
  if (value instanceof Date) return value.toISOString();
  return value;
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

// Safe parse for JSON-encoded String columns (SQLite has no array/json types).
export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// Normalise free text for keyword classification + dedup (lowercase, collapse ws).
export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Token set for Jaccard similarity (pilot dedup substitute for pgvector embeddings).
export function tokenSet(text: string): Set<string> {
  return new Set(
    normalize(text)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(' ')
      .filter((t) => t.length > 1),
  );
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
