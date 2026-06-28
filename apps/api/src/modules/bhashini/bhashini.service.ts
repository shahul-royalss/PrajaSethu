import { Injectable } from '@nestjs/common';
import { sha256 } from '../../common/util';

/**
 * Bhashini language engine, pilot adapter (Blueprint D.3).
 * Real deployment calls Bhashini/ULCA ASR/NMT/TTS APIs. This mock keeps the SAME
 * interface so the real client is a drop-in: ASR returns a transcript for a voice
 * blob, NMT does light Telugu↔English, TTS returns an audio reference. No external
 * call → the voice-first flow runs offline in the pilot/demo.
 */
@Injectable()
export class BhashiniService {
  // A tiny Telugu→English gloss so officers/analytics see English without a live API.
  private readonly glossary: Record<string, string> = {
    బోరు: 'borewell',
    'పని చేయట్లేదు': 'not working',
    రేషన్: 'ration',
    'రేషన్ కార్డు': 'ration card',
    పెన్షన్: 'pension',
    కరెంటు: 'electricity',
    నీళ్లు: 'water',
    రోడ్డు: 'road',
    భూమి: 'land',
    ఆపండి: 'stopped',
    రాలేదు: 'not received',
    ఊరి: 'village',
    సమస్య: 'problem',
  };

  // Canned transcripts so a recorded blob ref deterministically yields text.
  private readonly cannedTranscripts: Record<string, string> = {
    default: 'మా ఊరి బోరు పని చేయట్లేదు, తాగు నీళ్లకు చాలా ఇబ్బంది అవుతోంది',
  };

  async asr(voiceInputRef: string, language = 'te'): Promise<{ transcript: string; language: string; confidence: number }> {
    const key = Object.keys(this.cannedTranscripts).find((k) => voiceInputRef.includes(k)) ?? 'default';
    return { transcript: this.cannedTranscripts[key], language, confidence: 0.9 };
  }

  async nmt(text: string, from = 'te', to = 'en'): Promise<{ text: string; from: string; to: string }> {
    if (from === to) return { text, from, to };
    let out = text;
    if (from === 'te' && to === 'en') {
      for (const [te, en] of Object.entries(this.glossary)) {
        out = out.split(te).join(en);
      }
      // Strip any remaining Telugu glyphs for a clean (if lossy) English gist.
      out = out.replace(/[ఀ-౿]+/g, '').replace(/\s+/g, ' ').trim();
      if (!out) out = '[Telugu complaint — see original]';
    }
    return { text: out, from, to };
  }

  async tts(text: string, language = 'te'): Promise<{ audioRef: string; language: string }> {
    // Deterministic placeholder reference (a real adapter returns a playable URL).
    return { audioRef: `tts://bhashini/${language}/${sha256(text).slice(0, 12)}.wav`, language };
  }
}
