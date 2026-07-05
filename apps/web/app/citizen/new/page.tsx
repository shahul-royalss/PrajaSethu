'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../lib/intl';
import { StringKey } from '../../lib/intl/en';
import { LANGUAGES } from '../../lib/intl/languages';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Logo } from '../../components/Logo';
import { api } from '../../lib/api';
import { useSpeak, useSpeechInput, useVoiceSupport } from '../../lib/speech';
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
  | 'name' | 'coName' | 'dob' | 'gender' | 'mobile' | 'aadhaar' | 'applicantType'
  | 'district' | 'mandal' | 'village' | 'houseNo' | 'habitation'
  | 'category' | 'describe' | 'documents';

interface PendingDoc { filename: string; mime: string; dataBase64: string; sizeBytes: number }

interface Form {
  name: string; coName: string; dob: string; gender: string; mobile: string; aadhaar: string;
  applicantType: string;
  district: string; mandal: string; village: string; houseNo: string; habitation: string;
  categoryIdx: number | null; description: string; docs: PendingDoc[];
}

const STEPS: { id: StepId; q: StringKey; required?: boolean }[] = [
  { id: 'name', q: 'qName', required: true },
  { id: 'coName', q: 'qCoName' },
  { id: 'dob', q: 'qDob' },
  { id: 'gender', q: 'qGender', required: true },
  { id: 'mobile', q: 'qMobile', required: true },
  { id: 'aadhaar', q: 'qAadhaar' },
  { id: 'applicantType', q: 'qApplicantType', required: true },
  { id: 'district', q: 'qDistrict', required: true },
  { id: 'mandal', q: 'qMandal', required: true },
  { id: 'village', q: 'qVillage', required: true },
  { id: 'houseNo', q: 'qHouseNo' },
  { id: 'habitation', q: 'qHabitation' },
  { id: 'category', q: 'qProblemType', required: true },
  { id: 'describe', q: 'qDescribe', required: true },
  { id: 'documents', q: 'qDocuments' },
];

type Phase = 'lang' | 'form' | 'review' | 'done';

