'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../lib/intl';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

export default function TrackEntry() {
  const router = useRouter();
  const { t } = useI18n();
  const [ysr, setYsr] = useState('');

  function go() {
    const v = ysr.trim();
    if (v) router.push(`/track/${encodeURIComponent(v)}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Link href="/citizen" className="text-sm font-semibold text-slate-700">← {t('appName')}</Link>
          <LanguageSwitcher compact />
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">{t('trackTitle')}</h1>
          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{t('trackByNumber')}</span>
            <input
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
              placeholder="PGRS-AP-2026-000001"
              value={ysr}
              onChange={(e) => setYsr(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && go()}
            />
          </label>
          <button onClick={go} disabled={!ysr.trim()} className="mt-4 w-full rounded-xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-50">
            {t('next')} →
          </button>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            {['PGRS-AP-2026-000001', 'PGRS-AP-2026-000006', 'PGRS-AP-2026-000004'].map((s) => (
              <button key={s} className="mr-2 font-mono text-brand underline" onClick={() => setYsr(s)}>{s}</button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
