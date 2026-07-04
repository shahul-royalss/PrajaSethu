'use client';

import { useState } from 'react';
import { useI18n } from '../lib/intl';
import { LANGUAGES } from '../lib/intl/languages';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, meta } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        aria-label="Change language"
      >
        <span aria-hidden>🌐</span>
        <span>{compact ? meta.code.toUpperCase() : meta.native}</span>
        <span className="text-slate-400" aria-hidden>▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 max-h-80 w-44 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => {
                  setLang(l.code);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  l.code === lang ? 'font-semibold text-brand' : 'text-slate-700'
                }`}
              >
                <span>{l.native}</span>
                <span className="text-xs text-slate-400">{l.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
