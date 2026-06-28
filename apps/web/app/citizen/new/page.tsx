'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/intl';
import { StringKey } from '../../lib/intl/en';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { api } from '../../lib/api';
import { speak, useSpeechInput } from '../../lib/speech';
import { getCitizenToken } from '../../lib/session';

interface Geography {
  districts: string[];
  mandalsByDistrict: Record<string, string[]>;
  villagesByMandal: Record<string, string[]>;
}

// Citizen-friendly problem types → seeded department/subject ids.
const CATEGORIES = [
  { key: 'catWater' as StringKey, icon: '💧', deptId: 'RWS', subjectId: 'RWS_BOREWELL', category: 'NON_FINANCE' },
  { key: 'catPower' as StringKey, icon: '💡', deptId: 'ENERGY', subjectId: 'ENERGY_OUTAGE', category: 'NON_FINANCE' },
  { key: 'catRation' as StringKey, icon: '🍚', deptId: 'CS', subjectId: 'CS_RATION_STOPPED', category: 'FINANCE' },
  { key: 'catPension' as StringKey, icon: '👵', deptId: 'PEN', subjectId: 'PEN_STOPPED', category: 'FINANCE' },
  { key: 'catLand' as StringKey, icon: '🪧', deptId: 'REVENUE', subjectId: 'REVENUE_MUTATION', category: 'NON_FINANCE' },
  { key: 'catOther' as StringKey, icon: '❓', deptId: '', subjectId: '', category: 'NON_FINANCE' },
];

type StepId =
  | 'name' | 'coName' | 'mobile' | 'aadhaar' | 'gender' | 'applicantType'
  | 'district' | 'mandal' | 'village' | 'category' | 'describe';

interface Form {
  name: string; coName: string; mobile: string; aadhaar: string;
  gender: string; applicantType: string;
  district: string; mandal: string; village: string;
  categoryIdx: number | null; description: string;
}

const STEPS: { id: StepId; q: StringKey; required?: boolean }[] = [
  { id: 'name', q: 'qName', required: true },
  { id: 'coName', q: 'qCoName', required: true },
  { id: 'mobile', q: 'qMobile', required: true },
  { id: 'aadhaar', q: 'qAadhaar' },
  { id: 'gender', q: 'qGender', required: true },
  { id: 'applicantType', q: 'qApplicantType', required: true },
  { id: 'district', q: 'qDistrict', required: true },
  { id: 'mandal', q: 'qMandal', required: true },
  { id: 'village', q: 'qVillage', required: true },
  { id: 'category', q: 'qProblemType', required: true },
  { id: 'describe', q: 'qDescribe', required: true },
];

