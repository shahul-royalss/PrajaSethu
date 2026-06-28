'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '../components/Header';
import { LoginGate } from '../components/LoginGate';
import { Button, Card, CardBody, ErrorNote, Field, Pill, Spinner } from '../components/ui';
import { api } from '../lib/api';
import { ClassificationPreview, RefItem } from '../lib/types';

const SAMPLE_TE = 'మా ఊరి బోరు పని చేయట్లేదు, తాగు నీళ్లకు చాలా ఇబ్బంది అవుతోంది';

function Console({ token }: { token: string }) {
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [consent, setConsent] = useState(true);
  const [description, setDescription] = useState('');
  const [mandal, setMandal] = useState('Kuppam');

  const [departments, setDepartments] = useState<RefItem[]>([]);
  const [subjects, setSubjects] = useState<RefItem[]>([]);
  const [deptId, setDeptId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [category, setCategory] = useState('NON_FINANCE');

  const [preview, setPreview] = useState<ClassificationPreview | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ysr: string; id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<RefItem[]>('/reference/departments').then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (deptId) api.get<RefItem[]>(`/reference/subjects?deptId=${deptId}`).then(setSubjects).catch(() => setSubjects([]));
    else setSubjects([]);
  }, [deptId]);

  async function analyze() {
    if (!description.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const p = await api.post<ClassificationPreview>('/classification/preview', { text: description });
      setPreview(p);
      if (p.classification.deptId) {
        setDeptId(p.classification.deptId);
        setCategory(p.classification.category);
        if (p.classification.subjectId) setSubjectId(p.classification.subjectId);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ ysr: string; id: string }>(
        '/grievances',
        {
          channel: 'SACHIVALAYAM_ASSISTED',
          language: 'te',
          description,
          mobile,
          name: name || undefined,
          aadhaar: aadhaar || undefined,
          mandal,
          secretariatCode: 'AP-KPM-021',
          deptId: deptId || undefined,
          subjectId: subjectId || undefined,
          category,
          consent,
          consentScope: [],
        },
        token,
      );
      setResult(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setMobile(''); setName(''); setAadhaar(''); setDescription(''); setPreview(null);
    setDeptId(''); setSubjectId(''); setCategory('NON_FINANCE'); setResult(null); setError(null);
  }

  if (result) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <Card className="border-green-300">
          <CardBody className="space-y-3 text-center">
            <div className="text-4xl">✅</div>
            <h2 className="text-lg font-bold text-slate-900">Grievance filed</h2>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Tracking ID (printed on QR slip + SMS sent)</div>
              <div className="font-mono text-xl font-bold text-brand">{result.ysr}</div>
            </div>
            <div className="mx-auto inline-block rounded-lg border-2 border-dashed border-slate-300 p-3 text-xs text-slate-400">
              ▦ QR acknowledgement slip
            </div>
            <div className="flex justify-center gap-2">
              <Link href={`/track/${result.ysr}`} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white">Track it</Link>
              <Button variant="ghost" onClick={reset}>File another</Button>
            </div>
          </CardBody>
        </Card>
      </main>
    );
  }

  const conf = preview ? Math.round(preview.classification.confidence * 100) : 0;

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Card>
        <CardBody className="space-y-5">
          <h1 className="text-lg font-bold text-slate-900">New grievance (assisted)</h1>

          {/* 1 — Citizen */}
          <section className="space-y-3">
            <div className="text-sm font-semibold text-slate-700">1 · Citizen</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Mobile">
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9XXXXXXXXX" />
              </Field>
              <Field label="Name (optional)">
                <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <Field label="Aadhaar (optional)" hint="Tokenised & never stored raw. Mobile-only citizens are fully supported.">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={aadhaar} onChange={(e) => setAadhaar(e.target.value)} placeholder="XXXX XXXX XXXX" />
            </Field>
            <label className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
              <span>Citizen consents to filing + cross-department verification (logged · powers X-Road lookups).</span>
            </label>
          </section>

          {/* 2 — Describe */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">2 · Describe</div>
              <button className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs" onClick={() => setDescription(SAMPLE_TE)}>🎙 Speak in Telugu (demo)</button>
            </div>
            <textarea
              className="font-telugu w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="మీ సమస్యను వివరించండి… (or type in English)"
            />
            <Button variant="subtle" onClick={analyze} disabled={!description.trim() || analyzing}>
              {analyzing ? 'Analysing…' : '✨ Get AI suggestion'}
            </Button>
          </section>

          {/* 3 — AI suggests */}
          {preview && (
            <section className="space-y-2 rounded-lg border border-teal-200 bg-teal-50/50 p-3">
              <div className="text-sm font-semibold text-slate-700">3 · AI suggests <span className="text-xs font-normal text-slate-400">(confirm or change)</span></div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Pill tone="teal">{conf}% confidence</Pill>
                {preview.distress.distress && <Pill tone="red">🚨 distress detected</Pill>}
                {preview.duplicate.isDuplicate && <Pill tone="amber">possible duplicate ({Math.round(preview.duplicate.similarity * 100)}%)</Pill>}
              </div>
              <div className="text-xs text-slate-500">{preview.classification.rationale}</div>
            </section>
          )}

          {/* Confirm department / subject / category */}
          <section className="grid gap-3 sm:grid-cols-3">
            <Field label="Department">
              <select className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" value={deptId} onChange={(e) => { setDeptId(e.target.value); setSubjectId(''); }}>
                <option value="">—</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.en}</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <select className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">—</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.en}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="NON_FINANCE">Non-finance</option>
                <option value="FINANCE">Finance</option>
              </select>
            </Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Mandal">
              <input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={mandal} onChange={(e) => setMandal(e.target.value)} />
            </Field>
          </section>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Voice-first · AI pre-fills, human confirms · consent logged</span>
            <Button onClick={submit} disabled={submitting || !mobile || !description || !deptId}>
              {submitting ? 'Submitting…' : 'Submit → issue YSR'}
            </Button>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}

export default function ConsolePage() {
  return (
    <div className="min-h-screen">
      <Header title="Sachivalayam console" />
      <LoginGate allowedRoles={['DA', 'OFFICER', 'SUPERVISOR']} title="Sachivalayam operator sign-in">
        {({ token }) => <Console token={token} />}
      </LoginGate>
    </div>
  );
}
