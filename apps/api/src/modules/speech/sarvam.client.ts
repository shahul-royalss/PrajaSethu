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

export function internalToSarvamLang(code?: string | null): string {
  if (!code) return 'unknown';
  const base = code.toLowerCase().split('-')[0];
  return `${base === 'or' ? 'od' : base}-IN`;
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

async function call(path: string, makeInit: () => RequestInit, timeoutMs: number): Promise<any> {
  const delays = [0, 900, 2200]; // one call + two retries on transient failures
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
        30000,
      );
      workingSttModel = model;
      return {
        transcript: (body?.transcript ?? '').trim(),
        lang: sarvamToInternalLang(body?.language_code) ?? (languageHint || (v1 ? 'te' : null)),
      };
    } catch (e) {
      lastErr = e as Error;
      // Only walk down the ladder on 4xx that plausibly means "unknown model /
      // unsupported parameter" — auth, payload and transient errors are final.
      const status = e instanceof SarvamHttpError ? e.status : 0;
      if (!(status === 400 || status === 404 || status === 422)) throw e;
    }
  }
  throw lastErr ?? new Error('Sarvam STT failed');
}

/** Any-language → English (or other target) translation with auto source detection. */
export async function sarvamTranslate(
  input: string,
  targetInternal = 'en',
): Promise<{ text: string; sourceLang: string | null }> {
  const payload = (source: string) => ({
    input: input.slice(0, 2000),
    source_language_code: source,
    target_language_code: internalToSarvamLang(targetInternal),
    model: process.env.SARVAM_TRANSLATE_MODEL ?? 'mayura:v1',
    mode: 'formal',
  });
  const post = (source: string) =>
    call(
      '/translate',
      () => ({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(source)),
      }),
      15000,
    );
  let body: any;
  try {
    body = await post('auto');
  } catch (e) {
    // Some plans/models reject source "auto" — fall back to the script-detected
    // source language and try once more.
    const status = e instanceof SarvamHttpError ? e.status : 0;
    if (!(status === 400 || status === 422)) throw e;
    const det = detectLanguage(input);
    if (!det.lang || det.lang === targetInternal) throw e;
    body = await post(internalToSarvamLang(det.lang));
  }
  return {
    text: (body?.translated_text ?? '').trim(),
    sourceLang: sarvamToInternalLang(body?.source_language_code),
  };
}
