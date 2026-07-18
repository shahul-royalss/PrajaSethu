// Sarvam AI client (https://api.sarvam.ai) — real multilingual speech
// intelligence for Indian languages. Two capabilities are used:
//
//  · Saarika speech-to-text with language_code="unknown": the model detects the
//    SPOKEN language from the audio itself and returns the transcript in the
//    native script. This is the thing browser SpeechRecognition fundamentally
//    cannot do — it transcribes in whatever language it was told to expect, so
//    a Telugu speaker on an English-configured phone gets garbage. Saarika
//    listens first, then transcribes.
//  · Mayura translation with source="auto": any-language → English working text
//    for officers and the classifier (replaces the offline glossary gist).
//
// Configured entirely by environment: SARVAM_API_KEY enables it (absent → the
// platform silently falls back to on-device recognition + the offline
// glossary), SARVAM_API_BASE overrides the endpoint for tests/proxies.
//
// Built to degrade, never to break:
//  · transient failures (429 / 5xx / network) retry with backoff;
//  · if the configured STT model is rejected by the account/plan, older model
//    names are tried and the working one is remembered;
//  · if the translate API rejects source "auto", the request is retried with
//    the script-detected source language.

import { detectLanguage } from '../../common/lang';

const BASE = () => process.env.SARVAM_API_BASE ?? 'https://api.sarvam.ai';

export function sarvamEnabled(): boolean {
  return !!process.env.SARVAM_API_KEY;
}

// Sarvam uses BCP-47-ish tags; Odia is "od-IN" there but "or" (ISO 639-1) here.
export function sarvamToInternalLang(code?: string | null): string | null {
  if (!code) return null;
  const base = code.toLowerCase().split('-')[0];
  return base === 'od' ? 'or' : base;
}

// Languages Sarvam actually accepts — an unvalidated hint (public endpoint)
// must fall back to auto-detect, never become a made-up "xx-IN" that 400s and
// walks the model ladder for nothing.
const SARVAM_LANGS = new Set(['bn', 'en', 'gu', 'hi', 'kn', 'ml', 'mr', 'od', 'pa', 'ta', 'te']);

export function internalToSarvamLang(code?: string | null): string {
  if (!code) return 'unknown';
  const base = code.toLowerCase().split('-')[0];
  const mapped = base === 'or' ? 'od' : base;
  return SARVAM_LANGS.has(mapped) ? `${mapped}-IN` : 'unknown';
}

function extForMime(mime?: string): string {
  const m = (mime ?? '').toLowerCase();
  if (m.includes('wav')) return 'wav';
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3';
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('webm')) return 'webm';
  return 'wav';
}

class SarvamHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const RETRYABLE = (status: number) => status === 429 || status >= 500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(
  path: string,
  makeInit: () => RequestInit,
  timeoutMs: number,
  attempts = 3,
): Promise<any> {
  // Caller-tunable retry budget: interactive/best-effort paths pass attempts=1
  // so a dead upstream can never stack ~90 s of retries inside a user request.
  const delays = [0, 900, 2200].slice(0, Math.max(1, Math.min(attempts, 3)));
  let lastErr: Error = new Error('Sarvam request failed');
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await sleep(delays[attempt]);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const init = makeInit(); // fresh body each attempt (FormData is one-shot)
      const res = await fetch(`${BASE()}${path}`, {
        ...init,
        headers: {
          'api-subscription-key': process.env.SARVAM_API_KEY ?? '',
          ...(init.headers ?? {}),
        },
        signal: ctl.signal,
      });
      const text = await res.text();
      let body: any = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      if (!res.ok) {
        const msg = body?.error?.message ?? body?.message ?? body?.detail?.[0]?.msg ?? body?.detail ?? `HTTP ${res.status}`;
        const err = new SarvamHttpError(res.status, `Sarvam ${path} failed: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`);
        if (RETRYABLE(res.status) && attempt < delays.length - 1) {
          lastErr = err;
          continue;
        }
        throw err;
      }
      return body;
    } catch (e) {
      if (e instanceof SarvamHttpError) throw e; // non-retryable HTTP error
      // network / abort — retry
      lastErr = e as Error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

// STT model ladder: the configured model first, then older names — accounts on
// older plans reject model names they don't have. The working one is cached.
function sttModelLadder(): string[] {
  const configured = process.env.SARVAM_STT_MODEL ?? 'saarika:v2.5';
  const ladder = [configured, 'saarika:v2.5', 'saarika:v2', 'saarika:v1'];
  return [...new Set(ladder)];
}
let workingSttModel: string | null = null;

/**
 * Speech → native-script text with automatic spoken-language identification.
 * Returns the transcript exactly as Saarika heard it (native script) plus the
 * detected language as an INTERNAL code ('te', 'hi', …).
 */
export async function sarvamSpeechToText(
  audio: Buffer,
  mime?: string,
  languageHint?: string | null,
  opts?: { attempts?: number; timeoutMs?: number },
): Promise<{ transcript: string; lang: string | null }> {
  // Known-working model first, but keep the rest of the ladder behind it — a
  // model that worked yesterday can be retired from a plan tomorrow.
  const ladder = sttModelLadder();
  const models = workingSttModel ? [workingSttModel, ...ladder.filter((m) => m !== workingSttModel)] : ladder;
  let lastErr: Error | null = null;
  for (const model of models) {
    // saarika:v1 cannot auto-detect — it needs an explicit language, so give it
    // the hint or Telugu (the pilot's dominant language) rather than failing.
    const v1 = model === 'saarika:v1';
    const langCode = languageHint
      ? internalToSarvamLang(languageHint)
      : v1
        ? internalToSarvamLang('te')
        : 'unknown';
    try {
      const body = await call(
        '/speech-to-text',
        () => {
          const fd = new FormData();
          fd.append('file', new Blob([new Uint8Array(audio)], { type: mime ?? 'audio/wav' }), `audio.${extForMime(mime)}`);
          fd.append('model', model);
          fd.append('language_code', langCode);
          return { method: 'POST', body: fd };
        },
        opts?.timeoutMs ?? 30000,
        opts?.attempts ?? 3,
      );
      workingSttModel = model;
      return {
        transcript: (body?.transcript ?? '').trim(),
        lang: sarvamToInternalLang(body?.language_code) ?? (languageHint || (v1 ? 'te' : null)),
      };
    } catch (e) {
      lastErr = e as Error;
      // Only walk down the ladder when the error actually names the model —
      // payload/parameter 400s (bad audio, oversize file) would fail on every
      // rung identically, and auth/transient errors are final.
      const status = e instanceof SarvamHttpError ? e.status : 0;
      const modelRejected = (status === 400 || status === 404 || status === 422) && /model/i.test((e as Error).message);
      if (!modelRejected) throw e;
      if (workingSttModel === model) workingSttModel = null; // stale cache — forget it
    }
  }
  throw lastErr ?? new Error('Sarvam STT failed');
}

// Per-model input caps from Sarvam's contract (mayura:v1 rejects >1000 chars).
function translateMaxLen(model: string): number {
  return model === 'mayura:v1' ? 1000 : 2000;
}

/** Split at sentence/whitespace boundaries into chunks the model accepts. */
function chunkForTranslate(input: string, maxLen: number): string[] {
  const text = input.trim();
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0 && chunks.length < 5) {
    if (rest.length <= maxLen) {
      chunks.push(rest);
      break;
    }
    const window = rest.slice(0, maxLen);
    // Prefer a sentence end, then any whitespace, then a hard cut.
    const sentence = Math.max(window.lastIndexOf('। '), window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '), window.lastIndexOf('\n'));
    const space = window.lastIndexOf(' ');
    const cut = sentence > maxLen * 0.4 ? sentence + 1 : space > maxLen * 0.4 ? space : maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return chunks.filter(Boolean);
}

/** Any-language → English (or other target) translation with auto source
 *  detection. Long inputs are translated in sentence-boundary chunks (mayura:v1
 *  rejects >1000 chars) instead of being silently truncated. */
export async function sarvamTranslate(
  input: string,
  targetInternal = 'en',
  opts?: { attempts?: number },
): Promise<{ text: string; sourceLang: string | null }> {
  const model = process.env.SARVAM_TRANSLATE_MODEL ?? 'mayura:v1';
  const attempts = opts?.attempts ?? 3;
  const post = (chunk: string, source: string) =>
    call(
      '/translate',
      () => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: chunk,
          source_language_code: source,
          target_language_code: internalToSarvamLang(targetInternal),
          model,
          mode: 'formal',
        }),
      }),
      15000,
      attempts,
    );
  const translateChunk = async (chunk: string): Promise<{ text: string; sourceLang: string | null }> => {
    let body: any;
    try {
      body = await post(chunk, 'auto');
    } catch (e) {
      // Some plans/models reject source "auto" — fall back to the
      // script-detected source language and try once more.
      const status = e instanceof SarvamHttpError ? e.status : 0;
      if (!(status === 400 || status === 422)) throw e;
      const det = detectLanguage(chunk);
      if (!det.lang || det.lang === targetInternal) throw e;
      body = await post(chunk, internalToSarvamLang(det.lang));
    }
    return {
      text: (body?.translated_text ?? '').trim(),
      sourceLang: sarvamToInternalLang(body?.source_language_code),
    };
  };

  const chunks = chunkForTranslate(input, translateMaxLen(model));
  const first = await translateChunk(chunks[0] ?? '');
  if (chunks.length === 1) return first;
  const restTexts: string[] = [];
  for (const c of chunks.slice(1)) restTexts.push((await translateChunk(c)).text);
  return { text: [first.text, ...restTexts].filter(Boolean).join(' '), sourceLang: first.sourceLang };
}
