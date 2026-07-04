'use client';

import { useI18n } from '../../lib/intl';

/**
 * Bilingual helper for the console (EN ⇄ తెలుగు, per the prototype). Driven by the
 * global language so the topbar toggle and the citizen-side language stay in sync;
 * any non-Telugu language falls back to English text in the staff console.
 */
export function useBi() {
  const { lang } = useI18n();
  const te = lang === 'te';
  return (en: string, teStr: string) => (te ? teStr : en);
}
