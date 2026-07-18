'use client';

// Edit profile — the citizen taps their profile on the dashboard and changes
// any detail here; complaints keep prefilling from the updated profile.

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/intl';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Logo } from '../../components/Logo';
import { getCitizen, getCitizenToken, saveCitizenSession } from '../../lib/session';
import { CitizenProfile, fetchProfile, ProfileForm } from '../../components/ProfileForm';

export default function ProfilePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [initial, setInitial] = useState<CitizenProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const tk = getCitizenToken();
    if (!tk || !getCitizen()) {
      router.replace('/');
      return;
    }
    setToken(tk);
    fetchProfile(tk).then((p) => {
      setInitial(p);
      setReady(true);
    });
  }, [router]);

  if (!ready || !token) return null;

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <Link href="/citizen" aria-label={t('back')} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            </span>
            <Logo size={28} showSub={false} />
          </Link>
          <LanguageSwitcher compact />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-6 animate-fade-up">
        <h1 className="font-display text-[24px] font-bold leading-tight text-ink">{t('profTitle')}</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{t('profSubtitle')}{initial?.mobileMasked ? ` · +91 ${initial.mobileMasked}` : ''}</p>

        {saved && (
          <p className="mt-3 rounded-xl border border-india/25 bg-india/5 px-3 py-2.5 text-[13px] font-semibold text-india animate-fade-up">✓ {t('profSaved')}</p>
        )}

        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <ProfileForm
            token={token}
            initial={initial}
            submitLabel={t('profSave')}
            onSaved={(p) => {
              const c = getCitizen();
              if (c) saveCitizenSession(token, { ...c, name: p.name });
              setInitial(p);
              setSaved(true);
              setTimeout(() => setSaved(false), 3500);
            }}
          />
        </div>
      </main>
    </div>
  );
}
