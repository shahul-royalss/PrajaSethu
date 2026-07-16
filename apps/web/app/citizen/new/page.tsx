'use client';

// SAARTHI 2.0 intake — voice-first, zero-interruption, no department picker.
// The citizen chooses HOW to complain (speak / type), never WHERE it goes:
// language is auto-detected live, the AI extracts + classifies, and the 95%
// gate decides auto-route vs human verification. The original recording is
// uploaded untouched as evidence and travels with the ticket.

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '../../lib/intl';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { Logo } from '../../components/Logo';
import { api } from '../../lib/api';
import { getCitizen, getCitizenToken } from '../../lib/session';
import { useContinuousTranscript } from '../../lib/speech';
import { blobToBase64, fmtClock, useVoiceRecorder } from '../../lib/recorder';
import { ALL_LANGUAGES_STRIP, detectClientLanguage, ClientLangDetection } from '../../lib/langdetect';

interface Geography {
  districts: string[];
  mandalsByDistrict: Record<string, string[]>;
  villagesByMandal: Record<string, string[]>;
}

interface TriageResult {
  id: string;
  ysr: string;
  status: string;
  triage: {
    gate: 'AUTO_ROUTED' | 'HUMAN_VERIFICATION' | 'MERGED' | 'OPERATOR';
    language: { code: string; confidence: number; codeSwitched: boolean; nameEn: string; nameNative: string };
    issue: string;
    summaryEn: string;
    summaryTe: string;
    severity: string;
    urgency: string;
    safetyFlag: boolean;
    department: { id: string } | null;
    confidence: number | null;
    top3: { deptId: string; name: string; probability: number }[] | null;
    officer: { name: string; designation: string | null } | null;
    slaDueAt: string | null;
    merged: { canonicalYsr: string; reportCount: number } | null;
  };
}

type Phase = 'method' | 'voice' | 'type' | 'details' | 'submitting' | 'result';

interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
}

export default function NewComplaintPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('method');
  const [text, setText] = useState('');
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceMime, setVoiceMime] = useState('audio/webm');
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [detected, setDetected] = useState<ClientLangDetection | null>(null);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = typeof window !== 'undefined' && !!getCitizenToken() && !!getCitizen();

  // Keep this surface reachable only in a sane state (mobile back etc.).
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) setError(null);
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const backToMethod = () => {
    setPhase('method');
    setText('');
    setVoiceBlob(null);
    setDetected(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
          <Link href={signedIn ? '/citizen' : '/'} aria-label={t('back')} className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
            </span>
            <Logo size={28} showSub={false} />
          </Link>
          <LanguageSwitcher compact />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-24 pt-5">
        {phase === 'method' && <MethodChoice onVoice={() => setPhase('voice')} onType={() => setPhase('type')} />}
        {phase === 'voice' && (
          <VoiceCapture
            uiSpeech={langSpeech(lang)}
            onBack={backToMethod}
            onDone={(blob, mime, durationSec, transcript, det) => {
              setVoiceBlob(blob);
              setVoiceMime(mime);
              setVoiceDuration(durationSec);
              setText(transcript);
              setDetected(det);
              setPhase('details');
            }}
          />
        )}
        {phase === 'type' && (
          <TypeCapture
            initial={text}
            onBack={backToMethod}
            onDone={(typed, det) => {
              setText(typed);
              setDetected(det);
              setVoiceBlob(null);
              setPhase('details');
            }}
          />
        )}
        {phase === 'details' && (
          <Details
            signedIn={signedIn}
            hasVoice={!!voiceBlob}
            text={text}
            detected={detected}
            error={error}
            onBack={() => setPhase(voiceBlob ? 'voice' : 'type')}
            onSubmit={async (details) => {
              setPhase('submitting');
              setError(null);
              try {
                const token = getCitizenToken() ?? undefined;
                const body: Record<string, unknown> = {
                  channel: 'CITIZEN_APP',
                  language: detected?.lang ?? lang,
                  description: text || undefined,
                  detectedLang: detected?.lang,
                  langConfidence: detected?.confidence,
                  codeSwitched: detected?.codeSwitched,
                  mobile: details.mobile || undefined,
                  district: details.district || undefined,
                  mandal: details.mandal || undefined,
                  village: details.village || undefined,
                  grievanceDistrict: details.district || undefined,
                  grievanceMandal: details.mandal || undefined,
                  grievanceVillage: details.village || undefined,
                  geoLat: details.geo?.lat,
                  geoLng: details.geo?.lng,
                  geoAccuracy: details.geo?.accuracy,
                  consent: true,
                };
                if (voiceBlob) {
                  body.voiceBase64 = await blobToBase64(voiceBlob);
                  body.voiceMime = voiceMime;
                  body.voiceDurationSec = voiceDuration;
                }
                const res = await api.post<TriageResult>('/grievances', body, token);
                setResult(res);
                setPhase('result');
              } catch (e) {
                setError((e as Error).message);
                setPhase('details');
              }
            }}
          />
        )}
        {phase === 'submitting' && <PipelineAnimation />}
        {phase === 'result' && result && <ResultCard result={result} signedIn={signedIn} onAnother={() => { setResult(null); backToMethod(); }} />}
      </main>
    </div>
  );
}

