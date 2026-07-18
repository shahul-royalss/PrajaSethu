'use client';

// Server-side ASR client (Saarthi 2.0 §4) — the fix for "I speak Telugu, it
// writes Hindi". Browser SpeechRecognition transcribes in a PRESET language:
// it cannot listen first and decide. When the API has a Sarvam key, raw audio
// goes to the server instead, the spoken language is identified FROM THE AUDIO
// and the transcript comes back in the native script — no picker, no guessing.
//
// The pipeline: the recorder's Web-Audio graph taps raw PCM → PcmSegmenter
// downsamples to 16 kHz mono, watches for natural pauses, and cuts WAV
// segments at silence boundaries → each segment is POSTed to
// /speech/transcribe → native-script text streams into the UI a phrase at a
// time, in speaking order.
//
// Designed so the citizen's words are NEVER lost:
//  · recording starts immediately — segments cut while the server status is
//    still unknown are buffered and transcribed the moment it resolves;
//  · every segment upload retries on transient failure;
//  · repeated hard failures degrade the surface (the caller is told), while
//    the original audio keeps recording untouched as evidence.

import { useCallback, useEffect, useRef, useState } from 'react';
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

// One status probe shared by every voice surface. Successful answers are
// cached for the page's lifetime; failures are NOT — a cold-started API that
// timed out once must not lock the app into fallback mode until reload.
let statusPromise: Promise<AsrStatus> | null = null;

export function asrStatus(): Promise<AsrStatus> {
  if (!statusPromise) {
    statusPromise = api.get<AsrStatus>('/speech/status').catch(() => {
      statusPromise = null; // retry on the next ask
      return { asr: false, provider: null };
    });
  }
  return statusPromise;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Transcribe one WAV segment. Returns the result (possibly with an EMPTY
 * transcript — silence is a valid answer) or THROWS after retries when the
 * service itself is failing, so callers can tell "quiet" from "broken".
 */
export async function transcribeWav(blob: Blob, languageHint?: string): Promise<AsrTranscript> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  const audioBase64 = dataUrl.split(',')[1] ?? '';
  if (!audioBase64) throw new Error('empty audio');
  const delays = [0, 1200, 3000];
  let lastErr: Error = new Error('transcription failed');
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt]) await sleep(delays[attempt]);
    try {
      return await api.post<AsrTranscript>('/speech/transcribe', {
        audioBase64,
        mime: 'audio/wav',
        languageHint,
      });
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr;
}

// ── 16 kHz mono WAV encoding ─────────────────────────────────────────────────
const TARGET_RATE = 16000;

export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_RATE) return input;
  const ratio = inputRate / TARGET_RATE;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  // Average the source window per output sample — a cheap low-pass that avoids
  // the aliasing hiss plain decimation would add to the uploaded speech. When
  // the input rate is BELOW 16 k (8 k telephony mics), windows can be empty —
  // hold the nearest source sample instead of interleaving zeros (which would
  // shred the waveform into inaudible noise).
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : input[Math.min(start, input.length - 1)];
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
// Cuts at natural pauses so words are never split mid-syllable. Tuned for fast
// feedback: the FIRST phrase is cut quickly (so the citizen sees detection
// working within seconds), later phrases at fuller pauses, and a hard ceiling
// keeps every segment inside the STT service's per-request limit. Quiet
// microphones are handled by an adaptive noise floor plus cadence cuts — if
// clean silence never shows up, audio is still shipped on a timer, and flush()
// ships whatever remains, so content is never dropped on the floor.
const MAX_SEGMENT_SEC = 24;
const FIRST_CUT_SPEECH_SEC = 3.5; // early first segment → early feedback
const FIRST_CUT_SILENCE_SEC = 0.55;
const MIN_SPEECH_SEC = 1.2;
const SILENCE_CUT_SEC = 0.9; // a pause this long ends a phrase
const CADENCE_SEC = 12; // with a noisy mic, cut on a relative dip after this long
const CADENCE_SILENCE_SEC = 0.4;
const SILENCE_RMS_MIN = 0.006; // absolute floor: below this is always "quiet"

export class PcmSegmenter {
  private chunks: Float32Array[] = [];
  private totalSamples = 0;
  private speechSamples = 0;
  private trailingSilence = 0; // seconds
  private noiseFloor = 0.003; // adaptive EMA of quiet-frame RMS
  private cutsMade = 0;

  constructor(private readonly onSegment: (wav: Blob, durationSec: number) => void) {}

