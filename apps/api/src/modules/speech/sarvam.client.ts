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

async function call(path: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
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
      const msg = body?.error?.message ?? body?.message ?? `HTTP ${res.status}`;
      throw new Error(`Sarvam ${path} failed: ${msg}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

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
  const fd = new FormData();
  const ext = extForMime(mime);
  fd.append('file', new Blob([new Uint8Array(audio)], { type: mime ?? 'audio/wav' }), `audio.${ext}`);
  fd.append('model', process.env.SARVAM_STT_MODEL ?? 'saarika:v2.5');
  // "unknown" = detect the language from the audio (the whole point).
  fd.append('language_code', languageHint ? internalToSarvamLang(languageHint) : 'unknown');
  const body = await call('/speech-to-text', { method: 'POST', body: fd }, 30000);
  return {
    transcript: (body?.transcript ?? '').trim(),
    lang: sarvamToInternalLang(body?.language_code),
  };
}

/** Any-language → English (or other target) translation with auto source detection. */
export async function sarvamTranslate(
  input: string,
  targetInternal = 'en',
): Promise<{ text: string; sourceLang: string | null }> {
  const body = await call(
    '/translate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: input.slice(0, 2000),
        source_language_code: 'auto',
        target_language_code: internalToSarvamLang(targetInternal),
        model: process.env.SARVAM_TRANSLATE_MODEL ?? 'mayura:v1',
        mode: 'formal',
      }),
    },
    15000,
  );
  return {
    text: (body?.translated_text ?? '').trim(),
    sourceLang: sarvamToInternalLang(body?.source_language_code),
  };
}
