import { Injectable, Logger, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { langName } from '../../common/lang';
import { sarvamEnabled, sarvamSpeechToText, sarvamTranslate } from './sarvam.client';

export interface TranscriptResult {
  transcript: string;
  /** Internal language code detected FROM THE AUDIO ('te', 'hi', …). */
  lang: string | null;
  nameEn: string;
  nameNative: string;
  provider: 'sarvam';
}

// ~10 MB of raw audio (≈ 28 s of 16 kHz WAV is well under 1 MB — this is a
// generous abuse guard, not a working limit).
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Server-side ASR (Saarthi 2.0 §4): the browser's SpeechRecognition transcribes
 * in a PRESET language, so it cannot honour "speak in any of the 22 languages".
 * When a Sarvam key is configured, audio segments come here instead and the
 * spoken language is identified from the sound itself — the transcript returns
 * in the native script, whatever the phone's UI language is set to.
 */
@Injectable()
export class SpeechService {
  private readonly log = new Logger(SpeechService.name);
  // /speech/status?probe=1 makes one real Sarvam call so an operator can check
  // "is my key actually working in production?" from a browser. Cached briefly
  // so the public endpoint cannot be used to burn API credits.
  private probeCache: { at: number; live: 'ok' | 'failed'; detail?: string } | null = null;

  async status(probe = false) {
    const enabled = sarvamEnabled();
    const base: { asr: boolean; provider: string | null; live?: string; detail?: string } = {
      asr: enabled,
      provider: enabled ? 'sarvam' : null,
    };
    if (!probe || !enabled) return base;
    const now = Date.now();
    if (!this.probeCache || now - this.probeCache.at > 5 * 60_000) {
      try {
        const r = await sarvamTranslate('నీళ్లు రావడం లేదు', 'en');
        this.probeCache = r.text
          ? { at: now, live: 'ok' }
          : { at: now, live: 'failed', detail: 'empty translation' };
      } catch (e) {
        this.probeCache = { at: now, live: 'failed', detail: (e as Error).message.slice(0, 200) };
      }
    }
    return { ...base, live: this.probeCache.live, ...(this.probeCache.detail ? { detail: this.probeCache.detail } : {}) };
  }

  async transcribe(audioBase64: string, mime?: string, languageHint?: string): Promise<TranscriptResult> {
    if (!sarvamEnabled()) {
      throw new ServiceUnavailableException(
        'Speech recognition is not configured on this server (set SARVAM_API_KEY). The app falls back to on-device recognition.',
      );
    }
    const audio = Buffer.from(audioBase64 ?? '', 'base64');
    if (!audio.length) {
      throw new ServiceUnavailableException('Empty audio payload.');
    }
    if (audio.length > MAX_AUDIO_BYTES) {
      throw new PayloadTooLargeException('Audio segment too large — send segments under 10 MB.');
    }
    let stt: { transcript: string; lang: string | null };
    try {
      stt = await sarvamSpeechToText(audio, mime, languageHint ?? null);
    } catch (e) {
      // Surface a clean 503 (not a 500 stack) so the client degrades gracefully.
      this.log.warn(`Sarvam STT failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException(`Speech recognition upstream failed: ${(e as Error).message.slice(0, 200)}`);
    }
    const names = langName(stt.lang);
    return { transcript: stt.transcript, lang: stt.lang, nameEn: names.en, nameNative: names.native, provider: 'sarvam' };
  }

  /**
   * Best-effort variant for server-side fallbacks (voice-only complaints,
   * voice reopen reasons): never throws — a failure just means the audio stays
   * evidence-only, exactly as before Sarvam existed.
   */
  async tryTranscribeBase64(audioBase64?: string | null, mime?: string | null): Promise<TranscriptResult | null> {
    if (!audioBase64 || !sarvamEnabled()) return null;
    try {
      const r = await this.transcribe(audioBase64, mime ?? undefined);
      return r.transcript ? r : null;
    } catch (e) {
      this.log.debug(`server-side transcription skipped: ${(e as Error).message}`);
      return null;
    }
  }
}