  /** Feed raw PCM from the recorder tap (any sample rate — resampled here). */
  feed(samples: Float32Array, inputRate: number) {
    const pcm = downsampleTo16k(samples, inputRate);
    let sum = 0;
    for (let i = 0; i < pcm.length; i++) sum += pcm[i] * pcm[i];
    const rms = Math.sqrt(sum / Math.max(1, pcm.length));
    const dur = pcm.length / TARGET_RATE;

    const quiet = rms < Math.max(SILENCE_RMS_MIN, this.noiseFloor * 2.5);
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
    const firstCut = this.cutsMade === 0;
    if (
      (firstCut && speechSec >= FIRST_CUT_SPEECH_SEC && this.trailingSilence >= FIRST_CUT_SILENCE_SEC) ||
      (speechSec >= MIN_SPEECH_SEC && this.trailingSilence >= SILENCE_CUT_SEC) ||
      (totalSec >= CADENCE_SEC && speechSec >= MIN_SPEECH_SEC && this.trailingSilence >= CADENCE_SILENCE_SEC) ||
      totalSec >= MAX_SEGMENT_SEC
    ) {
      this.cut();
    }
  }

  /** Emit whatever is buffered (call on Stop) — never discards real audio.
   *  Ships whenever ANY speech was heard, however brief, or the buffer is long
   *  enough that the quiet-classifier might simply have missed soft speech. */
  flush() {
    if (this.speechSamples > 0 || this.totalSamples / TARGET_RATE >= 0.6) this.cut();
    else this.reset();
  }

  reset() {
    this.chunks = [];
    this.totalSamples = 0;
    this.speechSamples = 0;
    this.trailingSilence = 0;
    this.cutsMade = 0;
  }

  private cut() {
    const joined = new Float32Array(this.totalSamples);
    let off = 0;
    for (const c of this.chunks) {
      joined.set(c, off);
      off += c.length;
    }
    // Keep a short tail of the pause — natural end-of-phrase, smaller upload.
    // The trim is CAPPED at 2 s: with a quiet mic, trailingSilence can span
    // nearly the whole buffer (soft speech misclassified as silence), and an
    // uncapped trim would throw the citizen's words away.
    const trimSec = Math.min(2, Math.max(0, this.trailingSilence - 0.3));
    const keep = Math.max(
      TARGET_RATE, // never less than 1 s
      joined.length - Math.floor(trimSec * TARGET_RATE),
    );
    const seg = joined.subarray(0, Math.min(keep, joined.length));
    const durationSec = seg.length / TARGET_RATE;
    this.cutsMade++; // (full reset() zeroes it; a mid-recording cut keeps it)
    this.chunks = [];
    this.totalSamples = 0;
    this.speechSamples = 0;
    this.trailingSilence = 0;
    this.onSegment(encodeWav16kMono(seg), durationSec);
  }
}

/**
 * Ordered transcription queue: segments upload as they are cut, but their text
 * is appended strictly in speaking order, so a slow network can never swap
 * phrase 2 in front of phrase 1. Distinguishes "silence" (valid, empty) from
 * "service failing" (onError) so the caller can degrade deliberately.
 */
export class TranscriptQueue {
  private chain: Promise<void> = Promise.resolve();
  private pendingCount = 0;

  constructor(
    private readonly onText: (t: AsrTranscript) => void,
    private readonly onPending: (inFlight: number) => void,
    private readonly onError?: (e: Error) => void,
  ) {}

  push(wav: Blob) {
    this.pendingCount++;
    this.onPending(this.pendingCount);
    const work = transcribeWav(wav).then(
      (r) => ({ ok: true as const, r }),
      (e) => ({ ok: false as const, e: e as Error }),
    );
    this.chain = this.chain.then(async () => {
      const out = await work;
      this.pendingCount--;
      this.onPending(this.pendingCount);
      if (out.ok) {
        if (out.r.transcript) this.onText(out.r);
      } else {
        this.onError?.(out.e);
      }
    });
  }

  /** Resolves when every queued segment has reported back. */
  drain(): Promise<void> {
    return this.chain;
  }
}

