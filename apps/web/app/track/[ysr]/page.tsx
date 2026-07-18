'use client';

// Track a complaint — Saarthi 2.0. The citizen sees exactly who has their case
// (officer name + designation + department), can CALL the department, talk to
// the Saarthi assistant, replay their own voice evidence, inspect the
// blockchain record, and — if unsatisfied — request a reopen with a mandatory
// typed or spoken reason that goes to a senior officer's quick desk review.

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Header } from '../../components/Header';
import { Timeline } from '../../components/Timeline';
import { IntegrityShield } from '../../components/IntegrityShield';
import { api, ApiError, API_BASE } from '../../lib/api';
import { ChainFeed, PublicGrievance } from '../../lib/types';
import { daysLeft, fmtDate } from '../../lib/i18n';
import { helplineFor } from '../../lib/departments';
import { useI18n } from '../../lib/intl';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { blobToBase64, fmtClock, useVoiceRecorder } from '../../lib/recorder';
import { detectClientLanguage } from '../../lib/langdetect';
import { useAsrPipeline } from '../../lib/asr';

export default function TrackView() {
  const params = useParams<{ ysr: string }>();
  const ysr = decodeURIComponent(params.ysr);
  const { t, lang } = useI18n();
  const te = lang === 'te';
  const [g, setG] = useState<PublicGrievance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showReopen, setShowReopen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setG(await api.get<PublicGrievance>(`/grievances/public/${encodeURIComponent(ysr)}`));
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? `No grievance found for "${ysr}".` : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [ysr]);

  useEffect(() => {
    load();
  }, [load]);

  function readAloud() {
    if (!g || typeof window === 'undefined' || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(te ? g.plainStatus.te : g.plainStatus.en);
    u.lang = te ? 'te-IN' : 'en-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function confirmSatisfied() {
    if (!g) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/grievances/public/${g.id}/confirm-closure`, {
        satisfied: true,
        benefitReceived: g.category === 'FINANCE' ? true : undefined,
        rating: 5,
        comment: 'Resolved to my satisfaction.',
      });
      setMsg(t('closeYes') + ' ✓');
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const dl = daysLeft(g?.slaDueAt);
  const helpline = g?.department?.helpline || helplineFor(g?.department?.en);
  const sevTone = g?.severity === 'CRITICAL' ? 'border-red-200 bg-red-50 text-red-700' : g?.severity === 'HIGH' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <Header title={t('trackTitle')} backHref="/track" right={<LanguageSwitcher compact />} />
      <main className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
        {loading && (
          <div className="space-y-3">
            <div className="h-40 animate-pulse rounded-3xl border border-slate-200 bg-white" />
            <div className="h-24 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          </div>
        )}
        {error && (
          <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
            <div><Link href="/track" className="font-semibold underline">← {t('trackByNumber')}</Link></div>
          </div>
        )}

        {g && (
          <div className="space-y-4">
            {/* merged notice — honest copy (§9.2) */}
            {g.mergedFrom && (
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] leading-relaxed text-amber-800">
                <span className="text-lg" aria-hidden>🤝</span>
                <span>
                  {t('merged_into', { ysr: g.ysr })} — {t('reportedBy', { n: g.reportCount })}.
                </span>
              </div>
            )}

            {/* case card */}
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
              <div className="border-b border-slate-100 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-[12px] text-slate-400 ${te ? 'font-telugu' : ''}`}>{te ? 'మీ ఫిర్యాదు' : 'Your complaint'}</div>
                    <div className="font-mono text-[19px] font-extrabold tracking-tight text-ink">{g.ysr}</div>
                    <div className="mt-1 truncate text-[13px] text-slate-500">
                      {g.subject?.en ?? g.department?.en ?? '—'}
                    </div>
                  </div>
                  <button onClick={readAloud} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-lg" aria-label={t('readAloud')}>🔊</button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusChip status={g.status} />
                  {g.severity && <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${sevTone}`}>{t('severityLabel')}: {t(('sev_' + g.severity) as any)}</span>}
                  {g.language && (
                    <span className="rounded-full border border-india/25 bg-india/5 px-2.5 py-0.5 text-[11px] font-bold text-india">
                      {g.language.native} {g.language.confidence != null ? `${Math.round(g.language.confidence * 100)}%` : ''}
                    </span>
                  )}
                  {g.routedBy === 'AI' && <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-600">⚡ {t('routedByAi')}{g.aiConfidence != null ? ` ${Math.round(g.aiConfidence * 100)}%` : ''}</span>}
                  {g.routedBy === 'HUMAN' && <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">🧑‍⚖️ {t('routedByHuman')}</span>}
                  {g.reportCount > 1 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">{t('reportedBy', { n: g.reportCount })}</span>}
                  {g.emergency && <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600">🚨</span>}
                </div>

                {/* plain-language status */}
                <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
                  <p className="font-telugu text-[14px] leading-relaxed text-slate-800" lang="te">{g.plainStatus.te}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{g.plainStatus.en}</p>
                  {g.plainStatus.aiGenerated && <p className="mt-1 text-[10.5px] text-slate-400">↳ AI-generated plain-language summary</p>}
                </div>

                {dl !== null && !['CLOSED', 'MERGED'].includes(g.status) && (
                  <div className="mt-3 text-[13px]">
                    <span className={`font-bold ${dl < 0 ? 'text-red-600' : dl <= 2 ? 'text-amber-600' : 'text-slate-700'}`}>
                      ⏳ {dl < 0 ? t('slaOverdue', { n: Math.abs(dl) }) : t('slaLeft', { n: dl })}
                    </span>
                    <span className="text-slate-400"> · {fmtDate(g.slaDueAt)}</span>
                  </div>
                )}
              </div>

              {/* officer + call department */}
              {(g.officer || g.department) && (
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                  {g.officer && (
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/10 font-display text-[15px] font-bold text-brand">
                        {g.officer.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('officerHandling')}</div>
                        <div className="truncate text-[14.5px] font-bold text-ink">{g.officer.name}</div>
                        <div className="truncate text-[12px] text-slate-500">
                          {[g.officer.designation, te ? g.department?.te : g.department?.en].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </div>
                  )}
                  <a
                    href={`tel:${helpline}`}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-india px-4 py-3 text-[13px] font-bold text-white shadow-card transition active:scale-95"
                  >
                    📞 {t('callDepartment')} <span className="font-mono">{helpline}</span>
                  </a>
                </div>
              )}
            </section>

            {/* live location the officer received */}
            {g.location.geo && (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">📍 {t('yourLocation')}</div>
                    <div className="mt-0.5 font-mono text-[12.5px] text-slate-600">
                      {g.location.geo.lat.toFixed(5)}, {g.location.geo.lng.toFixed(5)}
                      {g.location.geo.accuracy != null && <span className="text-slate-400"> ±{Math.round(g.location.geo.accuracy)}m</span>}
                    </div>
                  </div>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${g.location.geo.lat}&mlon=${g.location.geo.lng}#map=17/${g.location.geo.lat}/${g.location.geo.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-brand"
                  >
                    🗺 Map →
                  </a>
                </div>
              </section>
            )}

            {/* the citizen's own voice evidence */}
            {g.voiceAttachments.length > 0 && (
              <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">🎙 {t('yourVoiceNote')}</div>
                <div className="mt-2 space-y-2">
                  {g.voiceAttachments.map((v) => (
                    <div key={v.id}>
                      {v.type === 'REOPEN_VOICE' && <div className="mb-1 text-[11.5px] font-semibold text-fuchsia-600">↻ {t('reopenTitle')}</div>}
                      <audio controls preload="none" src={`${API_BASE}/grievances/${g.id}/attachments/${v.id}/content`} className="w-full" />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11.5px] text-slate-400">{t('recKeepAudio')}</p>
              </section>
            )}

            {/* desk review state */}
            {g.deskReview && g.deskReview.status !== 'APPLIED' && (
              <section
                className={`rounded-3xl border p-4 text-[13px] leading-relaxed shadow-card ${
                  g.deskReview.status === 'PENDING'
                    ? 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800'
                    : g.deskReview.status === 'REOPEN_APPROVED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className="font-bold">
                  {g.deskReview.status === 'PENDING' && `⚖️ ${t('st_QUICK_DESK_REVIEW')}`}
                  {g.deskReview.status === 'REOPEN_APPROVED' && `✅ ${t('reopenApprovedNote', { name: g.deskReview.reviewedByName ?? 'a senior officer' })}`}
                  {g.deskReview.status === 'CLOSURE_UPHELD' && `🧾 ${t('reopenUpheldNote', { name: g.deskReview.reviewedByName ?? 'a senior officer', note: g.deskReview.reviewNote ?? '' })}`}
                </div>
                {g.deskReview.status === 'PENDING' && (
                  <p className="mt-1">{t('reopenPendingNote', { name: 'a senior officer' })}</p>
                )}
                {g.deskReview.reason && <p className="mt-1.5 border-l-2 border-current/30 pl-2 italic opacity-80">“{g.deskReview.reason}”</p>}
              </section>
            )}

            {/* resolved → confirm or ask to reopen */}
            {g.status === 'RESOLVED' && (
              <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-card">
                <div className="text-[14.5px] font-bold text-ink">{t('resolvedAsk')}</div>
                <p className="mt-1 text-[12.5px] text-slate-500">{t('resolvedAskNote')}</p>
                {msg && <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-700">{msg}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={confirmSatisfied} disabled={busy} className="flex-1 rounded-xl bg-india px-4 py-3 text-[13.5px] font-bold text-white disabled:opacity-50">
                    ✓ {t('closeYes')}
                  </button>
                  <button
                    onClick={() => setShowReopen((v) => !v)}
                    disabled={busy}
                    className={`flex-1 rounded-xl border px-4 py-3 text-[13.5px] font-bold ${showReopen ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700' : 'border-slate-300 text-slate-600'}`}
                  >
                    ✗ {t('reopenNo')}
                  </button>
                </div>
                {showReopen && <ReopenPanel grievance={g} onDone={async () => { setShowReopen(false); await load(); }} />}
              </section>
            )}
            {g.status === 'CLOSED' && !g.deskReview?.status.startsWith('PENDING') && (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
                <button
                  onClick={() => setShowReopen((v) => !v)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-[13.5px] font-bold text-slate-600"
                >
                  ↻ {t('reopenTitle')}
                </button>
                {showReopen && <ReopenPanel grievance={g} onDone={async () => { setShowReopen(false); await load(); }} />}
              </section>
            )}

            {/* Saarthi assistant */}
            <Copilot ysr={g.ysr} />

            {/* blockchain record */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
              <IntegrityShield grievanceId={g.id} />
              <ChainView grievanceId={g.id} />
            </section>

            {/* timeline */}
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="mb-3 text-[12px] font-bold uppercase tracking-widest text-slate-400">{t('timeline')}</div>
              <Timeline events={g.timeline} />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const { t } = useI18n();
  const tones: Record<string, string> = {
    RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    CLOSED: 'border-slate-200 bg-slate-100 text-slate-600',
    ASSIGNED: 'border-blue-200 bg-blue-50 text-blue-700',
    UNDER_ENQUIRY: 'border-amber-200 bg-amber-50 text-amber-700',
    QUICK_DESK_REVIEW: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
    PENDING_VERIFICATION: 'border-violet-200 bg-violet-50 text-violet-700',
    REOPENED: 'border-orange-200 bg-orange-50 text-orange-700',
    MERGED: 'border-amber-200 bg-amber-50 text-amber-700',
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${tones[status] ?? 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {t(('st_' + status) as any)}
    </span>
  );
}

// ── Reopen request panel — mandatory reason, typed OR spoken ─────────────────
function ReopenPanel({ grievance, onDone }: { grievance: PublicGrievance; onDone: () => Promise<void> }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'type' | 'voice'>('type');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Server ASR (when configured): the spoken reason is recognised from the
  // audio itself — the native-script transcript travels with the request, so
  // the desk-review officer READS it right next to the playable recording.
  // The shared pipeline buffers segments while the status probe resolves and
  // degrades quietly on failures (the audio itself always travels, and the
  // server re-attempts transcription on receipt).
  const asrp = useAsrPipeline();
  const voiceText = asrp.text;
  const voiceDet = asrp.det;
  const inFlight = asrp.inFlight;

  const rec = useVoiceRecorder(asrp.feed);
  // Probe early so a sleeping API is awake by the time the citizen speaks.
  const ensureStatus = asrp.ensureStatus;
  useEffect(() => {
    ensureStatus();
  }, [ensureStatus]);
  const beginVoice = async () => {
    asrp.ensureStatus(); // never delays the mic — segments buffer meanwhile
    await rec.start();
  };
  const stopVoice = () => {
    asrp.flush();
    rec.stop();
  };
  const redoVoice = () => {
    rec.reset();
    asrp.reset();
  };

  const durationRef = useRef(0);
  useEffect(() => {
    if (rec.status === 'recording') durationRef.current = rec.elapsedSec;
  }, [rec.status, rec.elapsedSec]);

  const det = detectClientLanguage(reason);
  // Voice mode waits for the transcription queue to drain, so the officer
  // never receives a half-transcribed reason.
  const canSend = mode === 'type' ? reason.trim().length >= 6 : !!rec.blob && inFlight === 0;

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      const voiceReason = voiceText.trim();
      const body: Record<string, unknown> = {
        reason: (mode === 'voice' ? voiceReason : reason.trim()) || undefined,
        lang: mode === 'voice' ? voiceDet?.lang ?? detectClientLanguage(voiceReason)?.lang : det?.lang,
      };
      if (mode === 'voice' && rec.blob) {
        body.voiceBase64 = await blobToBase64(rec.blob);
        body.voiceMime = rec.mime;
        body.voiceDurationSec = durationRef.current || rec.elapsedSec;
      }
      await api.post(`/grievances/public/${grievance.id}/reopen-request`, body);
      await onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/50 p-4 animate-fade-up">
      <div className="text-[13.5px] font-bold text-fuchsia-800">{t('reopenWhy')}</div>

      <div className="mt-3 flex gap-1.5 rounded-xl bg-white p-1">
        <button
          onClick={() => setMode('type')}
          className={`flex-1 rounded-lg py-2 text-[12.5px] font-bold ${mode === 'type' ? 'bg-fuchsia-100 text-fuchsia-700' : 'text-slate-500'}`}
        >
          ⌨ {t('reopenTypeReason')}
        </button>
        <button
          onClick={() => setMode('voice')}
          className={`flex-1 rounded-lg py-2 text-[12.5px] font-bold ${mode === 'voice' ? 'bg-fuchsia-100 text-fuchsia-700' : 'text-slate-500'}`}
        >
          🎙 {t('reopenSpeakReason')}
        </button>
      </div>

      {mode === 'type' ? (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reopenReasonPlaceholder')}
          className="mt-3 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white p-3 text-[13.5px] leading-relaxed outline-none focus:border-fuchsia-400"
        />
      ) : (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 text-center">
          {rec.status !== 'stopped' ? (
            <>
              <button
                onClick={() => (rec.status === 'recording' ? stopVoice() : beginVoice())}
                disabled={rec.status === 'requesting'}
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-card transition active:scale-95 ${
                  rec.status === 'recording' ? 'animate-pulse bg-red-500' : 'bg-fuchsia-600'
                }`}
                aria-label={rec.status === 'recording' ? t('recStop') : t('recTapToStart')}
              >
                {rec.status === 'recording' ? '■' : '🎙'}
              </button>
              <div className="mt-2 font-mono text-lg font-bold tabular-nums text-ink">{fmtClock(rec.elapsedSec)}</div>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {rec.status === 'recording' ? t('recListening') : rec.status === 'denied' ? t('micDenied') : t('recTapToStart')}
              </p>
            </>
          ) : (
            <>
              {rec.url && <audio controls src={rec.url} className="w-full" />}
              <button onClick={redoVoice} className="mt-2 text-[12.5px] font-semibold text-slate-500 underline">↺ {t('recRedo')}</button>
            </>
          )}
          {/* native-script transcript of the spoken reason (server ASR) */}
          {(voiceText || inFlight > 0) && (
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {t('liveTranscript')}
                {voiceDet ? ` · ${voiceDet.nameNative}` : ''}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-700 font-telugu">
                {voiceText}
                {inFlight > 0 && <span className="ml-1.5 animate-pulse text-fuchsia-600">✦ {t('transcribing')}</span>}
              </p>
            </div>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">{t('recKeepAudio')}</p>
        </div>
      )}

      {det && mode === 'type' && (
        <div className="mt-2 text-[11.5px] font-semibold text-india">{t('recDetected')}: {det.nameNative} {det.nameEn}</div>
      )}
      {err && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{err}</p>}

      <button
        onClick={send}
        disabled={!canSend || busy}
        className="mt-3 w-full rounded-xl bg-fuchsia-600 py-3 text-[13.5px] font-bold text-white shadow-card disabled:opacity-40"
      >
        {busy ? '…' : `⚖️ ${t('reopenSubmit')}`}
      </button>
    </div>
  );
}

// ── Saarthi Copilot — grounded Q&A about THIS case, any language ─────────────
function Copilot({ ysr }: { ysr: string }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [thread, setThread] = useState<{ role: 'user' | 'ai'; text: string; sources?: string[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [thread]);

  async function ask() {
    const question = q.trim();
    if (!question || busy) return;
    setQ('');
    setThread((tr) => [...tr, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const r = await api.post<{ answer: string; sources: string[] }>('/grievances/public/copilot', {
        question,
        ysr,
        lang,
      });
      setThread((tr) => [...tr, { role: 'ai', text: r.answer, sources: r.sources }]);
    } catch (e) {
      setThread((tr) => [...tr, { role: 'ai', text: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center gap-2.5 border-b border-slate-100 bg-gradient-to-r from-navy-800 to-navy-700 px-5 py-3.5 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/20 text-gold" aria-hidden>✦</span>
        <div>
          <div className="font-display text-[14.5px] font-bold">{t('copilotTitle')}</div>
          <div className="text-[11.5px] text-white/60">{t('copilotHint')}</div>
        </div>
      </div>

      {thread.length > 0 && (
        <div className="max-h-72 space-y-2.5 overflow-y-auto px-4 py-3">
          {thread.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                  m.role === 'user' ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-slate-100 text-slate-800'
                }`}
              >
                {m.text}
                {m.sources && m.sources.length > 0 && (
                  <div className="mt-1.5 border-t border-slate-200/60 pt-1 text-[10.5px] text-slate-500">
                    {t('copilotSources')}: {m.sources.join(' · ')}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-[12.5px] text-slate-400">✦ {t('copilotThinking')}</div>}
          <div ref={endRef} />
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
          placeholder={t('copilotPlaceholder')}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-brand focus:bg-white"
        />
        <button
          onClick={ask}
          disabled={!q.trim() || busy}
          className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
        >
          {t('copilotSend')}
        </button>
      </div>
    </section>
  );
}

// ── Per-case blockchain view — sealed, linked blocks ─────────────────────────
function ChainView({ grievanceId }: { grievanceId: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState<ChainFeed | null>(null);

  useEffect(() => {
    if (open && !feed) {
      api.get<ChainFeed>(`/ledger/chain/${grievanceId}`).then(setFeed).catch(() => {});
    }
  }, [open, feed, grievanceId]);

  const blocks = feed ? [...feed.blocks].sort((a, b) => a.seq - b.seq) : [];

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] font-bold text-slate-600"
      >
        <span>⛓ {t('viewChain')}</span>
        <span aria-hidden>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="mt-3 animate-fade-up">
          <p className="text-[12px] leading-relaxed text-slate-400">{t('chainIntro')}</p>
          <div className="mt-3 space-y-0">
            {!feed && <div className="py-4 text-center text-[12.5px] text-slate-400">…</div>}
            {blocks.map((b, i) => (
              <div key={b.seq} className="relative pl-6">
                {i < blocks.length - 1 && <span className="absolute left-[9px] top-7 h-[calc(100%-14px)] w-0.5 bg-gradient-to-b from-brand/40 to-brand/10" aria-hidden />}
                <span className={`absolute left-0 top-1.5 flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-bold text-white ${b.verified ? 'bg-brand' : 'bg-red-500'}`} aria-hidden>
                  {b.verified ? '✓' : '!'}
                </span>
                <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[10.5px] font-bold text-slate-400">#{b.seq}</span>
                    <span className="text-[12.5px] font-bold text-ink">{b.eventType.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-slate-400">· {b.actorRole}</span>
                    <span className={`ml-auto text-[10px] font-bold ${b.verified ? 'text-india' : 'text-red-600'}`}>
                      {b.verified ? `✓ ${t('blockVerified')}` : '✗'}
                    </span>
                  </div>
                  <div className="mt-1.5 grid gap-0.5 font-mono text-[10px] leading-relaxed text-slate-400">
                    <span className="truncate">hash {b.blockHash.slice(0, 34)}…</span>
                    <span className="truncate">prev {b.prevHash.slice(0, 34)}…</span>
                  </div>
                  <div className="mt-1 text-[10.5px] text-slate-400">{new Date(b.ts).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
