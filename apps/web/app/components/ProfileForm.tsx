'use client';

// Citizen profile form — used ONCE at first login (onboarding) and any time
// after from the dashboard's "Edit profile". The same details are then reused
// on every complaint, so the citizen never fills a form twice.

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/intl';

export interface CitizenProfile {
  id: string;
  name: string;
  coName: string | null;
  gender: string | null;
  mobileMasked: string;
  houseNo: string | null;
  habitation: string | null;
  village: string | null;
  mandal: string | null;
  district: string | null;
  profileComplete: boolean;
}

interface Geography {
  districts: string[];
  mandalsByDistrict: Record<string, string[]>;
  villagesByMandal: Record<string, string[]>;
}

export function ProfileForm({
  token,
  initial,
  submitLabel,
  onSaved,
}: {
  token: string;
  initial: CitizenProfile | null;
  submitLabel: string;
  onSaved: (p: CitizenProfile) => void;
}) {
  const { t } = useI18n();
  const [geo, setGeo] = useState<Geography | null>(null);
  const [name, setName] = useState(initial?.name && initial.name !== 'Citizen' ? initial.name : '');
  const [gender, setGender] = useState(initial?.gender ?? '');
  const [district, setDistrict] = useState(initial?.district ?? 'Chittoor');
  const [mandal, setMandal] = useState(initial?.mandal ?? 'Kuppam');
  const [village, setVillage] = useState(initial?.village ?? '');
  const [houseNo, setHouseNo] = useState(initial?.houseNo ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Geography>('/reference/geography').then(setGeo).catch(() => {});
  }, []);

  const canSave = name.trim().length >= 2 && district && mandal && village.trim().length >= 2;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const updated = await patchProfile(token, {
        name: name.trim(),
        gender: gender || undefined,
        district,
        mandal,
        village: village.trim(),
        houseNo: houseNo.trim() || undefined,
      });
      onSaved(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[14px] text-ink outline-none transition focus:border-brand focus:bg-white';

  return (
    <div className="space-y-4">
      <div>
        <label className="text-[12px] font-bold uppercase tracking-wide text-slate-400">{t('profName')} *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profNamePh')} className={`mt-1 ${inputCls}`} autoFocus />
      </div>

      <div>
        <label className="text-[12px] font-bold uppercase tracking-wide text-slate-400">{t('profGender')}</label>
        <div className="mt-1 flex gap-2">
          {(['MALE', 'FEMALE', 'OTHER'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(gender === g ? '' : g)}
              className={`flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition ${
                gender === g ? 'border-brand bg-brand/10 text-brand' : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {t(('profGender_' + g) as any)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[12px] font-bold uppercase tracking-wide text-slate-400">{t('profDistrict')} *</label>
          <select value={district} onChange={(e) => { setDistrict(e.target.value); setMandal(''); setVillage(''); }} className={`mt-1 ${inputCls}`}>
            {(geo?.districts ?? ['Chittoor']).map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[12px] font-bold uppercase tracking-wide text-slate-400">{t('profMandal')} *</label>
          <select value={mandal} onChange={(e) => { setMandal(e.target.value); setVillage(''); }} className={`mt-1 ${inputCls}`}>
            <option value="">—</option>
            {(geo?.mandalsByDistrict[district] ?? ['Kuppam']).map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[12px] font-bold uppercase tracking-wide text-slate-400">{t('profVillage')} *</label>
        <input value={village} onChange={(e) => setVillage(e.target.value)} placeholder={t('qVillage')} className={`mt-1 ${inputCls}`} list="profile-villages" />
        <datalist id="profile-villages">
          {(geo?.villagesByMandal[mandal] ?? []).map((v) => <option key={v} value={v} />)}
        </datalist>
      </div>

      <div>
        <label className="text-[12px] font-bold uppercase tracking-wide text-slate-400">{t('profHouse')}</label>
        <input value={houseNo} onChange={(e) => setHouseNo(e.target.value)} placeholder="1-23/A" className={`mt-1 ${inputCls}`} />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</p>}

      <button
        onClick={save}
        disabled={!canSave || busy}
        className="w-full rounded-2xl bg-gradient-to-r from-navy-700 to-brand-light py-3.5 font-display text-[15px] font-bold text-white shadow-lift transition active:scale-[0.985] disabled:opacity-40"
      >
        {busy ? '…' : submitLabel}
      </button>
    </div>
  );
}

export async function fetchProfile(token: string): Promise<CitizenProfile | null> {
  try {
    return await api.get<CitizenProfile>('/identity/me', token);
  } catch {
    return null;
  }
}

export async function patchProfile(token: string, body: Record<string, unknown>): Promise<CitizenProfile> {
  const res = await fetch(`${(await import('../lib/api')).API_BASE}/identity/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message ?? 'Could not save your details — please try again.');
  return data as CitizenProfile;
}