function langSpeech(code: string): string {
  const map: Record<string, string> = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN', or: 'or-IN', ur: 'ur-IN' };
  return map[code] ?? 'en-IN';
}

// ── Phase 1 · method choice (§3) — exactly two actions, no language picker ──
function MethodChoice({ onVoice, onType }: { onVoice: () => void; onType: () => void }) {
  const { t } = useI18n();
  const [stripIdx, setStripIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStripIdx((i) => (i + 1) % ALL_LANGUAGES_STRIP.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{t('howToComplain')}</h1>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{t('noDeptNeeded')}</p>

      <button
        onClick={onVoice}
        className="group mt-6 block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-navy-800 via-navy-700 to-brand-light p-6 text-left text-white shadow-lift transition active:scale-[0.985]"
      >
        <div className="flex items-center gap-4">
          <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <span className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 transition group-active:opacity-100" />
            <MicIcon className="h-8 w-8 text-gold" />
          </span>
          <span>
            <span className="block font-display text-xl font-bold">{t('speakComplaint')}</span>
            <span className="mt-0.5 block text-[13px] text-white/75">{t('speakComplaintHint')}</span>
          </span>
        </div>
      </button>

      <button
        onClick={onType}
        className="group mt-3.5 block w-full rounded-3xl border border-slate-200 bg-white p-6 text-left shadow-card transition hover:border-brand/30 active:scale-[0.985]"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-royal-soft">
            <KeyboardIcon className="h-8 w-8 text-brand" />
          </span>
          <span>
            <span className="block font-display text-xl font-bold text-ink">{t('typeComplaint')}</span>
            <span className="mt-0.5 block text-[13px] text-slate-500">{t('typeComplaintHint')}</span>
          </span>
        </div>
      </button>

      {/* quiet coverage strip — all 22 scheduled languages cycle by */}
      <div className="mt-7 flex items-center justify-center gap-2 text-[12.5px] text-slate-400">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-india" aria-hidden />
        <span key={stripIdx} className="animate-fade-up font-medium text-slate-500">{ALL_LANGUAGES_STRIP[stripIdx]}</span>
        <span>· {ALL_LANGUAGES_STRIP.length} languages, auto-detected</span>
      </div>
    </div>
  );
}

// ── Phase 2a · continuous voice capture (§4.1 recording contract) ───────────
function VoiceCapture({
  uiSpeech,
  onBack,
  onDone,
}: {
  uiSpeech: string;
  onBack: () => void;
  onDone: (blob: Blob, mime: string, durationSec: number, transcript: string, det: ClientLangDetection | null) => void;
}) {
  const { t } = useI18n();
  const rec = useVoiceRecorder();
  const [srLang, setSrLang] = useState(uiSpeech);
  const st = useContinuousTranscript(srLang);
  const [det, setDet] = useState<ClientLangDetection | null>(null);
  const finalDurationRef = useRef(0);

  const fullText = (st.finalText + ' ' + st.interim).trim();

  // Live, silent language detection — the badge updates, the recording never pauses.
  useEffect(() => {
    const d = detectClientLanguage(fullText);
    if (d && d.confidence >= 0.6) {
      setDet(d);
      // Re-aim the recogniser at the detected language; it applies on its next
      // silent auto-restart (never interrupts the citizen or the recording).
      if (d.speech !== srLang && d.confidence >= 0.75) setSrLang(d.speech);
    }
  }, [fullText, srLang]);

  useEffect(() => {
    if (rec.status === 'recording') finalDurationRef.current = rec.elapsedSec;
  }, [rec.status, rec.elapsedSec]);

  const begin = async () => {
    await rec.start();
    st.begin();
  };
  const finish = () => {
    st.end();
    rec.stop();
  };

  const recording = rec.status === 'recording' || rec.status === 'paused';

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between">
        <button onClick={() => { st.end(); rec.reset(); onBack(); }} className="text-sm font-semibold text-slate-500">← {t('back')}</button>
        {det && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-india/25 bg-india/5 px-3 py-1 text-[12px] font-semibold text-india animate-fade-up">
            <span className="h-1.5 w-1.5 rounded-full bg-india" aria-hidden />
            {t('recDetected')}: {det.nameNative} {det.nameEn} · {Math.round(det.confidence * 100)}%
          </span>
        )}
      </div>

      {/* idle → big mic; recording → waveform + controls; stopped → review */}
      {rec.status !== 'stopped' ? (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-card">
          <div className="relative mx-auto flex h-40 w-40 items-center justify-center">
            {recording && rec.status === 'recording' && (
              <>
                <span className="absolute inset-0 animate-ping rounded-full bg-red-500/10" />
                <span className="absolute inset-3 animate-pulse rounded-full bg-red-500/10" />
              </>
            )}
            <button
              onClick={recording ? finish : begin}
              disabled={rec.status === 'requesting'}
              aria-label={recording ? t('recStop') : t('recTapToStart')}
              className={`relative flex h-28 w-28 items-center justify-center rounded-full shadow-lift transition active:scale-95 ${
                recording ? 'bg-red-500 text-white' : 'bg-gradient-to-br from-navy-700 to-brand-light text-white'
              }`}
            >
              {recording ? <StopIcon className="h-10 w-10" /> : <MicIcon className="h-11 w-11" />}
            </button>
          </div>

          <div className="mt-2 font-mono text-3xl font-bold tabular-nums text-ink">{fmtClock(rec.elapsedSec)}</div>
          <p className="mt-1 text-[13px] text-slate-500">
            {rec.status === 'idle' && t('recTapToStart')}
            {rec.status === 'requesting' && '…'}
            {rec.status === 'recording' && t('recListening')}
            {rec.status === 'paused' && t('recResume')}
            {rec.status === 'denied' && t('micDenied')}
            {rec.status === 'error' && t('micError')}
          </p>

          {/* live waveform — always visible while recording (§4.1) */}
          <div className="mx-auto mt-4 flex h-14 items-end justify-center gap-[3px]" aria-hidden>
            {rec.levels.map((v, i) => (
              <span
                key={i}
                className={`w-[4px] rounded-full transition-[height] duration-100 ${recording ? 'bg-brand-light' : 'bg-slate-200'}`}
                style={{ height: `${Math.max(6, v * 56)}px` }}
              />
            ))}
          </div>

          {recording && (
            <div className="mt-4 flex items-center justify-center gap-3">
              {rec.status === 'recording' ? (
                <button onClick={rec.pause} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">⏸ {t('recPause')}</button>
              ) : (
                <button onClick={rec.resume} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">▶ {t('recResume')}</button>
              )}
              <button onClick={finish} className="rounded-xl bg-red-500 px-5 py-2 text-sm font-bold text-white">■ {t('recStop')}</button>
            </div>
          )}

          {rec.warning && rec.remainingSec == null && (
            <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[12.5px] font-medium text-amber-800">{t('recWarn8')}</p>
          )}
          {rec.remainingSec != null && (
            <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-bold text-red-700">{t('recCountdown', { n: rec.remainingSec })}</p>
          )}

          {/* live transcript (what the working text will be) */}
          {fullText && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-left">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('liveTranscript')}</div>
              <p className="mt-1 max-h-24 overflow-y-auto text-[13.5px] leading-relaxed text-slate-700">{fullText}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-card">
          <h2 className="font-display text-lg font-bold text-ink">{t('recReview')}</h2>
          {rec.url && <audio controls src={rec.url} className="mt-3 w-full" preload="metadata" />}
          <div className="mt-2 flex items-center justify-between text-[12.5px] text-slate-500">
            <span>{fmtClock(finalDurationRef.current || rec.elapsedSec)}</span>
            {det && <span>{det.nameNative} · {Math.round(det.confidence * 100)}%</span>}
          </div>
          {st.finalText && (
            <div className="mt-3 rounded-2xl bg-slate-50 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('liveTranscript')}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-slate-700">{st.finalText}</p>
            </div>
          )}
          <p className="mt-3 text-[12px] leading-relaxed text-slate-400">🔒 {t('recKeepAudio')}</p>
          <div className="mt-5 flex gap-2.5">
            <button onClick={() => { rec.reset(); setDet(null); st.setFinalText(''); }} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-600">
              ↺ {t('recRedo')}
            </button>
            <button
              onClick={() => rec.blob && onDone(rec.blob, rec.mime, finalDurationRef.current || rec.elapsedSec, st.finalText.trim(), det)}
              className="flex-[1.4] rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-card"
            >
              {t('recUseIt')} →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Phase 2b · typed complaint with live script detection (§5) ──────────────
function TypeCapture({ initial, onBack, onDone }: { initial: string; onBack: () => void; onDone: (text: string, det: ClientLangDetection | null) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(initial);
  const det = useMemo(() => detectClientLanguage(value), [value]);

  return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm font-semibold text-slate-500">← {t('back')}</button>
        {det && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-india/25 bg-india/5 px-3 py-1 text-[12px] font-semibold text-india animate-fade-up">
            <span className="h-1.5 w-1.5 rounded-full bg-india" aria-hidden />
            {det.nameNative} {det.nameEn} · {Math.round(det.confidence * 100)}%
          </span>
        )}
      </div>
      <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
        <h1 className="font-display text-xl font-bold text-ink">{t('typeComplaint')}</h1>
        <textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('typeHere')}
          className="mt-3 min-h-[180px] w-full rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-[15px] leading-relaxed text-ink outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
        />
        <button
          onClick={() => onDone(value.trim(), det)}
          disabled={value.trim().length < 8}
          className="mt-4 w-full rounded-xl bg-brand py-3.5 text-sm font-bold text-white shadow-card disabled:opacity-40"
        >
          {t('next')} →
        </button>
      </div>
    </div>
  );
}

// ── Phase 3 · minimal details: live location + place (+ mobile for guests) ──
function Details({
  signedIn,
  hasVoice,
  text,
  detected,
  error,
  onBack,
  onSubmit,
}: {
  signedIn: boolean;
  hasVoice: boolean;
  text: string;
  detected: ClientLangDetection | null;
  error: string | null;
  onBack: () => void;
  onSubmit: (d: { mobile: string; district: string; mandal: string; village: string; geo: GeoFix | null }) => void;
}) {
  const { t } = useI18n();
  const [geo, setGeo] = useState<Geography | null>(null);
  const [district, setDistrict] = useState('Chittoor');
  const [mandal, setMandal] = useState('Kuppam');
  const [village, setVillage] = useState('');
  const [mobile, setMobile] = useState('');
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [fixState, setFixState] = useState<'idle' | 'getting' | 'ok' | 'denied'>('idle');

  useEffect(() => {
    api.get<Geography>('/reference/geography').then(setGeo).catch(() => {});
  }, []);

  const capture = useCallback(() => {
    if (!navigator.geolocation) {
      setFixState('denied');
      return;
    }
    setFixState('getting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFix({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
        setFixState('ok');
      },
      () => setFixState('denied'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }, []);

  // Ask for the live location proactively — it is the single most useful field
  // for the officer, and consent copy explains exactly why.
  useEffect(() => {
    capture();
  }, [capture]);

  const canSubmit = (signedIn || mobile.length === 10) && district && mandal;

  return (
    <div className="animate-fade-up">
      <button onClick={onBack} className="text-sm font-semibold text-slate-500">← {t('back')}</button>

      {/* what we understood so far */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{hasVoice ? `🎙 ${t('speakComplaint')}` : `⌨ ${t('typeComplaint')}`}</span>
          {detected && <span className="text-[12px] font-semibold text-india">{detected.nameNative} · {Math.round(detected.confidence * 100)}%</span>}
        </div>
        <p className="mt-1.5 line-clamp-3 text-[13.5px] leading-relaxed text-slate-700">{text || '🎙 (voice only — audio travels with the complaint)'}</p>
      </div>

      {/* live location */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <PinIcon className="h-5 w-5 text-brand" />
          <h2 className="text-[15px] font-bold text-ink">{t('yourLocation')}</h2>
        </div>
        <p className="mt-1 text-[12.5px] text-slate-500">{t('locationWhy')}</p>
        <div className="mt-3">
          {fixState === 'ok' && fix && (
            <div className="flex items-center justify-between rounded-xl border border-india/25 bg-india/5 px-3 py-2.5">
              <span className="text-[13px] font-semibold text-india">✓ {t('locationCaptured', { m: fix.accuracy })}</span>
              <span className="font-mono text-[11px] text-slate-400">{fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}</span>
            </div>
          )}
          {fixState === 'getting' && <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">📡 …</div>}
          {(fixState === 'denied' || fixState === 'idle') && (
            <div className="flex items-center gap-2">
              <button onClick={capture} className="flex-1 rounded-xl bg-brand/10 px-3 py-2.5 text-[13px] font-bold text-brand">📍 {t('locationCapture')}</button>
              {fixState === 'denied' && <span className="flex-1 text-[12px] text-slate-400">{t('locationDenied')}</span>}
            </div>
          )}
        </div>
      </section>

      {/* place (fallback + human-readable) */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <h2 className="text-[15px] font-bold text-ink">{t('whereIsIt')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <select value={district} onChange={(e) => { setDistrict(e.target.value); setMandal(''); setVillage(''); }} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[13.5px] text-ink">
            {(geo?.districts ?? ['Chittoor']).map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={mandal} onChange={(e) => { setMandal(e.target.value); setVillage(''); }} className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[13.5px] text-ink">
            <option value="">—</option>
            {(geo?.mandalsByDistrict[district] ?? ['Kuppam']).map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <input
          value={village}
          onChange={(e) => setVillage(e.target.value)}
          placeholder={t('qVillage')}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-brand"
          list="villages"
        />
        <datalist id="villages">
          {(geo?.villagesByMandal[mandal] ?? []).map((v) => <option key={v} value={v} />)}
        </datalist>
      </section>

      {!signedIn && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
          <h2 className="text-[15px] font-bold text-ink">{t('qMobile')}</h2>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3">
            <span className="text-[13.5px] font-semibold text-slate-400">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="98765 43210"
              className="w-full bg-transparent py-2.5 text-[15px] text-ink outline-none"
            />
          </div>
        </section>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-medium text-red-700">{error}</p>}

      <button
        onClick={() => onSubmit({ mobile, district, mandal, village, geo: fix })}
        disabled={!canSubmit}
        className="mt-5 w-full rounded-2xl bg-gradient-to-r from-navy-700 to-brand-light py-4 font-display text-[15px] font-bold text-white shadow-lift transition active:scale-[0.985] disabled:opacity-40"
      >
        {t('submitComplaint')} →
      </button>
      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-slate-400">{t('consentNote')}</p>
    </div>
  );
}

// ── Phase 4 · pipeline animation while the AI works ─────────────────────────
function PipelineAnimation() {
  const { t } = useI18n();
  const steps = ['🎙 Audio sealed as evidence', '🌐 Detecting language', '🧠 Understanding the problem', '🏛 Choosing the department', '🔍 Checking for duplicates nearby', '⛓ Writing to the ledger'];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => Math.min(v + 1, steps.length - 1)), 700);
    return () => clearInterval(id);
  }, [steps.length]);
  return (
    <div className="animate-fade-up mt-10 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-card">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand" aria-hidden />
      <h2 className="mt-5 font-display text-lg font-bold text-ink">{t('aiRouting')}</h2>
      <ul className="mx-auto mt-4 max-w-[260px] space-y-1.5 text-left">
        {steps.map((s, idx) => (
          <li key={s} className={`flex items-center gap-2 text-[13px] transition ${idx <= i ? 'text-slate-700' : 'text-slate-300'}`}>
            <span className={idx < i ? 'text-india' : idx === i ? 'animate-pulse text-brand' : ''}>{idx < i ? '✓' : '•'}</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Phase 5 · triage result ──────────────────────────────────────────────────
function ResultCard({ result, signedIn, onAnother }: { result: TriageResult; signedIn: boolean; onAnother: () => void }) {
  const { t, lang } = useI18n();
  const tr = result.triage;
  const te = lang === 'te';

  return (
    <div className="animate-fade-up">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lift">
        {/* gate banner */}
        {tr.gate === 'MERGED' && tr.merged ? (
          <div className="bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-4 text-white">
            <div className="font-display text-lg font-bold">🤝 {t('aiMergedTitle')}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-white/90">
              {t('aiMergedBody', { n: tr.merged.reportCount, ysr: tr.merged.canonicalYsr })}
            </p>
          </div>
        ) : tr.gate === 'HUMAN_VERIFICATION' ? (
          <div className="bg-gradient-to-r from-navy-700 to-navy-600 px-5 py-4 text-white">
            <div className="font-display text-lg font-bold">🧑‍⚖️ {t('st_PENDING_VERIFICATION')}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-white/85">{t('aiNeedsHuman')}</p>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-india to-emerald-500 px-5 py-4 text-white">
            <div className="font-display text-lg font-bold">✅ {t('successTitle')}</div>
            {tr.confidence != null && (
              <p className="mt-1 text-[13px] text-white/90">
                ⚡ {t('aiRouted')} · {t('aiConfidencePct', { p: Math.round(tr.confidence * 100) })}
              </p>
            )}
          </div>
        )}

        <div className="p-5">
          <div className="rounded-2xl bg-slate-50 p-4 text-center">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('yourNumber')}</div>
            <div className="mt-1 font-mono text-[22px] font-extrabold tracking-tight text-brand">{result.ysr}</div>
          </div>

          {/* AI understanding */}
          <div className="mt-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip tone="navy">{tr.language.nameNative} {Math.round((tr.language.confidence ?? 0) * 100)}%</Chip>
              <Chip tone={tr.severity === 'CRITICAL' ? 'red' : tr.severity === 'HIGH' ? 'amber' : 'slate'}>
                {t('severityLabel')}: {t(('sev_' + tr.severity) as any)}
              </Chip>
              <Chip tone={tr.urgency === 'IMMEDIATE' ? 'red' : 'slate'}>{t('urgencyLabel')}: {t(('urg_' + tr.urgency) as any)}</Chip>
              {tr.safetyFlag && <Chip tone="red">⚠ Safety</Chip>}
            </div>
            <p className={`text-[13.5px] leading-relaxed text-slate-700 ${te ? 'font-telugu' : ''}`}>{te && tr.summaryTe ? tr.summaryTe : tr.summaryEn}</p>
          </div>

          {/* routed to */}
          {tr.officer && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 p-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 font-display text-[15px] font-bold text-brand">
                {tr.officer.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{t('yourOfficer')}</div>
                <div className="truncate text-[14px] font-bold text-ink">{tr.officer.name}</div>
                {tr.officer.designation && <div className="truncate text-[12px] text-slate-500">{tr.officer.designation}</div>}
              </div>
            </div>
          )}

          {/* AI top-3 shown when a human will verify */}
          {tr.gate === 'HUMAN_VERIFICATION' && tr.top3 && (
            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">AI suggestions</div>
              <div className="mt-2 space-y-1.5">
                {tr.top3.map((s) => (
                  <div key={s.deptId} className="flex items-center justify-between text-[13px]">
                    <span className="text-slate-700">{s.name}</span>
                    <span className="font-mono text-[12px] text-slate-400">{Math.round(s.probability * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2.5">
            <Link
              href={`/track/${tr.gate === 'MERGED' && tr.merged ? result.ysr : result.ysr}`}
              className="flex-1 rounded-xl bg-brand py-3 text-center text-sm font-bold text-white shadow-card"
            >
              {t('trackNow')}
            </Link>
            <button onClick={onAnother} className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-600">
              {t('fileAnother')}
            </button>
          </div>
          {signedIn && (
            <Link href="/citizen" className="mt-2.5 block text-center text-[13px] font-semibold text-brand">
              {t('navHome')} →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: 'navy' | 'red' | 'amber' | 'slate' }) {
  const cls =
    tone === 'navy'
      ? 'border-brand/20 bg-brand/5 text-brand'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${cls}`}>{children}</span>;
}

// ── icons ────────────────────────────────────────────────────────────────────
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" />
    </svg>
  );
}
function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
function KeyboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <line x1="6" y1="10" x2="6" y2="10" /><line x1="10" y1="10" x2="10" y2="10" /><line x1="14" y1="10" x2="14" y2="10" /><line x1="18" y1="10" x2="18" y2="10" />
      <line x1="8" y1="14" x2="16" y2="14" />
    </svg>
  );
}
function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}
