export interface Lang {
  code: string;
  label: string; // English label
  native: string; // endonym
  dir: 'ltr' | 'rtl';
  // BCP-47 tag for Web Speech (ASR/TTS) where supported.
  speech: string;
}

// 12 major Indian languages (English + 11). Extensible — add a row + translations.
export const LANGUAGES: Lang[] = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr', speech: 'en-IN' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', dir: 'ltr', speech: 'hi-IN' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', dir: 'ltr', speech: 'te-IN' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', dir: 'ltr', speech: 'ta-IN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', dir: 'ltr', speech: 'kn-IN' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', dir: 'ltr', speech: 'ml-IN' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', dir: 'ltr', speech: 'bn-IN' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', dir: 'ltr', speech: 'mr-IN' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', dir: 'ltr', speech: 'gu-IN' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', dir: 'ltr', speech: 'pa-IN' },
  { code: 'or', label: 'Odia', native: 'ଓଡ଼ିଆ', dir: 'ltr', speech: 'or-IN' },
  { code: 'ur', label: 'Urdu', native: 'اردو', dir: 'rtl', speech: 'ur-IN' },
];

export const DEFAULT_LANG = 'en';

export function langByCode(code: string): Lang {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
