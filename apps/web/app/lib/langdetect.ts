// Live client-side language detection (Saarthi 2.0 §3-§5) — Unicode-script
// analysis that runs AS THE CITIZEN TYPES or speaks, powering the passive
// "Detected: తెలుగు Telugu · 98%" badge. Mirrors the server detector
// (apps/api/src/common/lang.ts); the server re-runs detection on the full text
// as the authority. No language picker anywhere — this is the whole point.

export interface ClientLangDetection {
  lang: string;
  script: string;
  nameEn: string;
  nameNative: string;
  confidence: number;
  codeSwitched: boolean;
  speech: string; // BCP-47 tag for SpeechRecognition / TTS
}

const RANGES: { script: string; lang: string; from: number; to: number }[] = [
  { script: 'Telugu', lang: 'te', from: 0x0c00, to: 0x0c7f },
  { script: 'Devanagari', lang: 'hi', from: 0x0900, to: 0x097f },
  { script: 'Bengali', lang: 'bn', from: 0x0980, to: 0x09ff },
  { script: 'Tamil', lang: 'ta', from: 0x0b80, to: 0x0bff },
  { script: 'Kannada', lang: 'kn', from: 0x0c80, to: 0x0cff },
  { script: 'Malayalam', lang: 'ml', from: 0x0d00, to: 0x0d7f },
  { script: 'Gujarati', lang: 'gu', from: 0x0a80, to: 0x0aff },
  { script: 'Gurmukhi', lang: 'pa', from: 0x0a00, to: 0x0a7f },
  { script: 'Odia', lang: 'or', from: 0x0b00, to: 0x0b7f },
  { script: 'Perso-Arabic', lang: 'ur', from: 0x0600, to: 0x06ff },
  { script: 'Ol Chiki', lang: 'sat', from: 0x1c50, to: 0x1c7f },
  { script: 'Meitei Mayek', lang: 'mni', from: 0xabc0, to: 0xabff },
];

const NAMES: Record<string, { en: string; native: string; speech: string }> = {
  en: { en: 'English', native: 'English', speech: 'en-IN' },
  te: { en: 'Telugu', native: 'తెలుగు', speech: 'te-IN' },
  hi: { en: 'Hindi', native: 'हिन्दी', speech: 'hi-IN' },
  bn: { en: 'Bengali', native: 'বাংলা', speech: 'bn-IN' },
  ta: { en: 'Tamil', native: 'தமிழ்', speech: 'ta-IN' },
  kn: { en: 'Kannada', native: 'ಕನ್ನಡ', speech: 'kn-IN' },
  ml: { en: 'Malayalam', native: 'മലയാളം', speech: 'ml-IN' },
  gu: { en: 'Gujarati', native: 'ગુજરાતી', speech: 'gu-IN' },
  pa: { en: 'Punjabi', native: 'ਪੰਜਾਬੀ', speech: 'pa-IN' },
  or: { en: 'Odia', native: 'ଓଡ଼ିଆ', speech: 'or-IN' },
  mr: { en: 'Marathi', native: 'मराठी', speech: 'mr-IN' },
  ur: { en: 'Urdu', native: 'اُردُو', speech: 'ur-IN' },
  ne: { en: 'Nepali', native: 'नेपाली', speech: 'ne-NP' },
  as: { en: 'Assamese', native: 'অসমীয়া', speech: 'as-IN' },
  sat: { en: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', speech: 'sat-IN' },
  mni: { en: 'Manipuri', native: 'ꯃꯤꯇꯩꯂꯣꯟ', speech: 'mni-IN' },
};

const MARATHI_CUES = /(आहे|आम्ही|तुम्ही|मराठी|झाले|पाहिजे)/;
const NEPALI_CUES = /(छ|छन्|गर्नुहोस्|नेपाली|तपाईं)/;
const ASSAMESE_CUES = /(আছে|কৰা|অসমীয়া|কৰক)/;
const ROMAN_TE = /\b(undi|ledu|kavali|cheyandi|unnai|randi|nenu|memu|maku|cheppandi|neellu|nillu|karentu|oorilo|intlo|pani)\b/i;
const ROMAN_HI = /\b(hai|nahi|nahin|kripya|kijiye|hamare|mera|meri|gaon|paani|bijli|sadak)\b/i;

export function detectClientLanguage(text: string): ClientLangDetection | null {
  const t = (text || '').trim();
  if (t.length < 3) return null;

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
  if (!letters) return null;

  let bestScript = 'Latin';
  let bestCount = latin;
  for (const [script, n] of counts) {
    if (n > bestCount) {
      bestScript = script;
      bestCount = n;
    }
  }
  const share = bestCount / letters;
  const secondary =
    [...counts.entries()].filter(([s]) => s !== bestScript).reduce((a, [, n]) => a + n, 0) +
    (bestScript === 'Latin' ? 0 : latin);
  const codeSwitched = secondary / letters >= 0.15 && letters >= 12;

  let lang: string;
  let confidence: number;
  if (bestScript === 'Latin') {
    if (ROMAN_TE.test(t)) {
      lang = 'te';
      confidence = 0.72;
      bestScript = 'Latin (romanised)';
    } else if (ROMAN_HI.test(t)) {
      lang = 'hi';
      confidence = 0.7;
      bestScript = 'Latin (romanised)';
    } else {
      lang = 'en';
      confidence = Math.min(0.5 + share * 0.45, 0.95);
    }
  } else {
    lang = RANGES.find((r) => r.script === bestScript)!.lang;
    if (bestScript === 'Devanagari') {
      if (MARATHI_CUES.test(t)) lang = 'mr';
      else if (NEPALI_CUES.test(t)) lang = 'ne';
    } else if (bestScript === 'Bengali' && ASSAMESE_CUES.test(t)) {
      lang = 'as';
    }
    confidence = Math.min(0.6 + share * 0.39, 0.99);
  }

  const names = NAMES[lang] ?? { en: lang, native: lang, speech: `${lang}-IN` };
  return {
    lang,
    script: bestScript,
    nameEn: names.en,
    nameNative: names.native,
    confidence: Number(confidence.toFixed(2)),
    codeSwitched,
    speech: names.speech,
  };
}

/** The 22 scheduled languages + English, for the quiet coverage strip (§3). */
export const ALL_LANGUAGES_STRIP = [
  'తెలుగు', 'हिन्दी', 'English', 'বাংলা', 'தமிழ்', 'मराठी', 'ಕನ್ನಡ', 'മലയാളം', 'ગુજરાતી',
  'ਪੰਜਾਬੀ', 'ଓଡ଼ିଆ', 'অসমীয়া', 'اُردُو', 'कोंकणी', 'मैथिली', 'नेपाली', 'बड़ो', 'डोगरी',
  'كٲشُر', 'سنڌي', 'संस्कृतम्', 'ᱥᱟᱱᱛᱟᱲᱤ', 'ꯃꯤꯇꯩꯂꯣꯟ',
];
