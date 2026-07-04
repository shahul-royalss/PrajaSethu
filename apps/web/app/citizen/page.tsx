'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../lib/intl';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';
import { useSpeak } from '../lib/speech';
import {
  CitizenUser,
  clearCitizenSession,
  getCitizen,
  getCitizenToken,
} from '../lib/session';
import { ListGrievance } from '../lib/types';
import { statusMeta } from '../lib/i18n';

function Brandbar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5">
        <Link href="/">
          <Logo size={32} showSub={false} />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          {right}
        </div>
      </div>
    </header>
  );
}

export default function CitizenPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [citizen, setCitizen] = useState<CitizenUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tk = getCitizenToken();
    const c = getCitizen();
    if (tk && c) {
      setToken(tk);
      setCitizen(c);
      setReady(true);
    } else {
      router.replace('/');
    }
  }, [router]);

  if (!ready || !token || !citizen) return <div className="min-h-screen bg-slate-50" />;

  return (
    <Dashboard
      token={token}
      citizen={citizen}
      onLogout={() => {
        clearCitizenSession();
        router.replace('/');
      }}
    />
  );
}

function Dashboard({ token, citizen, onLogout }: { token: string; citizen: CitizenUser; onLogout: () => void }) {
  const { t, meta } = useI18n();
  const { speaking, play } = useSpeak();
  const [items, setItems] = useState<ListGrievance[] | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<ListGrievance[]>('/grievances/citizen/mine', token));
    } catch {
      setItems([]);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const closed = ['CLOSED', 'RESOLVED'];
    const resolved = list.filter((g) => closed.includes(g.status)).length;
    const needs = list.filter((g) => g.status === 'RESOLVED').length;
    return { open: list.length - resolved, resolved, needs };
  }, [items]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Brandbar right={<button onClick={onLogout} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">{t('logout')}</button>} />

      <main className="mx-auto max-w-4xl px-4 py-6">
        {/* Greeting card */}
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-light p-6 text-white shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-white/70">{t('goodToSee')}</div>
              <h1 className="mt-0.5 text-2xl font-extrabold">{citizen.name} 👋</h1>
              <p className="mt-1 max-w-md text-sm text-white/80">{t('dashboardSubtitle')}</p>
            </div>
            <button
              onClick={() => play(`${t('goodToSee')}, ${citizen.name}. ${t('dashboardSubtitle')}`, meta.speech)}
              className="shrink-0 rounded-xl bg-white/15 px-3 py-2 text-lg backdrop-blur hover:bg-white/25"
              aria-label={t('readAloud')}
            >
              {speaking ? '⏹️' : '🔊'}
            </button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { v: stats.open, k: 'openComplaints' as const },
              { v: stats.resolved, k: 'resolvedComplaints' as const },
              { v: stats.needs, k: 'needsYou' as const },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-white/10 p-3 text-center backdrop-blur">
                <div className="text-2xl font-extrabold">{items === null ? '—' : s.v}</div>
                <div className="text-[11px] text-white/70">{t(s.k)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <h2 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('quickActions')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/citizen/new" className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-2xl" aria-hidden>📝</div>
            <div className="mt-3 text-lg font-bold text-ink">{t('fileNew')}</div>
            <p className="mt-1 text-sm text-slate-600">{t('fileNewDesc')}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-brand group-hover:underline">{t('startHere')} →</span>
          </Link>
          <Link href="/track" className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron/15 text-2xl" aria-hidden>🔎</div>
            <div className="mt-3 text-lg font-bold text-ink">{t('trackTitle')}</div>
            <p className="mt-1 text-sm text-slate-600">{t('trackByNumber')}</p>
            <span className="mt-3 inline-block text-sm font-semibold text-brand group-hover:underline">{t('trackNow')} →</span>
          </Link>
        </div>

        {/* My complaints */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('myComplaints')}</h2>
          {items === null && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">{t('loading')}</div>}
          {items && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-4xl" aria-hidden>🗂️</div>
              <p className="mt-2 text-slate-500">{t('noComplaints')}</p>
              <Link href="/citizen/new" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white">{t('fileNew')}</Link>
            </div>
          )}
          <div className="space-y-2.5">
            {items?.map((g) => {
              const m = statusMeta(g.status);
              return (
                <Link
                  key={g.id}
                  href={`/track/${g.ysr}`}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand/40 hover:shadow-card"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold text-ink">{g.ysr}</div>
                    <div className="truncate text-xs text-slate-500">{g.department ?? '—'} · {g.mandal ?? ''}</div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m.className}`}>
                    <span aria-hidden>{m.icon}</span>
                    {t(('st_' + g.status) as any)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Help */}
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="text-sm font-bold text-ink">📞 {t('helpTitle')}</div>
          <p className="mt-1 text-sm text-slate-600">{t('helpDesc')}</p>
        </section>
      </main>
    </div>
  );
}
