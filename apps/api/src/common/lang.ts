/**
 * Automatic language detection (Saarthi 2.0 §4.4/§5) — Unicode-script analysis
 * over all 22 Eighth-Schedule languages + English. The citizen never picks a
 * language: we detect the script of what they typed (or what the device ASR
 * produced) and carry `{lang, confidence, codeSwitched}` with the ticket.
 *
 * Script → language is unambiguous for most Indic scripts (Telugu, Tamil,
 * Kannada, Malayalam, Gujarati, Gurmukhi, Odia, Ol Chiki, Meitei Mayek).
 * Devanagari (hi/mr/ne/sa/…) and Bengali-script (bn/as) inputs are
 * disambiguated with lightweight lexical cues; Perso-Arabic defaults to Urdu.
 * Latin-script Indic (romanised Telugu etc.) is detected by stop-word cues.
 * The production path swaps this for Bhashini ALD behind the same signature.
 */

export interface LangDetection {
  lang: string; // ISO 639-1/2 code
  script: string;
  confidence: number; // 0..1
  codeSwitched: boolean;
}

interface ScriptRange {
  script: string;
  lang: string;
  from: number;
  to: number;
}

const RANGES: ScriptRange[] = [
  { script: 'Telugu', lang: 'te', from: 0x0c00, to: 0x0c7f },
  { script: 'Devanagari', lang: 'hi', from: 0x0900, to: 0x097f },
  { script: 'Bengali', lang: 'bn', from: 0x0980, to: 0x09ff }, // also Assamese
  { script: 'Tamil', lang: 'ta', from: 0x0b80, to: 0x0bff },
  { script: 'Kannada', lang: 'kn', from: 0x0c80, to: 0x0cff },
  { script: 'Malayalam', lang: 'ml', from: 0x0d00, to: 0x0d7f },
  { script: 'Gujarati', lang: 'gu', from: 0x0a80, to: 0x0aff },
  { script: 'Gurmukhi', lang: 'pa', from: 0x0a00, to: 0x0a7f },
  { script: 'Odia', lang: 'or', from: 0x0b00, to: 0x0b7f },
  { script: 'Perso-Arabic', lang: 'ur', from: 0x0600, to: 0x06ff }, // Urdu / Sindhi / Kashmiri
  { script: 'Perso-Arabic', lang: 'ur', from: 0x0750, to: 0x077f },
  { script: 'Ol Chiki', lang: 'sat', from: 0x1c50, to: 0x1c7f }, // Santali
  { script: 'Meitei Mayek', lang: 'mni', from: 0xabc0, to: 0xabff }, // Manipuri
];

// Lexical cues to split languages that share a script.
const DEVANAGARI_CUES: { lang: string; words: RegExp }[] = [
  { lang: 'mr', words: /(आहे|आम्ही|तुम्ही|मराठी|झाले|पाहिजे|कृपया)/ },
  { lang: 'ne', words: /(छ|छन्|गर्नुहोस्|नेपाली|हामी|तपाईं)/ },
  { lang: 'sa', words: /(अस्ति|भवति|संस्कृत|नमः)/ },
  { lang: 'mai', words: /(अछि|छैक|मैथिली)/ },
  { lang: 'brx', words: /(बड़ो|आं|नों)/ }, // Bodo
  { lang: 'doi', words: /(डोगरी|असां|तुसां)/ },
  { lang: 'kok', words: /(कोंकणी|आसा|तुमी)/ },
];
const BENGALI_CUES: { lang: string; words: RegExp }[] = [{ lang: 'as', words: /(আছে|কৰা|অসমীয়া|আমাৰ|কৰক)/ }];

// Romanised-Indic cues (Latin script but an Indian language) — common function
// words that don't occur in English.
const ROMAN_CUES: { lang: string; words: RegExp }[] = [
  { lang: 'te', words: /\b(undi|ledu|kavali|cheyandi|lo|unnai|avuthundi|randi|nenu|memu|maku|natho|pampandi|cheppandi|roju|rojula|nundi|varaku|intlo|oorilo|pani|nillu|neellu|current|karentu)\b/i },
  { lang: 'hi', words: /\b(hai|nahi|nahin|kripya|karo|kijiye|hamare|humare|mera|meri|apna|gaon|paani|bijli|sadak|dinon|se|tak|mein|ko|ka|ki|ke|par)\b/i },
  { lang: 'ta', words: /\b(illai|irukku|venum|seyyunga|enga|namma|thanni|salai|naal)\b/i },
];

