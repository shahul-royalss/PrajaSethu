import { Injectable, Logger, PayloadTooLargeException, ServiceUnavailableException } from '@nestjs/common';
import { langName } from '../../common/lang';
import { sarvamEnabled, sarvamSpeechToText } from './sarvam.client';

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

  status() {
    const enabled = sarvamEnabled();
    return {
      asr: enabled,
      provider: enabled ? 'sarvam' : null,
    };
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
    const { transcript, lang } = await sarvamSpeechToText(audio, mime, languageHint ?? null);
    const names = langName(lang);
    return { transcript, lang, nameEn: names.en, nameNative: names.native, provider: 'sarvam' };
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