export default function NewGrievancePage() {
  const { t, meta } = useI18n();
  const router = useRouter();
  const [geo, setGeo] = useState<Geography | null>(null);
  const [i, setI] = useState(0);
  const [form, setForm] = useState<Form>({
    name: '', coName: '', mobile: '', aadhaar: '', gender: '', applicantType: '',
    district: 'Chittoor', mandal: 'Kuppam', village: '', categoryIdx: null, description: '',
  });
  const [review, setReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ysr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Geography>('/reference/geography').then(setGeo).catch(() => {});
  }, []);

  const step = STEPS[i];
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  function valueFor(id: StepId): string {
    if (id === 'category') return form.categoryIdx !== null ? t(CATEGORIES[form.categoryIdx].key) : '';
    if (id === 'describe') return form.description;
    return (form as any)[id] ?? '';
  }

  function canAdvance(): boolean {
    if (!step.required) return true;
    if (step.id === 'category') return form.categoryIdx !== null;
    return String(valueFor(step.id)).trim().length > 0;
  }

  function next() {
    if (i < STEPS.length - 1) setI(i + 1);
    else setReview(true);
  }
  function back() {
    if (review) setReview(false);
    else if (i > 0) setI(i - 1);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const cat = form.categoryIdx !== null ? CATEGORIES[form.categoryIdx] : null;
      const token = getCitizenToken() ?? undefined;
      const res = await api.post<{ ysr: string }>(
        '/grievances',
        {
          channel: 'CITIZEN_APP',
          language: meta.code,
          description: form.description,
          mobile: form.mobile,
          name: form.name,
          coName: form.coName || undefined,
          aadhaar: form.aadhaar || undefined,
          gender: form.gender || undefined,
          applicantType: form.applicantType || undefined,
          district: form.district || undefined,
          mandal: form.mandal || undefined,
          village: form.village || undefined,
          grievanceDistrict: form.district || undefined,
          grievanceMandal: form.mandal || undefined,
          grievanceVillage: form.village || undefined,
          deptId: cat?.deptId || undefined,
          subjectId: cat?.subjectId || undefined,
          category: cat?.category || undefined,
          consent: true,
        },
        token,
      );
      setDone({ ysr: res.ysr });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-3xl border border-green-200 bg-white p-7 text-center shadow-sm">
          <div className="text-5xl">✅</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">{t('successTitle')}</h1>
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="text-xs text-slate-500">{t('yourNumber')}</div>
            <div className="font-mono text-2xl font-extrabold text-brand">{done.ysr}</div>
          </div>
          <p className="mt-3 text-sm text-slate-600">{t('successSms')}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href={`/track/${done.ysr}`} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">{t('trackNow')}</Link>
            <Link href="/citizen" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">{t('fileAnother')}</Link>
          </div>
        </div>
      </Shell>
    );
  }

  const total = STEPS.length;
  const progress = review ? 100 : Math.round(((i + 1) / total) * 100);

  return (
    <Shell>
      <div className="mx-auto max-w-md">
        {/* progress */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{review ? t('reviewTitle') : t('stepOf', { n: i + 1, total })}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {!review && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-bold text-slate-900">
                {t(step.q)} {step.required ? <span className="text-red-500">*</span> : <span className="text-xs font-normal text-slate-400">({t('optional')})</span>}
              </h1>
              <button onClick={() => speak(t(step.q), meta.speech)} className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" aria-label={t('readAloud')}>🔊</button>
            </div>

            <div className="mt-4">
              <StepInput stepId={step.id} form={form} set={set} geo={geo} />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button onClick={back} disabled={i === 0} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 disabled:opacity-40">← {t('back')}</button>
              <button onClick={next} disabled={!canAdvance()} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{t('next')} →</button>
            </div>
          </div>
        )}

        {review && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">{t('reviewTitle')}</h1>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              {STEPS.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-slate-500">{t(s.q)}</dt>
                  <dd className="flex items-center gap-2 text-right font-medium text-slate-800">
                    <span className="max-w-[12rem] truncate">{valueFor(s.id) || '—'}</span>
                    <button onClick={() => { setReview(false); setI(idx); }} className="text-xs text-brand underline">{t('editAnswer')}</button>
                  </dd>
                </div>
              ))}
            </dl>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex items-center justify-between">
              <button onClick={back} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">← {t('back')}</button>
              <button onClick={submit} disabled={submitting} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {submitting ? t('submitting') : t('confirmSubmit')}
              </button>
            </div>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">📞 {t('callHelpline')}</p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Link href="/citizen" className="text-sm font-semibold text-slate-700">← {t('formTitle')}</Link>
          <LanguageSwitcher compact />
        </div>
      </header>
      <main className="px-4 py-6">{children}</main>
    </div>
  );
}

