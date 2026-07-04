'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '../lib/intl';
import { api } from '../lib/api';
import {
  CitizenUser,
  Officer,
  saveCitizenSession,
  saveSession,
} from '../lib/session';

type Mode = 'citizen' | 'staff';

/**
 * Single sign-in surface. Citizen login (mobile OTP) is the default card; a
 * "Staff login" pill at the top-right flips the same card to the officer
 * username/password form. On success each role is routed to its own home.
 */
export function AuthPanel({ initial = 'citizen' }: { initial?: Mode }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(initial);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
      {/* header strip with role toggle */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${
              mode === 'citizen' ? 'bg-brand/10 text-brand' : 'bg-saffron/15 text-saffron-dark'
            }`}
            aria-hidden
          >
            {mode === 'citizen' ? '🧑' : '🛡️'}
          </span>
          {mode === 'citizen' ? t('citizenLogin') : t('staffLogin')}
        </div>
        {mode === 'citizen' ? (
          <button
            onClick={() => setMode('staff')}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
          >
            {t('staffLogin')} →
          </button>
        ) : (
          <button
            onClick={() => setMode('citizen')}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-brand hover:text-brand"
          >
            ← {t('citizenLogin')}
          </button>
        )}
      </div>

      <div className="p-6">
        {mode === 'citizen' ? <CitizenForm /> : <StaffForm onBack={() => setMode('citizen')} />}
      </div>
    </div>
  );
}

function CitizenForm() {
  const { t } = useI18n();
  const router = useRouter();
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
      if (r.devCode) setCode(r.devCode);
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
      const r = await api.post<{ accessToken: string; citizen: CitizenUser }>('/auth/citizen/verify-otp', {
        mobile,
        code,
      });
      saveCitizenSession(r.accessToken, r.citizen);
      router.push('/citizen');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{t('citizenLoginHint')}</p>

      {step === 'mobile' && (
        <>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">{t('enterMobile')}</span>
            <div className="flex items-center rounded-xl border border-slate-300 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <span className="px-3 text-slate-400">+91</span>
              <input
                inputMode="numeric"
                className="w-full rounded-r-xl border-0 px-2 py-3 text-lg outline-none"
                placeholder={t('mobilePlaceholder')}
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                onKeyDown={(e) => e.key === 'Enter' && mobile.length === 10 && sendOtp()}
              />
            </div>
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={sendOtp}
            disabled={busy || mobile.length < 10}
            className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? t('loading') : t('sendOtp')}
          </button>
          <p className="text-center text-xs text-slate-400">{t('loginNoOtpNote')}</p>
        </>
      )}

      {step === 'otp' && (
        <>
          <p className="text-sm text-slate-600">
            {t('otpSent')} <b>+91 {mobile}</b>
          </p>
          {devCode && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              🧪 Demo mode (no SMS sent) — code <b className="font-mono">{devCode}</b> is filled in. Tap Verify.
            </p>
          )}
          <input
            inputMode="numeric"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.4em] outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="••••••"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verify()}
          />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={verify}
            disabled={busy || code.length < 6}
            className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? t('loading') : t('verify')}
          </button>
          <div className="flex items-center justify-between text-sm">
            <button onClick={() => setStep('mobile')} className="text-slate-500 underline">
              ← {t('back')}
            </button>
            <button onClick={sendOtp} disabled={busy} className="text-slate-500 underline">
              {t('resendOtp')}
            </button>
          </div>
        </>
      )}

      <p className="text-center text-xs text-slate-400">
        <Link href="/track" className="underline">
          {t('trackByNumber')}
        </Link>
      </p>
    </div>
  );
}

// Demo staff accounts surfaced so the pilot is one-tap to explore.
const DEMO_ACCOUNTS = [
  { u: 'cs.officer', label: 'Tahsildar (Revenue/Ration)' },
  { u: 'rws.officer', label: 'AE — Rural Water' },
  { u: 'supervisor', label: 'Mandal Supervisor (MPDO)' },
  { u: 'collector', label: 'District Collector' },
  { u: 'auditor', label: 'Vigilance / Audit' },
];

function StaffForm({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('Praja@123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken: string; officer: Officer }>('/auth/officer/login', {
        username,
        password,
      });
      saveSession(res.accessToken, res.officer);
      router.push('/staff');
    } catch (e) {
      setError((e as Error).message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">{t('staffLoginHint')}</p>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Username</span>
        <input
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="cs.officer"
          onKeyDown={(e) => e.key === 'Enter' && username && login()}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && username && login()}
        />
      </label>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        onClick={login}
        disabled={busy || !username}
        className="w-full rounded-xl bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Demo accounts · password Praja@123
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.u}
              onClick={() => setUsername(a.u)}
              title={a.label}
              className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-brand hover:text-brand"
            >
              {a.u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
