'use client';

// First-login onboarding: a NEW mobile number lands here once, tells us who and
// where they are, and never sees this screen again — every later complaint is
// prefilled from this profile, and it stays editable from the dashboard.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/intl';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Logo } from '../../components/Logo';
import { getCitizen, getCitizenToken, saveCitizenSession } from '../../lib/session';
import { CitizenProfile, fetchProfile, ProfileForm } from '../../components/ProfileForm';

export default function WelcomePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [initial, setInitial] = useState<CitizenProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const tk = getCitizenToken();
    if (!tk || !getCitizen()) {
      router.replace('/');
      return;
    }
    setToken(tk);
    fetchProfile(tk).then((p) => {
      // Already completed on another device / earlier session → straight home.
      if (p?.profileComplete) {
        router.replace('/citizen');
        return;
      }
      setInitial(p);
      setReady(true);
    });
  }, [router]);

  if (!ready || !token) return null;

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <Logo size={28} showSub={false} />
          <LanguageSwitcher compact />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-6 animate-fade-up">
        <h1 className="font-display text-[24px] font-bold leading-tight text-ink">{t('onbTitle')}</h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{t('onbSubtitle')}</p>

        <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
          <ProfileForm
            token={token}
            initial={initial}
            submitLabel={`${t('onbSave')} →`}
            onSaved={(p) => {
              // Keep the cached session's display name in sync.
              const c = getCitizen();
              if (c) saveCitizenSession(token, { ...c, name: p.name });
              router.replace('/citizen');
            }}
          />
        </div>
        <p className="mt-3 text-center text-[11.5px] leading-relaxed text-slate-400">{t('onbNote')}</p>
      </main>
    </div>
  );
}