function StepInput({
  stepId, form, set, geo,
}: {
  stepId: StepId; form: Form; set: (p: Partial<Form>) => void; geo: Geography | null;
}) {
  const { t } = useI18n();

  switch (stepId) {
    case 'name':
      return <MicText value={form.name} onChange={(v) => set({ name: v })} />;
    case 'coName':
      return <MicText value={form.coName} onChange={(v) => set({ coName: v })} />;
    case 'mobile':
      return <NumberInput value={form.mobile} onChange={(v) => set({ mobile: v })} max={10} placeholder="9XXXXXXXXX" />;
    case 'aadhaar':
      return (
        <div>
          <NumberInput value={form.aadhaar} onChange={(v) => set({ aadhaar: v })} max={12} placeholder="XXXX XXXX XXXX" />
          <p className="mt-2 text-xs text-slate-400">🔒 {t('aadhaarNote')}</p>
        </div>
      );
    case 'gender':
      return (
        <ChoiceGrid
          value={form.gender}
          onChange={(v) => set({ gender: v })}
          options={[
            { v: 'MALE', icon: '👨', label: t('optMale') },
            { v: 'FEMALE', icon: '👩', label: t('optFemale') },
            { v: 'OTHER', icon: '⚧', label: t('optOther') },
          ]}
        />
      );
    case 'applicantType':
      return (
        <ChoiceGrid
          value={form.applicantType}
          onChange={(v) => set({ applicantType: v })}
          options={[
            { v: 'INDIVIDUAL', icon: '🧍', label: t('optIndividual') },
            { v: 'COMMUNITY', icon: '👨‍👩‍👧‍👦', label: t('optCommunity') },
          ]}
        />
      );
    case 'district':
      return <Picker value={form.district} onChange={(v) => set({ district: v, mandal: '', village: '' })} options={geo?.districts ?? ['Chittoor']} />;
    case 'mandal':
      return <Picker value={form.mandal} onChange={(v) => set({ mandal: v, village: '' })} options={geo?.mandalsByDistrict[form.district] ?? ['Kuppam']} />;
    case 'village':
      return <Picker value={form.village} onChange={(v) => set({ village: v })} options={geo?.villagesByMandal[form.mandal] ?? ['Other']} allowFree />;
    case 'category':
      return (
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c, idx) => (
            <button
              key={c.key}
              onClick={() => set({ categoryIdx: idx })}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 text-center transition ${
                form.categoryIdx === idx ? 'border-brand bg-teal-50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="text-3xl" aria-hidden>{c.icon}</span>
              <span className="text-sm font-medium text-slate-700">{t(c.key)}</span>
            </button>
          ))}
        </div>
      );
    case 'describe':
      return <MicText value={form.description} onChange={(v) => set({ description: v })} textarea help={t('qDescribeHelp')} />;
    default:
      return null;
  }
}

function MicText({
  value, onChange, textarea, help,
}: { value: string; onChange: (v: string) => void; textarea?: boolean; help?: string }) {
  const { t, meta } = useI18n();
  const ref = useRef('');
  ref.current = value;
  const { supported, listening, start, stop } = useSpeechInput(meta.speech, (text) => {
    onChange((ref.current ? ref.current + ' ' : '') + text);
  });
  return (
    <div>
      <div className="flex items-stretch gap-2">
        {textarea ? (
          <textarea
            className="min-h-[90px] flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('orTypeHere')}
          />
        ) : (
          <input
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-lg"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('orTypeHere')}
          />
        )}
        {supported && (
          <button
            onClick={() => (listening ? stop() : start())}
            className={`flex w-14 shrink-0 items-center justify-center rounded-xl text-2xl ${listening ? 'animate-pulse bg-red-500 text-white' : 'bg-brand text-white'}`}
            aria-label="Speak"
            title="Speak"
          >
            🎙️
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">{listening ? `🎙️ ${t('listening')}` : help ?? t('speakOrType')}</p>
    </div>
  );
}

function NumberInput({ value, onChange, max, placeholder }: { value: string; onChange: (v: string) => void; max: number; placeholder: string }) {
  return (
    <input
      inputMode="numeric"
      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-wide"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, max))}
      placeholder={placeholder}
    />
  );
}

function ChoiceGrid({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; icon: string; label: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex flex-col items-center gap-1 rounded-2xl border-2 p-4 transition ${
            value === o.v ? 'border-brand bg-teal-50' : 'border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-3xl" aria-hidden>{o.icon}</span>
          <span className="text-sm font-medium text-slate-700">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

function Picker({ value, onChange, options, allowFree }: { value: string; onChange: (v: string) => void; options: string[]; allowFree?: boolean }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={`rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              value === o ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {allowFree && (
        <input
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…"
        />
      )}
    </div>
  );
}
