'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, StringKey } from './en';
import { translations } from './translations';
import { DEFAULT_LANG, Lang, langByCode } from './languages';

interface I18nCtx {
  lang: string;
  setLang: (code: string) => void;
  meta: Lang;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE_KEY = 'praja_lang';

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<string>(DEFAULT_LANG);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) setLangState(saved);
  }, []);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, code);
    const meta = langByCode(code);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code;
      document.documentElement.dir = meta.dir;
    }
  }, []);

  useEffect(() => {
    const meta = langByCode(lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
      document.documentElement.dir = meta.dir;
    }
  }, [lang]);

  const t = useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      const dict = translations[lang] ?? {};
      const value = (dict as Record<string, string>)[key] ?? en[key] ?? String(key);
      return interpolate(value, vars);
    },
    [lang],
  );

  const value = useMemo<I18nCtx>(() => ({ lang, setLang, meta: langByCode(lang), t }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

// Convenience: const t = useT();
export function useT() {
  return useI18n().t;
}
