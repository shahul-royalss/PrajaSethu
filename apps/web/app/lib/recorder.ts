'use client';

// Continuous voice recorder (Saarthi 2.0 §4.1 — the recording contract):
//  · single tap to start · NO silence auto-stop · NO VAD cutoff · NO surprise
//    max-length — recording ends only when the citizen presses Stop.
//  · live waveform + elapsed timer (Web Audio analyser)
//  · citizen-controlled pause/resume
//  · a configurable safety ceiling (default 10:00) purely as an abuse/storage
//    guard, with an advisory warning at 8:00 and a visible countdown — the cap
//    never fires without warning.
// The ORIGINAL audio blob is preserved untouched and uploaded as evidence.

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'denied' | 'error';

export interface RecorderState {
  status: RecorderStatus;
  elapsedSec: number;
  /** 0..1 levels for the live waveform (rolling window, newest last). */
  levels: number[];
  blob: Blob | null;
  mime: string;
  url: string | null;
  warning: boolean; // advisory (8:00) fired
  remainingSec: number | null; // visible countdown inside the last 30 s
}

const CAP_SEC = 600; // 10:00 safety ceiling (§4.1)
const WARN_SEC = 480; // advisory toast at 8:00
const COUNTDOWN_SEC = 30;
const WAVE_BARS = 48;

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const ladder = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const m of ladder) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* keep trying */
    }
  }
  return '';
}

/**
 * @param onPcm Optional raw-PCM tap fed from the same Web-Audio graph as the
 * waveform. Used by server-side ASR (lib/asr.ts) to build WAV segments while
 * the evidence recording (compact webm/opus) continues untouched. Never fires
 * while paused.
 */
export function useVoiceRecorder(onPcm?: (samples: Float32Array, sampleRate: number) => void) {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(WAVE_BARS).fill(0.05));
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [warning, setWarning] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>('audio/webm');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const onPcmRef = useRef(onPcm);
  onPcmRef.current = onPcm;
  // Invalidates a start() still awaiting getUserMedia when reset()/unmount
  // happens first — otherwise the late-resolving start would leave an orphan
  // recorder + open mic behind a fresh (or dead) component.
  const startGenRef = useRef(0);
  const rafRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const pausedAccumRef = useRef(0);
  const pausedAtRef = useRef(0);
  const urlRef = useRef<string | null>(null);

  const cleanupAudio = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      procRef.current?.disconnect();
    } catch {
      /* already gone */
    }
    procRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(
    () => () => {
      startGenRef.current++;
      cleanupAudio();
      try {
        mediaRef.current?.state !== 'inactive' && mediaRef.current?.stop();
      } catch {
        /* already stopped */
      }
      mediaRef.current = null; // a late onstop must not touch dead state
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [cleanupAudio],
  );

  const drawLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const step = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      setLevels((prev) => [...prev.slice(1), Math.max(0.05, Math.min(1, peak * 1.6))]);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const stop = useCallback(() => {
    const rec = mediaRef.current;
    if (!rec || rec.state === 'inactive') return;
    try {
      rec.stop();
    } catch {
      /* no-op */
    }
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus('error');
      return;
    }
    const gen = ++startGenRef.current;
    setStatus('requesting');
    setBlob(null);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setUrl(null);
    setWarning(false);
    setRemainingSec(null);
    setElapsedSec(0);
    setLevels(Array(WAVE_BARS).fill(0.05));
    chunksRef.current = [];
    pausedAccumRef.current = 0;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1, sampleRate: 48000 },
      });
    } catch (e) {
      setStatus((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error');
      return;
    }
    // reset()/unmount happened while the permission prompt was up — release the
    // mic and walk away instead of resurrecting a dead recording session.
    if (gen !== startGenRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const mime = pickMime();
    mimeRef.current = mime || 'audio/webm';
    let rec: MediaRecorder;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(stream);
    } catch {
      rec = new MediaRecorder(stream);
    }
    mediaRef.current = rec;

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      if (mediaRef.current !== rec) return; // superseded by reset()/unmount
      const out = new Blob(chunksRef.current, { type: mimeRef.current });
      setBlob(out);
      const u = URL.createObjectURL(out);
      urlRef.current = u;
      setUrl(u);
      setStatus('stopped');
      cleanupAudio();
    };

    // Live waveform.
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      // Raw-PCM tap for server-side ASR. ScriptProcessor must be connected to
      // the destination to fire; it outputs silence (we never write to the
      // output buffer), so nothing is audible.
      if (onPcmRef.current) {
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        proc.onaudioprocess = (ev) => {
          if (!onPcmRef.current) return;
          if (mediaRef.current?.state !== 'recording') return; // skip pauses
          const ch = ev.inputBuffer.getChannelData(0);
          onPcmRef.current(new Float32Array(ch), ev.inputBuffer.sampleRate);
        };
        src.connect(proc);
        proc.connect(ctx.destination);
        procRef.current = proc;
      }
      drawLoop();
    } catch {
      /* waveform is progressive enhancement */
    }

    startedAtRef.current = Date.now();
    // 5 s chunk cadence → a network drop never loses more than the tail (§4.2).
    rec.start(5000);
    setStatus('recording');

    tickRef.current = setInterval(() => {
      const r = mediaRef.current;
      if (!r || r.state === 'inactive') return;
      if (r.state === 'paused') return;
      const sec = Math.floor((Date.now() - startedAtRef.current - pausedAccumRef.current) / 1000);
      setElapsedSec(sec);
      if (sec >= WARN_SEC) setWarning(true);
      if (sec >= CAP_SEC - COUNTDOWN_SEC) setRemainingSec(Math.max(0, CAP_SEC - sec));
      if (sec >= CAP_SEC) stop(); // announced ceiling — never a surprise
    }, 500);
  }, [cleanupAudio, drawLoop, stop]);

  const pause = useCallback(() => {
    const rec = mediaRef.current;
    if (rec?.state === 'recording') {
      rec.pause();
      pausedAtRef.current = Date.now();
      setStatus('paused');
    }
  }, []);

  const resume = useCallback(() => {
    const rec = mediaRef.current;
    if (rec?.state === 'paused') {
      pausedAccumRef.current += Date.now() - pausedAtRef.current;
      rec.resume();
      setStatus('recording');
    }
  }, []);

  const reset = useCallback(() => {
    startGenRef.current++; // invalidate any start() still awaiting the mic
    try {
      mediaRef.current?.state !== 'inactive' && mediaRef.current?.stop();
    } catch {
      /* no-op */
    }
    cleanupAudio();
    mediaRef.current = null;
    chunksRef.current = [];
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setBlob(null);
    setUrl(null);
    setElapsedSec(0);
    setWarning(false);
    setRemainingSec(null);
    setLevels(Array(WAVE_BARS).fill(0.05));
    setStatus('idle');
  }, [cleanupAudio]);

  return {
    status,
    elapsedSec,
    levels,
    blob,
    url,
    mime: mimeRef.current,
    warning,
    remainingSec,
    capSec: CAP_SEC,
    start,
    stop,
    pause,
    resume,
    reset,
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
  return dataUrl.split(',')[1] ?? '';
}

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
