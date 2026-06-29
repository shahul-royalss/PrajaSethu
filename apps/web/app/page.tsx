'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './lib/intl';
import { LANGUAGES } from './lib/intl/languages';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { AuthPanel } from './components/AuthPanel';
import { Logo, LogoMark } from './components/Logo';
import { speak } from './lib/speech';

const LANG_FLAG = 'saarthi_lang_chosen';

export default function HomePage() {
  const { t, setLang, lang, meta } = useI18n();
  const [chosen, setChosen] = useState<boolean | null>(null);

  useEffect(() => {
    setChosen(typeof window !== 'undefined' && !!localStorage.getItem(LANG_FLAG));
  }, []);

  function choose(code: string) {
    setLang(code);
    if (typeof window !== 'undefined') localStorage.setItem(LANG_FLAG, '1');
    setChosen(true);
  }

  if (chosen === null) return <div className="min-h-screen bg-slate-50" />;

  // ── Step 1: choose your language (first thing every citizen sees) ──────────
  if (!chosen) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-50">
        <GovRibbon />
        <div className="pointer-events-none absolute inset-0 bg-gov-mesh" />
        <main className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-3xl flex-col items-center justify-center px-4 py-10">
          <LogoMark size={64} />
          <h1 className="mt-4 text-center text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            {t('startLanguage')}
          </h1>
          <p className="mt-2 max-w-md text-center text-sm text-slate-500">{t('startLanguageHelp')}</p>

          <div className="mt-8 grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => choose(l.code)}
                onMouseEnter={() => speak(l.native, l.speech)}
                className="group flex flex-col items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lift"
              >
                <span className="text-xl font-bold text-ink group-hover:text-brand">{l.native}</span>
                <span className="text-xs text-slate-400">{l.label}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">{t('trustedBy')}</p>
        </main>
      </div>
    );
  }

  // ── Step 2: hero + unified login ──────────────────────────────────────────
  const features = [
    { icon: '🎙️', k: 'why1' as const },
    { icon: '🛡️', k: 'why2' as const },
    { icon: '✅', k: 'why3' as const },
    { icon: '📲', k: 'why4' as const },
  ];
  const trust = [
    { v: '12', k: 'statLanguages' as const },
    { v: '100%', k: 'statTamperProof' as const },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <GovRibbon />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gov-mesh" />

      <header className="relative">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo size={38} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <div className="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left — pitch */}
          <div className="pt-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-3 py-1 text-xs font-semibold text-brand">
              ● {t('liveStats')} · {meta.native}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              {t('appName')}
            </h1>
            <p className="mt-3 max-w-lg text-lg text-slate-600">{t('tagline')}</p>
            <p className="mt-4 max-w-lg text-sm text-slate-500">{t('trustedBy')}</p>

            <div className="mt-7 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
              {trust.map((s) => (
                <div key={s.k} className="rounded-2xl border border-slate-200 bg-white/80 p-3 text-center backdrop-blur">
                  <div className="text-2xl font-extrabold text-brand">{s.v}</div>
                  <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t(s.k)}</div>
                </div>
              ))}
              <div className="col-span-2 flex items-center justify-center gap-2 rounded-2xl border border-india/20 bg-india/5 p-3 text-center">
                <span className="text-lg" aria-hidden>🇮🇳</span>
                <span className="text-xs font-semibold text-india">{t('govOfIndia')}</span>
              </div>
            </div>

            <div className="mt-9 grid gap-3 sm:grid-cols-2">
              {features.map((c) => (
                <div key={c.k} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <span className="text-2xl" aria-hidden>{c.icon}</span>
                  <p className="text-sm text-slate-700">{t(c.k)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — login */}
          <div className="lg:sticky lg:top-6 lg:pt-6">
            <AuthPanel />
            <p className="mt-3 text-center text-xs text-slate-400">{t('helpDesc')}</p>
          </div>
        </div>
      </main>

      <footer className="relative border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-center text-xs text-slate-400 sm:flex-row sm:px-6 sm:text-left">
          <span>© {new Date().getFullYear()} {t('appName')} · {t('govOfIndia')} · Public Grievance Redressal</span>
          <span>Pilot build · single-mandal</span>
        </div>
      </footer>
    </div>
  );
}

function GovRibbon() {
  return (
    <div className="relative z-10 flex items-center justify-center gap-2 bg-ink px-4 py-1 text-center text-[11px] font-medium text-white/80">
      <span className="h-1.5 w-1.5 rounded-full bg-saffron" />
      <span>भारत सरकार · Government of India</span>
      <span className="h-1.5 w-1.5 rounded-full bg-india" />
    </div>
  );
}
