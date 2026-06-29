'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Text-to-speech (read a question aloud) ──────────────────────────────────
// Uses the Web Speech API. Degrades silently if the device has no voice for the
// language. Voices can load asynchronously, so we wait for them once.
let voicesReady = false;
function ensureVoices() {
  if (voicesReady || typeof window === 'undefined' || !window.speechSynthesis) return;
  voicesReady = true;
  // Trigger async voice load on browsers that need it (Chrome).
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
}

function pickVoice(langTag: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const base = langTag.split('-')[0];
  return (
    voices.find((v) => v.lang === langTag) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(base)) ||
    undefined
  );
}

export function speak(text: string, langTag: string, onEnd?: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  ensureVoices();
  try {
    window.speechSynthesis.cancel(); // stop anything already playing → repeatable
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langTag;
    u.rate = 0.92; // a touch slower for clarity / low-literacy users
    const voice = pickVoice(langTag);
    if (voice) u.voice = voice;
    if (onEnd) u.onend = onEnd;
    window.speechSynthesis.speak(u);
  } catch {
    /* no-op */
  }
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

// ── Speech-to-text (let the citizen speak their answer) ─────────────────────
export type MicStatus = 'idle' | 'listening' | 'denied' | 'error' | 'unsupported';

/**
 * Speech recognition in the citizen's chosen language. `recognition.lang` is set
 * to the BCP-47 tag (e.g. te-IN) so the transcript comes back in the NATIVE
 * SCRIPT. Interim results stream live, and microphone-permission / no-speech
 * errors surface as a clear status instead of failing silently.
 */
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
