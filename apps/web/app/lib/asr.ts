'use client';

// Server-side ASR client (Saarthi 2.0 §4) — the fix for "I speak Telugu, it
// writes Hindi". Browser SpeechRecognition transcribes in a PRESET language:
// it cannot listen first and decide. When the API has a Sarvam key, raw audio
// goes to the server instead, the spoken language is identified FROM THE AUDIO
// and the transcript comes back in the native script — no picker, no guessing.
//
// The pipeline here: the recorder's Web-Audio graph taps raw PCM →
// PcmSegmenter downsamples to 16 kHz mono, watches for natural pauses, and
// cuts ≤28 s WAV segments at silence boundaries → each segment is POSTed to
// /speech/transcribe → native-script text streams into the UI a phrase at a
// time, in speaking order.

import { api } from './api';

export interface AsrStatus {
  asr: boolean;
  provider: string | null;
}

export interface AsrTranscript {
  transcript: string;
  lang: string | null; // internal code detected from the AUDIO ('te', 'hi', …)
  nameEn: string;
  nameNative: string;
  provider: string;
}

// One status probe per page load — every voice surface shares the answer.
let statusPromise: Promise<AsrStatus> | null = null;

export function asrStatus(): Promise<AsrStatus> {
  if (!statusPromise) {
    statusPromise = api
      .get<AsrStatus>('/speech/status')
      .catch(() => ({ asr: false, provider: null }));
  }
  return statusPromise;
}

export async function transcribeWav(blob: Blob, languageHint?: string): Promise<AsrTranscript | null> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const audioBase64 = dataUrl.split(',')[1] ?? '';
  if (!audioBase64) return null;
  try {
    const r = await api.post<AsrTranscript>('/speech/transcribe', {
      audioBase64,
      mime: 'audio/wav',
      languageHint,
    });
    return r?.transcript ? r : null;
  } catch {
    return null; // a lost segment is a lost phrase, never a broken recording
  }
}

// ── 16 kHz mono WAV encoding ─────────────────────────────────────────────────
const TARGET_RATE = 16000;

export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_RATE) return input;
  const ratio = inputRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  // Average the source window per output sample — a cheap low-pass that avoids
  // the aliasing hiss plain decimation would add to the uploaded speech.
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export function encodeWav16kMono(samples: Float32Array): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// ── Silence-aware segmenter ──────────────────────────────────────────────────
// Cuts at natural pauses so words are never split mid-syllable, with a hard
// ceiling well inside the STT service's per-request limit.
const MAX_SEGMENT_SEC = 26;
const MIN_SPEECH_SEC = 1.2; // don't bother transcribing blips
const SILENCE_CUT_SEC = 1.0; // a pause this long ends a phrase
const SILENCE_RMS = 0.011; // below this (with headroom over noise floor) = quiet

export class PcmSegmenter {
  private chunks: Float32Array[] = [];
  private totalSamples = 0;
  private speechSamples = 0;
  private trailingSilence = 0; // seconds
  private noiseFloor = 0.004; // adaptive EMA of quiet-frame RMS

  constructor(private readonly onSegment: (wav: Blob, durationSec: number) => void) {}

  /** Feed raw PCM from the recorder tap (any sample rate — resampled here). */
  feed(samples: Float32Array, inputRate: number) {
    const pcm = downsampleTo16k(samples, inputRate);
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
    const rms = Math.sqrt(sum / Math.max(1, pcm.length));
    const dur = pcm.length / TARGET_RATE;

    const quiet = rms < Math.max(SILENCE_RMS, this.noiseFloor * 2.5);
    if (quiet) {
      this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
      this.trailingSilence += dur;
    } else {
      this.trailingSilence = 0;
      this.speechSamples += pcm.length;
    }

    this.chunks.push(pcm);
    this.totalSamples += pcm.length;

    const totalSec = this.totalSamples / TARGET_RATE;
    const speechSec = this.speechSamples / TARGET_RATE;
    if (
      (speechSec >= MIN_SPEECH_SEC && this.trailingSilence >= SILENCE_CUT_SEC) ||
      totalSec >= MAX_SEGMENT_SEC
    ) {
      this.cut();
    }
  }

  /** Emit whatever is buffered (call on Stop). */
  flush() {
    if (this.speechSamples / TARGET_RATE >= 0.4) this.cut();
    else this.reset();
  }

  reset() {
    this.chunks = [];
    this.totalSamples = 0;
    this.speechSamples = 0;
    this.trailingSilence = 0;
  }

  private cut() {
    const joined = new Float32Array(this.totalSamples);
    let off = 0;
    for (const c of this.chunks) {
      joined.set(c, off);
      off += c.length;
    }
    // Keep a short tail of the pause — natural end-of-phrase, smaller upload.
    const keep = Math.max(
      TARGET_RATE, // never less than 1 s
      joined.length - Math.floor(Math.max(0, this.trailingSilence - 0.3) * TARGET_RATE),
    );
    const seg = joined.subarray(0, Math.min(keep, joined.length));
    const durationSec = seg.length / TARGET_RATE;
    this.reset();
    this.onSegment(encodeWav16kMono(seg), durationSec);
  }
}

/**
 * Ordered transcription queue: segments upload as they are cut, but their text
 * is appended strictly in speaking order, so a slow network can never swap
 * phrase 2 in front of phrase 1.
 */
export class TranscriptQueue {
  private chain: Promise<void> = Promise.resolve();
  private pendingCount = 0;

  constructor(
    private readonly onText: (t: AsrTranscript) => void,
    private readonly onPending: (inFlight: number) => void,
  ) {}

  push(wav: Blob) {
    this.pendingCount++;
    this.onPending(this.pendingCount);
    const work = transcribeWav(wav);
    this.chain = this.chain.then(async () => {
      const r = await work;
      this.pendingCount--;
      this.onPending(this.pendingCount);
      if (r) this.onText(r);
    });
  }

  /** Resolves when every queued segment has reported back. */
  drain(): Promise<void> {
    return this.chain;
  }
}