// ── The shared voice-recognition pipeline hook ───────────────────────────────
// Everything a voice surface needs: feed it PCM from the recorder tap and it
// returns live native-script text + the audio-detected language. Handles the
// whole lifecycle — status probing (without delaying the mic), buffering
// segments cut before the status resolved, ordered transcription, and
// degrading to `serverAsr === false` after repeated hard failures.
export function useAsrPipeline(onDegrade?: (reason: 'no-key' | 'errors') => void) {
  const [serverAsr, setServerAsr] = useState<boolean | null>(null);
  const serverAsrRef = useRef<boolean | null>(null);
  const [text, setText] = useState('');
  const [det, setDet] = useState<AsrTranscript | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const [degraded, setDegraded] = useState(false);

  const genRef = useRef(0);
  const queueRef = useRef<TranscriptQueue | null>(null);
  const segRef = useRef<PcmSegmenter | null>(null);
  const bufferedRef = useRef<Blob[]>([]);
  const errStreakRef = useRef(0);
  const hasTextRef = useRef(false);
  // inFlight = segments in the transcription queue PLUS segments parked while
  // the status probe resolves — both must hold the submit gates, or the user
  // could send before their buffered words come back as text.
  const pendingRef = useRef({ queue: 0, buffered: 0 });
  const onDegradeRef = useRef(onDegrade);
  onDegradeRef.current = onDegrade;

  const publishInFlight = useCallback(() => {
    setInFlight(pendingRef.current.queue + pendingRef.current.buffered);
  }, []);

  const rebuild = useCallback(() => {
    const gen = ++genRef.current; // stale-instance guard across re-records
    errStreakRef.current = 0;
    hasTextRef.current = false;
    bufferedRef.current = [];
    pendingRef.current = { queue: 0, buffered: 0 };
    const queue = new TranscriptQueue(
      (r) => {
        if (genRef.current !== gen) return;
        hasTextRef.current = true;
        errStreakRef.current = 0;
        setText((p) => (p ? p + ' ' : '') + r.transcript);
        if (r.lang) setDet(r);
      },
      (n) => {
        if (genRef.current !== gen) return;
        pendingRef.current.queue = n;
        publishInFlight();
      },
      () => {
        if (genRef.current !== gen) return;
        errStreakRef.current++;
        // Two hard failures with nothing transcribed yet → the service is down
        // or the key is bad. Stop burning uploads; tell the surface to degrade.
        // Latched on the true→false transition so it can only fire once.
        if (errStreakRef.current >= 2 && !hasTextRef.current && serverAsrRef.current === true) {
          serverAsrRef.current = false;
          setServerAsr(false);
          setDegraded(true);
          onDegradeRef.current?.('errors');
        }
      },
    );
    queueRef.current = queue;
    segRef.current = new PcmSegmenter((wav) => {
      if (genRef.current !== gen) return;
      if (serverAsrRef.current === true) {
        queue.push(wav);
      } else if (serverAsrRef.current === null) {
        bufferedRef.current.push(wav); // status pending — parked, still "in flight"
        pendingRef.current.buffered = bufferedRef.current.length;
        publishInFlight();
      }
      // false → drop: fallback recognition owns the transcript now
    });
  }, [publishInFlight]);
  useEffect(() => {
    rebuild();
  }, [rebuild]);

  /** Kick off (or re-check) the status probe. NEVER await this before starting
   *  the mic — segments buffer until it resolves. Safe to call repeatedly:
   *  onDegrade('no-key') fires only on the transition into unavailable, so a
   *  mount-time call and a begin-time call cannot double-start the fallback
   *  recogniser (callers start it directly when the answer is already known). */
  const ensureStatus = useCallback(() => {
    asrStatus().then((s) => {
      if (serverAsrRef.current === false) return; // resolved (or degraded) — nothing new
      const transitionToOff = !s.asr; // current is null or true
      serverAsrRef.current = s.asr;
      setServerAsr(s.asr);
      if (s.asr) {
        // Segments cut while the answer was pending transcribe now, in order.
        const held = bufferedRef.current.splice(0);
        pendingRef.current.buffered = 0;
        held.forEach((wav) => queueRef.current?.push(wav));
        publishInFlight();
      } else {
        bufferedRef.current = [];
        pendingRef.current.buffered = 0;
        publishInFlight();
        if (transitionToOff) onDegradeRef.current?.('no-key');
      }
    });
  }, [publishInFlight]);

  const feed = useCallback((samples: Float32Array, rate: number) => {
    if (serverAsrRef.current !== false) segRef.current?.feed(samples, rate);
  }, []);

  const flush = useCallback(() => {
    if (serverAsrRef.current !== false) segRef.current?.flush();
  }, []);

  const reset = useCallback(() => {
    setText('');
    setDet(null);
    setInFlight(0);
    setDegraded(false);
    // A degraded surface may recover on the next take — re-probe from scratch.
    if (serverAsrRef.current === false) {
      serverAsrRef.current = null;
      setServerAsr(null);
    }
    rebuild();
  }, [rebuild]);

  return { serverAsr, text, det, inFlight, degraded, ensureStatus, feed, flush, reset };
}
