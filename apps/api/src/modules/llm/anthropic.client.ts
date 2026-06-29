import { Logger } from '@nestjs/common';

/**
 * Minimal Anthropic Messages API client (no SDK dependency). Used ONLY to analyse
 * a grievance and suggest a root cause / next actions — never to decide or close
 * one. Activates when ANTHROPIC_API_KEY is set; otherwise the caller falls back to
 * the heuristic analyser, so the system always works with or without a key.
 */
const logger = new Logger('AnthropicClient');

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export interface AiCallOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export async function callClaude(opts: AiCallOptions): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
  const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 900,
        temperature: opts.temperature ?? 0.2,
        system: opts.system,
        messages: [{ role: 'user', content: opts.user }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const data: any = await res.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n').trim()
      : '';
    return text || null;
  } catch (e) {
    logger.warn(`Claude call failed: ${(e as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extract the first JSON object from a model reply (tolerates prose/code fences). */
export function extractJson<T>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
