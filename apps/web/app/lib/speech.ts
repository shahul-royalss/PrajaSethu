'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Text-to-speech (read a question aloud) ──────────────────────────────────
// Uses the Web Speech API. Voices load ASYNCHRONOUSLY in Chrome — getVoices()
// returns [] until the engine is ready — so speaking must wait for the list, or
// the utterance goes out with no voice and Telugu/Hindi/… questions come out in
// the wrong voice or not at all. loadVoices() resolves once the list is real.
let voicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearInterval(poll);
        clearTimeout(deadline);
        resolve(synth.getVoices());
      };
      synth.addEventListener?.('voiceschanged', finish, { once: true });
      synth.onvoiceschanged = finish;
      // Some engines never fire voiceschanged — poll briefly, then give up and
      // let speak() proceed with u.lang alone (works on e.g. Android WebView).
      const poll = setInterval(() => synth.getVoices().length && finish(), 250);
      const deadline = setTimeout(finish, 2500);
    });
  }
  return voicesPromise;
}

// Voice tags vary: "te-IN", "te_IN", "te" — compare case-insensitively on both
// the full tag and the base language.
const normTag = (tag: string) => tag.toLowerCase().replace(/_/g, '-');

function pickVoice(voices: SpeechSynthesisVoice[], langTag: string): SpeechSynthesisVoice | undefined {
  const want = normTag(langTag);
  const base = want.split('-')[0];
  return (
    voices.find((v) => normTag(v.lang) === want) ||
    voices.find((v) => {
      const l = normTag(v.lang);
      return l === base || l.startsWith(`${base}-`);
    }) ||
    undefined
  );
}

/** True if this device has an installed voice for the language (async — waits for the voice list). */
export async function hasVoiceFor(langTag: string): Promise<boolean> {
  const voices = await loadVoices();
  return !!pickVoice(voices, langTag);
}

export function speak(text: string, langTag: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  loadVoices().then((voices) => {
    try {
      synth.cancel(); // stop anything already playing → repeatable
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langTag;
      u.rate = 0.92; // a touch slower for clarity / low-literacy users
      const voice = pickVoice(voices, langTag);
      if (voice) u.voice = voice;
      let finished = false;
      const finish = () => {
        if (!finished) {
          finished = true;
          onEnd?.();
        }
      };
      u.onend = finish;
      // Also finish on error (e.g. language-unavailable) so the UI never sticks
      // on "playing" when the engine silently refuses the language.
      u.onerror = finish;
      // Chrome can swallow an utterance queued in the same tick as cancel().
      setTimeout(() => {
        try {
          synth.speak(u);
        } catch {
          finish();
        }
      }, 60);
    } catch {
      onEnd?.();
    }
  });
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

/**
 * Read-aloud hook with live state, so a button can show "playing" and the user
 * can replay a question as many times as they need (tap toggles play/stop).
 */
export function useSpeak() {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  const play = useCallback((text: string, langTag: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, langTag, () => setSpeaking(false));
  }, []);
  return { speaking, play, stop: () => { stopSpeaking(); setSpeaking(false); } };
}

/**
 * Whether the device can speak the given language: true/false once known,
 * null while the voice list is still loading. Lets a page explain WHY nothing
 * is heard (e.g. no Telugu voice installed) instead of failing silently.
 */
export function useVoiceSupport(langTag: string): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    setAvailable(null);
    hasVoiceFor(langTag).then((ok) => {
      if (alive) setAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, [langTag]);
  return available;
}

// ── Speech-to-text (let the citizen speak their answer) ─────────────────────
export type MicStatus = 'idle' | 'listening' | 'denied' | 'error' | 'unsupported';

/**
 * Speech recognition in the citizen's chosen language. `recognition.lang` is set
 * to the BCP-47 tag (e.g. te-IN) so the transcript comes back in the NATIVE
 * SCRIPT. Interim results stream live, and microphone-permission / no-speech
 * errors surface as a clear status instead of failing silently.
 */
/**
 * CONTINUOUS speech recognition that runs alongside the MediaRecorder during a
 * voice complaint: it streams a live transcript (for the silent language badge
 * + the working text sent to the AI) while the recording itself never stops
 * until the citizen presses Stop. Auto-restarts on the engine's internal
 * timeouts so the transcript keeps flowing for long recordings.
 */
export function useContinuousTranscript(langTag: string) {
  const [supported, setSupported] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const recRef = useRef<any>(null);
  const runningRef = useRef(false);
  const langRef = useRef(langTag);
  langRef.current = langTag;

  useEffect(() => {
    const SR =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    setSupported(!!SR);
  }, []);

  const spin = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || !runningRef.current) return;
    try {
      const rec = new SR();
      rec.lang = langRef.current;
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let interimNow = '';
        let finalNow = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalNow += r[0].transcript;
          else interimNow += r[0].transcript;
        }
        if (finalNow) setFinalText((prev) => (prev ? prev + ' ' : '') + finalNow.trim());
        setInterim(interimNow);
      };
      // The engine stops itself periodically (and on brief silences) — restart
      // quietly so the citizen is never interrupted.
      rec.onend = () => {
        setInterim('');
        if (runningRef.current) setTimeout(() => spin(), 120);
      };
      rec.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') runningRef.current = false;
      };
      recRef.current = rec;
      rec.start();
    } catch {
      /* transcript is progressive enhancement — audio is the evidence */
    }
  }, []);

  const begin = useCallback(() => {
    setFinalText('');
    setInterim('');
    runningRef.current = true;
    spin();
  }, [spin]);

  const end = useCallback(() => {
    runningRef.current = false;
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
  }, []);

  useEffect(() => () => { runningRef.current = false; try { recRef.current?.stop(); } catch { /* no-op */ } }, []);

  return { supported, finalText, interim, begin, end, setFinalText };
}

export function useSpeechInput(
  langTag: string,
  onFinal: (text: string) => void,
  onInterim?: (text: string) => void,
) {
  const [status, setStatus] = useState<MicStatus>('idle');
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);
  const finalRef = useRef(onFinal);
  const interimRef = useRef(onInterim);
  finalRef.current = onFinal;
  interimRef.current = onInterim;

  useEffect(() => {
    const SR =
      (typeof window !== 'undefined' &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    setSupported(!!SR);
    if (!SR) setStatus('unsupported');
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
    setStatus((s) => (s === 'listening' ? 'idle' : s));
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setStatus('unsupported');
      return;
    }
    try {
      const rec = new SR();
      rec.lang = langTag;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let interim = '';
        let final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) final += r[0].transcript;
          else interim += r[0].transcript;
        }
        if (interim && interimRef.current) interimRef.current(interim);
        if (final) finalRef.current(final.trim());
      };
      rec.onerror = (e: any) => {
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') setStatus('denied');
        else if (e?.error === 'no-speech' || e?.error === 'aborted') setStatus('idle');
        else setStatus('error');
      };
      rec.onend = () => setStatus((s) => (s === 'listening' ? 'idle' : s));
      recRef.current = rec;
      setStatus('listening');
      rec.start();
    } catch {
      setStatus('error');
    }
  }, [langTag]);

  return { supported, status, listening: status === 'listening', start, stop };
}
