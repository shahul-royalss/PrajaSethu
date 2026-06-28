'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../lib/intl';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { api } from '../lib/api';
import { speak } from '../lib/speech';
import {
  CitizenUser,
  clearCitizenSession,
  getCitizen,
  getCitizenToken,
  saveCitizenSession,
} from '../lib/session';
import { ListGrievance } from '../lib/types';
import { statusMeta } from '../lib/i18n';

function Brandbar({ right }: { right?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-white" aria-hidden>ప</span>
          <span className="text-sm font-bold text-slate-900">{t('appName')}</span>
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
  const [token, setToken] = useState<string | null>(null);
  const [citizen, setCitizen] = useState<CitizenUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tk = getCitizenToken();
    const c = getCitizen();
    if (tk && c) {
      setToken(tk);
      setCitizen(c);
    }
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!token || !citizen)
    return <CitizenLogin onLoggedIn={(tk, c) => { setToken(tk); setCitizen(c); }} />;

  return (
    <Dashboard
      token={token}
      citizen={citizen}
      onLogout={() => { clearCitizenSession(); setToken(null); setCitizen(null); }}
    />
  );
}

function CitizenLogin({ onLoggedIn }: { onLoggedIn: (token: string, c: CitizenUser) => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ devCode?: string }>('/auth/citizen/request-otp', { mobile });
      setDevCode(r.devCode ?? null);
      setStep('otp');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ accessToken: string; citizen: CitizenUser }>('/auth/citizen/verify-otp', { mobile, code });
      saveCitizenSession(r.accessToken, r.citizen);
      onLoggedIn(r.accessToken, r.citizen);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Brandbar />
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">{t('citizenSignIn')}</h1>

          {step === 'mobile' && (
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">{t('enterMobile')}</span>
                <input
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg"
                  placeholder={t('mobilePlaceholder')}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                />
              </label>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                onClick={sendOtp}
                disabled={busy || mobile.length < 10}
                className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                {busy ? t('loading') : t('sendOtp')}
              </button>
              <p className="text-center text-xs text-slate-400">{t('loginNoOtpNote')}</p>
            </div>
          )}

          {step === 'otp' && (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-slate-600">{t('otpSent')} ({mobile})</p>
              {devCode && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  Demo OTP: <b className="font-mono">{devCode}</b>
                </p>
              )}
              <input
                inputMode="numeric"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.3em]"
                placeholder="••••••"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                onClick={verify}
                disabled={busy || code.length < 6}
                className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white disabled:opacity-50"
              >
                {busy ? t('loading') : t('verify')}
              </button>
              <button onClick={sendOtp} disabled={busy} className="w-full text-sm text-slate-500 underline">
                {t('resendOtp')}
              </button>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          <Link href="/track" className="underline">{t('trackByNumber')}</Link>
        </p>
      </main>
    </div>
  );
}

function Dashboard({ token, citizen, onLogout }: { token: string; citizen: CitizenUser; onLogout: () => void }) {
  const { t, meta } = useI18n();
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

  return (
    <div className="min-h-screen bg-slate-50">
      <Brandbar right={<button onClick={onLogout} className="text-sm text-slate-500 underline">{t('logout')}</button>} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">{t('welcome')}, {citizen.name} 👋</h1>
          <button onClick={() => speak(`${t('welcome')}. ${t('fileNewDesc')}`, meta.speech)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" aria-label={t('readAloud')}>🔊</button>
        </div>

        {/* Primary actions */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link href="/citizen/new" className="rounded-3xl bg-gradient-to-br from-brand to-brand-light p-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl" aria-hidden>📝</div>
            <div className="mt-3 text-lg font-bold">{t('fileNew')}</div>
            <p className="mt-1 text-sm text-teal-50">{t('fileNewDesc')}</p>
          </Link>
          <Link href="/track" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <div className="text-3xl" aria-hidden>🔎</div>
            <div className="mt-3 text-lg font-bold text-slate-900">{t('trackTitle')}</div>
            <p className="mt-1 text-sm text-slate-600">{t('trackByNumber')}</p>
          </Link>
        </div>

        {/* My complaints */}
        <section className="mt-7">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{t('myComplaints')}</h2>
          {items === null && <p className="text-sm text-slate-400">{t('loading')}</p>}
          {items && items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
              {t('noComplaints')}
            </div>
          )}
          <div className="space-y-2">
            {items?.map((g) => {
              const m = statusMeta(g.status);
              return (
                <Link key={g.id} href={`/track/${g.ysr}`} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
                  <div>
                    <div className="font-mono text-sm font-semibold text-slate-900">{g.ysr}</div>
                    <div className="text-xs text-slate-500">{g.department ?? '—'} · {g.mandal ?? ''}</div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${m.className}`}>
                    <span aria-hidden>{m.icon}</span>{t(('st_' + g.status) as any)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
