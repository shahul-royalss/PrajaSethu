'use client';

// Citizen dashboard — Saarthi 2.0. Android-first, voice-first: one hero action
// (speak your complaint), live case cards that show WHO is handling each case,
// and honest AI provenance (routed by AI vs verified by an officer).

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

export default function CitizenPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [citizen, setCitizen] = useState<CitizenUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => {
      const tk = getCitizenToken();
      const c = getCitizen();
      if (tk && c) {
        setToken(tk);
        setCitizen(c);
        setReady(true);
      } else {
        router.replace('/');
      }
    };
    check();
    // bfcache restore after logout must not show a dead dashboard.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) check();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, [router]);

  if (!ready || !token || !citizen) return <div className="min-h-screen bg-[#F4F6FB]" />;

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

const STATUS_TONE: Record<string, { bar: string; chip: string; icon: string }> = {
  REGISTERED: { bar: 'bg-slate-300', chip: 'border-slate-200 bg-slate-50 text-slate-600', icon: '📥' },
  PENDING_VERIFICATION: { bar: 'bg-violet-400', chip: 'border-violet-200 bg-violet-50 text-violet-700', icon: '🧑‍⚖️' },
  CLASSIFIED: { bar: 'bg-sky-400', chip: 'border-sky-200 bg-sky-50 text-sky-700', icon: '🗂' },
  ASSIGNED: { bar: 'bg-brand-light', chip: 'border-blue-200 bg-blue-50 text-blue-700', icon: '👮' },
  UNDER_ENQUIRY: { bar: 'bg-amber-400', chip: 'border-amber-200 bg-amber-50 text-amber-700', icon: '🔎' },
  ACTION_TAKEN: { bar: 'bg-teal-400', chip: 'border-teal-200 bg-teal-50 text-teal-700', icon: '🛠' },
  RESOLVED: { bar: 'bg-india', chip: 'border-emerald-200 bg-emerald-50 text-emerald-700', icon: '✅' },
  CLOSED: { bar: 'bg-slate-400', chip: 'border-slate-200 bg-slate-100 text-slate-600', icon: '🔒' },
  QUICK_DESK_REVIEW: { bar: 'bg-fuchsia-400', chip: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700', icon: '⚖️' },
  REOPENED: { bar: 'bg-orange-400', chip: 'border-orange-200 bg-orange-50 text-orange-700', icon: '🔁' },
  ON_HOLD: { bar: 'bg-slate-300', chip: 'border-slate-200 bg-slate-50 text-slate-500', icon: '⏸' },
  MERGED: { bar: 'bg-amber-300', chip: 'border-amber-200 bg-amber-50 text-amber-700', icon: '🤝' },
  REROUTED: { bar: 'bg-slate-300', chip: 'border-slate-200 bg-slate-50 text-slate-500', icon: '↪️' },
  REJECTED: { bar: 'bg-red-300', chip: 'border-red-200 bg-red-50 text-red-600', icon: '⛔' },
};

function Dashboard({ token, citizen, onLogout }: { token: string; citizen: CitizenUser; onLogout: () => void }) {
  const { t, meta, lang } = useI18n();
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
    const done = list.filter((g) => ['CLOSED', 'RESOLVED'].includes(g.status)).length;
    const needs = list.filter((g) => g.status === 'RESOLVED').length;
    return { open: list.length - done, resolved: done, needs };
  }, [items]);

  const firstName = citizen.name.split(/\s+/)[0];

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5 md:max-w-3xl">
          <Logo size={30} showSub={false} />
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              onClick={onLogout}
              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5 md:max-w-3xl">
        {/* hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 p-6 text-white shadow-lift">
          <div
            className="pointer-events-none absolute -right-10 -top-14 h-44 w-44 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(203,160,70,.55), transparent 65%)' }}
            aria-hidden
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[13px] text-white/60">{t('goodToSee')},</div>
              <h1 className="mt-0.5 font-display text-[26px] font-bold leading-tight">{firstName} 🙏</h1>
            </div>
            <button
              onClick={() => play(`${t('goodToSee')}, ${citizen.name}. ${t('dashboardSubtitle')}`, meta.speech)}
              className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-lg backdrop-blur transition hover:bg-white/20"
              aria-label={t('readAloud')}
            >
              {speaking ? '⏹' : '🔊'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { v: stats.open, k: 'openComplaints' as const },
              { v: stats.resolved, k: 'resolvedComplaints' as const },
              { v: stats.needs, k: 'needsYou' as const },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-white/[0.07] px-2 py-3 text-center backdrop-blur">
                <div className="font-display text-[22px] font-bold tabular-nums">{items === null ? '—' : s.v}</div>
                <div className="mt-0.5 text-[11px] leading-tight text-white/55">{t(s.k)}</div>
              </div>
            ))}
          </div>

          {/* the one action that matters — speak */}
          <Link
            href="/citizen/new"
            className="mt-5 flex items-center gap-3.5 rounded-2xl bg-gradient-to-r from-gold-deep/90 to-gold p-4 text-navy-900 shadow-soft transition active:scale-[0.985]"
          >
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-900/90 text-gold">
              <span className="absolute inset-0 animate-ping rounded-full bg-navy-900/20" aria-hidden />
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden>
                <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[16px] font-bold leading-tight">{t('speakComplaint')}</span>
              <span className="mt-0.5 block truncate text-[12px] font-medium text-navy-900/70">{t('speakComplaintHint')}</span>
            </span>
            <span className="ml-auto text-xl" aria-hidden>→</span>
          </Link>
        </section>

        {/* my complaints */}
        <section className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-slate-400">{t('myComplaints')}</h2>
            <Link href="/track" className="text-[13px] font-semibold text-brand">{t('trackByNumber')} →</Link>
          </div>

          {items === null && (
            <div className="space-y-2.5">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
              ))}
            </div>
          )}

          {items && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-4xl" aria-hidden>🗂️</div>
              <p className="mt-2 text-sm text-slate-500">{t('noComplaints')}</p>
              <Link href="/citizen/new" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white">
                {t('fileNew')}
              </Link>
            </div>
          )}

          <div className="space-y-2.5">
            {items?.map((g) => {
              const tone = STATUS_TONE[g.status] ?? STATUS_TONE.REGISTERED;
              return (
                <Link
                  key={g.id}
                  href={`/track/${g.ysr}`}
                  className="group relative block overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-card transition hover:border-brand/30 hover:shadow-soft active:scale-[0.99]"
                >
                  <span className={`absolute inset-y-0 left-0 w-1.5 ${tone.bar}`} aria-hidden />
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] font-bold text-ink">{g.ysr}</span>
                        {g.routedBy === 'AI' && (
                          <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-600">⚡ {t('routedByAi')}</span>
                        )}
                        {(g.reportCount ?? 1) > 1 && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">×{g.reportCount}</span>
                        )}
                      </div>
                      <p className={`mt-1 line-clamp-2 text-[13px] leading-snug text-slate-600 ${lang === 'te' ? 'font-telugu' : ''}`}>
                        {g.issue || g.summaryEn || g.department || '—'}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone.chip}`}>
                      <span aria-hidden>{tone.icon}</span>
                      {t(('st_' + g.status) as any)}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3 text-[12px] text-slate-400">
                    {g.officer ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[9px] font-bold text-brand">
                          {g.officer.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                        <span className="truncate font-medium text-slate-500">{g.officer.name}</span>
                      </span>
                    ) : (
                      <span>{g.department ?? '—'}</span>
                    )}
                    <span className="ml-auto shrink-0">{new Date(g.createdAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* help */}
        <section className="mt-7 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <span className="text-2xl" aria-hidden>📞</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-bold text-ink">{t('helpTitle')}</div>
            <p className="text-[12.5px] text-slate-500">{t('helpDesc')}</p>
          </div>
          <a href="tel:1902" className="ml-auto shrink-0 rounded-xl bg-brand px-4 py-2 font-mono text-sm font-bold text-white">1902</a>
        </section>
      </main>
    </div>
  );
}
