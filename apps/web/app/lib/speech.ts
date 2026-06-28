'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Text-to-speech (read a question aloud) using the Web Speech API. Degrades
// silently if the browser/device has no voice for the language.
export function speak(text: string, langTag: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langTag;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang === langTag || v.lang.startsWith(langTag.split('-')[0]));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    /* no-op */
  }
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
}

// Speech-to-text (let the citizen speak their answer). Returns {supported, listening,
// start, stop, transcript}. Uses webkitSpeechRecognition where available.
export function useSpeechInput(langTag: string, onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR = (typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) || null;
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = langTag;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const text = e.results?.[0]?.[0]?.transcript ?? '';
        if (text) onResult(text);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      recRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  }, [langTag, onResult]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}
