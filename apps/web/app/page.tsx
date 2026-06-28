'use client';

import Link from 'next/link';
import { useI18n } from './lib/intl';
import { LANGUAGES } from './lib/intl/languages';
import { LanguageSwitcher } from './components/LanguageSwitcher';

export default function HomePage() {
  const { t, setLang, lang } = useI18n();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white" aria-hidden>ప</span>
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-slate-900">{t('appName')}</div>
              <div className="text-[11px] text-slate-500">Andhra Pradesh · Pilot</div>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand-light to-teal-500" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 text-white sm:px-6 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t('appName')}</h1>
          <p className="mt-2 max-w-2xl text-teal-50 sm:text-lg">{t('tagline')}</p>

          {/* Language quick-pick — first thing a citizen sees */}
          <div className="mt-6 rounded-2xl bg-white/10 p-4 backdrop-blur">
            <div className="mb-2 text-sm font-medium text-teal-50">🌐 {t('selectLanguage')}</div>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    l.code === lang ? 'bg-white text-brand' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Two doors */}
      <main className="mx-auto -mt-8 max-w-6xl px-4 sm:px-6">
        <h2 className="sr-only">{t('whoAreYou')}</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <Link
            href="/citizen"
            className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl" aria-hidden>🧑‍🌾</div>
            <div className="mt-4 text-xl font-bold text-slate-900">{t('citizen')}</div>
            <p className="mt-1 text-slate-600">{t('citizenDesc')}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand group-hover:gap-2">
              {t('openCitizen')} →
            </span>
          </Link>

          <Link
            href="/staff"
            className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-3xl" aria-hidden>🛡️</div>
            <div className="mt-4 text-xl font-bold text-slate-900">{t('official')}</div>
            <p className="mt-1 text-slate-600">{t('officialDesc')}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand group-hover:gap-2">
              {t('openOfficial')} →
            </span>
          </Link>
        </div>

        {/* Why better */}
        <section className="my-10">
          <h3 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-slate-500">{t('whyBetter')}</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '🎙️', k: 'why1' as const },
              { icon: '🛡️', k: 'why2' as const },
              { icon: '✅', k: 'why3' as const },
              { icon: '📲', k: 'why4' as const },
            ].map((c) => (
              <div key={c.k} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-2xl" aria-hidden>{c.icon}</div>
                <p className="mt-2 text-sm text-slate-700">{t(c.k)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
        {t('appName')} · Public Grievance Redressal System · Pilot build for a single mandal.
      </footer>
    </div>
  );
}