export function detectLanguage(text: string): LangDetection {
  const t = (text || '').trim();
  if (!t) return { lang: 'en', script: 'Latin', confidence: 0.3, codeSwitched: false };

  // Count letters per script.
  const counts = new Map<string, number>();
  let latin = 0;
  let letters = 0;
  for (const ch of t) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) {
      latin++;
      letters++;
      continue;
    }
    const r = RANGES.find((x) => cp >= x.from && cp <= x.to);
    if (r) {
      counts.set(r.script, (counts.get(r.script) ?? 0) + 1);
      letters++;
    }
  }
  if (letters === 0) return { lang: 'en', script: 'Latin', confidence: 0.3, codeSwitched: false };

  let bestScript = 'Latin';
  let bestCount = latin;
  for (const [script, n] of counts) {
    if (n > bestCount) {
      bestScript = script;
      bestCount = n;
    }
  }
  const share = bestCount / letters;
  const secondary = [...counts.entries()].filter(([s]) => s !== bestScript).reduce((a, [, n]) => a + n, 0) + (bestScript === 'Latin' ? 0 : latin);
  // Code-switching (very common: Telugu + English) — a real secondary share.
  const codeSwitched = secondary / letters >= 0.15 && letters >= 12;

  if (bestScript === 'Latin') {
    for (const cue of ROMAN_CUES) {
      if (cue.words.test(t)) {
        return { lang: cue.lang, script: 'Latin (romanised)', confidence: 0.72, codeSwitched };
      }
    }
    return { lang: 'en', script: 'Latin', confidence: Math.min(0.5 + share * 0.45, 0.95), codeSwitched };
  }

  let lang = RANGES.find((r) => r.script === bestScript)!.lang;
  if (bestScript === 'Devanagari') {
    for (const cue of DEVANAGARI_CUES) if (cue.words.test(t)) { lang = cue.lang; break; }
  } else if (bestScript === 'Bengali') {
    for (const cue of BENGALI_CUES) if (cue.words.test(t)) { lang = cue.lang; break; }
  }

  return { lang, script: bestScript, confidence: Math.min(0.6 + share * 0.39, 0.99), codeSwitched };
}

/** Human-readable native + English name for a detected code (UI labels). */
export const LANG_NAMES: Record<string, { en: string; native: string }> = {
  en: { en: 'English', native: 'English' },
  te: { en: 'Telugu', native: 'తెలుగు' },
  hi: { en: 'Hindi', native: 'हिन्दी' },
  bn: { en: 'Bengali', native: 'বাংলা' },
  as: { en: 'Assamese', native: 'অসমীয়া' },
  ta: { en: 'Tamil', native: 'தமிழ்' },
  kn: { en: 'Kannada', native: 'ಕನ್ನಡ' },
  ml: { en: 'Malayalam', native: 'മലയാളം' },
  gu: { en: 'Gujarati', native: 'ગુજરાતી' },
  pa: { en: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  or: { en: 'Odia', native: 'ଓଡ଼ିଆ' },
  mr: { en: 'Marathi', native: 'मराठी' },
  ur: { en: 'Urdu', native: 'اُردُو' },
  ne: { en: 'Nepali', native: 'नेपाली' },
  sa: { en: 'Sanskrit', native: 'संस्कृतम्' },
  mai: { en: 'Maithili', native: 'मैथिली' },
  sat: { en: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  mni: { en: 'Manipuri', native: 'ꯃꯤꯇꯩꯂꯣꯟ' },
  brx: { en: 'Bodo', native: 'बड़ो' },
  doi: { en: 'Dogri', native: 'डोगरी' },
  kok: { en: 'Konkani', native: 'कोंकणी' },
  sd: { en: 'Sindhi', native: 'سنڌي' },
  ks: { en: 'Kashmiri', native: 'كٲشُر' },
};

export function langName(code?: string | null): { en: string; native: string } {
  return LANG_NAMES[code ?? ''] ?? { en: code ?? 'Unknown', native: code ?? '—' };
}