export default function NewGrievancePage() {
  const { t, meta, lang, setLang } = useI18n();
  const { speaking, play, stop } = useSpeak();
  const voiceAvailable = useVoiceSupport(meta.speech);
  const [phase, setPhase] = useState<Phase>('lang');
  const [autoRead, setAutoRead] = useState(true);
  const [geo, setGeo] = useState<Geography | null>(null);
  const [i, setI] = useState(0);
  const [form, setForm] = useState<Form>({
    name: '', coName: '', dob: '', gender: '', mobile: '', aadhaar: '', applicantType: '',
    district: 'Chittoor', mandal: 'Kuppam', village: '', houseNo: '', habitation: '',
    categoryIdx: null, description: '', docs: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ ysr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Geography>('/reference/geography').then(setGeo).catch(() => {});
  }, []);

  const step = STEPS[i];
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  // Auto read-aloud each question when it appears (vital for low-literacy users).
  useEffect(() => {
    if (phase !== 'form' || !autoRead) return;
    const id = setTimeout(() => play(t(step.q), meta.speech), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase, autoRead, lang]);

  function valueFor(id: StepId): string {
    if (id === 'category') return form.categoryIdx !== null ? t(CATEGORIES[form.categoryIdx].key) : '';
    if (id === 'describe') return form.description;
    if (id === 'documents') return form.docs.length ? t('documentsAttached', { n: form.docs.length }) : '';
    if (id === 'gender') return form.gender ? t(('opt' + form.gender.charAt(0) + form.gender.slice(1).toLowerCase()) as StringKey) : '';
    if (id === 'applicantType') return form.applicantType ? t(form.applicantType === 'COMMUNITY' ? 'optCommunity' : 'optIndividual') : '';
    return (form as any)[id] ?? '';
  }

  function canAdvance(): boolean {
    if (!step.required) return true;
    if (step.id === 'category') return form.categoryIdx !== null;
    return String((form as any)[step.id] ?? valueFor(step.id)).trim().length > 0;
  }

  function next() {
    stop();
    if (i < STEPS.length - 1) setI(i + 1);
    else setPhase('review');
  }
  function back() {
    stop();
    if (phase === 'review') setPhase('form');
    else if (i > 0) setI(i - 1);
    else setPhase('lang');
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
          dob: form.dob || undefined,
          aadhaar: form.aadhaar || undefined,
          gender: form.gender || undefined,
          applicantType: form.applicantType || undefined,
          district: form.district || undefined,
          mandal: form.mandal || undefined,
          village: form.village || undefined,
          houseNo: form.houseNo || undefined,
          habitation: form.habitation || undefined,
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
      // Upload any documents the citizen attached (best-effort).
      for (const d of form.docs) {
        try {
          await api.post(`/grievances/${res.ysr}/attachments`, d, token);
        } catch {
          /* keep going — a failed attachment shouldn't lose the grievance */
        }
      }
      setDone({ ysr: res.ysr });
      setPhase('done');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done' && done) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-3xl border border-india/30 bg-white p-7 text-center shadow-card">
          <div className="text-5xl">✅</div>
          <h1 className="mt-3 text-xl font-bold text-ink">{t('successTitle')}</h1>
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

  // ── Phase 1: choose language for the interview ──────────────────────────────
  if (phase === 'lang') {
    return (
      <Shell>
        <div className="mx-auto max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h1 className="text-xl font-bold text-ink">{t('startLanguage')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('startLanguageHelp')}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-3 transition ${
                    l.code === lang ? 'border-brand bg-brand/5' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`text-base font-bold ${l.code === lang ? 'text-brand' : 'text-ink'}`}>{l.native}</span>
                  <span className="text-[11px] text-slate-400">{l.label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setPhase('form'); setI(0); }}
              className="mt-6 w-full rounded-xl bg-brand py-3 text-base font-semibold text-white hover:bg-brand-dark"
            >
              {t('startHere')} →
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">📞 {t('callHelpline')}</p>
        </div>
      </Shell>
    );
  }

  const total = STEPS.length;
  const progress = phase === 'review' ? 100 : Math.round(((i + 1) / total) * 100);

  return (
    <Shell
      right={
        <button
          onClick={() => setAutoRead((v) => !v)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${autoRead ? 'border-brand bg-brand/5 text-brand' : 'border-slate-300 text-slate-500'}`}
          title={t('readAloud')}
        >
          🔊 {autoRead ? 'ON' : 'OFF'}
        </button>
      }
    >
      <div className="mx-auto max-w-md">
        {/* progress */}
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>{phase === 'review' ? t('reviewTitle') : t('stepOf', { n: i + 1, total })}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {phase === 'form' && voiceAvailable === false && (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            🔇 {t('noVoiceHint')}
          </p>
        )}

        {phase === 'form' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-lg font-bold text-ink">
                {t(step.q)}{' '}
                {step.required ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-xs font-normal text-slate-400">({t('optional')})</span>
                )}
              </h1>
              <button
                onClick={() => play(t(step.q), meta.speech)}
                className={`flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${speaking ? 'border-brand bg-brand/5 text-brand' : 'border-slate-300 text-slate-600'}`}
                aria-label={t('listenAgain')}
              >
                {speaking ? '⏹️' : '🔊'} {t('listenAgain')}
              </button>
            </div>

            <div className="mt-4">
              <StepInput stepId={step.id} form={form} set={set} geo={geo} />
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button onClick={back} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">← {t('back')}</button>
              <button onClick={next} disabled={!canAdvance()} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40">{t('next')} →</button>
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
            <h1 className="text-lg font-bold text-ink">{t('reviewTitle')}</h1>
            <dl className="mt-4 divide-y divide-slate-100 text-sm">
              {STEPS.map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-slate-500">{t(s.q)}</dt>
                  <dd className="flex items-center gap-2 text-right font-medium text-slate-800">
                    <span className="max-w-[12rem] truncate">{valueFor(s.id) || '—'}</span>
                    <button onClick={() => { setPhase('form'); setI(idx); }} className="text-xs text-brand underline">{t('editAnswer')}</button>
                  </dd>
                </div>
              ))}
            </dl>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex items-center justify-between">
              <button onClick={back} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">← {t('back')}</button>
              <button onClick={submit} disabled={submitting} className="rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50">
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

function Shell({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <Link href="/citizen"><Logo size={28} showSub={false} /></Link>
          <div className="flex items-center gap-2">
            {right}
            <LanguageSwitcher compact />
          </div>
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
    case 'dob':
      return <input type="date" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base" value={form.dob} onChange={(e) => set({ dob: e.target.value })} />;
    case 'mobile':
      return <NumberInput value={form.mobile} onChange={(v) => set({ mobile: v })} max={10} placeholder="9XXXXXXXXX" />;
    case 'aadhaar':
      return (
        <div>
          <NumberInput value={form.aadhaar} onChange={(v) => set({ aadhaar: v })} max={12} placeholder="XXXX XXXX XXXX" />
          <p className="mt-2 text-xs text-slate-400">🔒 {t('aadhaarNote')}</p>
        </div>
      );
    case 'houseNo':
      return <MicText value={form.houseNo} onChange={(v) => set({ houseNo: v })} />;
    case 'habitation':
      return <MicText value={form.habitation} onChange={(v) => set({ habitation: v })} />;
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
      return <Picker value={form.mandal} onChange={(v) => set({ mandal: v, village: '' })} options={geo?.mandalsByDistrict[form.district] ?? ['Kuppam']} allowFree />;
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
                form.categoryIdx === idx ? 'border-brand bg-brand/5' : 'border-slate-200 hover:bg-slate-50'
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
    case 'documents':
      return <DocStep docs={form.docs} setDocs={(docs) => set({ docs })} />;
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
  const [interim, setInterim] = useState('');
  const { supported, status, listening, start, stop } = useSpeechInput(
    meta.speech,
    (text) => {
      onChange((ref.current ? ref.current + ' ' : '') + text);
      setInterim('');
    },
    (live) => setInterim(live),
  );

  const hint =
    status === 'denied' ? t('micDenied')
    : status === 'error' ? t('micError')
    : status === 'unsupported' ? t('micUnsupported')
    : listening ? `🎙️ ${t('listening')}`
    : help ?? t('speakOrType');

  return (
    <div>
      <div className="flex items-stretch gap-2">
        {textarea ? (
          <textarea
            className="min-h-[100px] flex-1 rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('orTypeHere')}
          />
        ) : (
          <input
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-lg focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('orTypeHere')}
          />
        )}
        {supported && (
          <button
            onClick={() => (listening ? stop() : start())}
            className={`flex w-14 shrink-0 items-center justify-center rounded-xl text-2xl transition ${
              listening ? 'animate-pulse bg-red-500 text-white' : 'bg-brand text-white hover:bg-brand-dark'
            }`}
            aria-label={t('speakNow')}
            title={t('speakNow')}
          >
            🎙️
          </button>
        )}
      </div>
      {/* live transcript (native script) while speaking */}
      {listening && interim && (
        <div className="mt-2 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-slate-700">
          <span className="text-[11px] font-semibold uppercase text-brand">{t('yourAnswer')}: </span>
          {interim}…
        </div>
      )}
      <p className={`mt-2 text-xs ${status === 'denied' || status === 'error' ? 'text-red-600' : 'text-slate-400'}`}>{hint}</p>
    </div>
  );
}

function NumberInput({ value, onChange, max, placeholder }: { value: string; onChange: (v: string) => void; max: number; placeholder: string }) {
  return (
    <input
      inputMode="numeric"
      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg tracking-wide focus:border-brand focus:ring-2 focus:ring-brand/20"
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
            value === o.v ? 'border-brand bg-brand/5' : 'border-slate-200 hover:bg-slate-50'
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
              value === o ? 'border-brand bg-brand/5 text-brand' : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {allowFree && (
        <input
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-brand focus:ring-2 focus:ring-brand/20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="…"
        />
      )}
    </div>
  );
}

// ── Document attachment step ─────────────────────────────────────────────────
const MAX_DOC_BYTES = 4 * 1024 * 1024;

async function fileToPendingDoc(file: File): Promise<PendingDoc> {
  // Downscale images client-side so low-bandwidth uploads succeed; officers can
  // compress further at their workbench.
  if (file.type.startsWith('image/')) {
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    const max = 1600;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL('image/jpeg', 0.72);
    const b64 = jpeg.split(',')[1];
    return { filename: file.name.replace(/\.[^.]+$/, '') + '.jpg', mime: 'image/jpeg', dataBase64: b64, sizeBytes: Math.floor((b64.length * 3) / 4) };
  }
  // Non-image: read as base64 directly.
  const b64 = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res((r.result as string).split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  return { filename: file.name, mime: file.type || 'application/octet-stream', dataBase64: b64, sizeBytes: Math.floor((b64.length * 3) / 4) };
}

function DocStep({ docs, setDocs }: { docs: PendingDoc[]; setDocs: (d: PendingDoc[]) => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr(null);
    try {
      const added: PendingDoc[] = [];
      for (const f of Array.from(files)) {
        const d = await fileToPendingDoc(f);
        if (d.sizeBytes > MAX_DOC_BYTES) { setErr('A file is too large (max ~4 MB).'); continue; }
        added.push(d);
      }
      setDocs([...docs, ...added]);
    } catch {
      setErr(t('micError'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">{t('qDocumentsHelp')}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600 hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {busy ? t('uploading') : <>📎 {t('addPhoto')}</>}
      </button>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

      {docs.length === 0 ? (
        <p className="mt-3 text-center text-xs text-slate-400">{t('noDocuments')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {docs.map((d, idx) => (
            <li key={idx} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <span className="flex items-center gap-2 truncate text-sm text-slate-700">
                <span aria-hidden>{d.mime.startsWith('image/') ? '🖼️' : '📄'}</span>
                <span className="truncate">{d.filename}</span>
                <span className="shrink-0 text-xs text-slate-400">({Math.round(d.sizeBytes / 1024)} KB)</span>
              </span>
              <button onClick={() => setDocs(docs.filter((_, j) => j !== idx))} className="shrink-0 text-xs text-red-600 underline">{t('removeDoc')}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
