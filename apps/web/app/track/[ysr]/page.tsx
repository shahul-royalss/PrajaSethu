'use client';

import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '../../components/Header';
import { Button, Card, CardBody, ErrorNote, Pill, Spinner, StatusBadge } from '../../components/ui';
import { Timeline } from '../../components/Timeline';
import { IntegrityShield } from '../../components/IntegrityShield';
import { api, ApiError } from '../../lib/api';
import { Bilingual, PublicGrievance } from '../../lib/types';
import { daysLeft, fmtDate } from '../../lib/i18n';
import { GENERAL_HELPLINE, helplineFor } from '../../lib/departments';
import { useI18n } from '../../lib/intl';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';

export default function TrackView() {
  const params = useParams<{ ysr: string }>();
  const ysr = decodeURIComponent(params.ysr);
  const { t } = useI18n();
  const [g, setG] = useState<PublicGrievance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    const u = new SpeechSynthesisUtterance(g.plainStatus.te);
    u.lang = 'te-IN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  async function confirmClosure(satisfied: boolean) {
    if (!g) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.post(`/grievances/public/${g.id}/confirm-closure`, {
        satisfied,
        benefitReceived: g.category === 'FINANCE' ? true : undefined,
        rating: satisfied ? 5 : undefined,
        comment: satisfied ? 'Resolved to my satisfaction.' : 'Not satisfied — please reopen.',
      });
      setMsg(satisfied ? 'Thank you — your grievance is now closed.' : 'Reopened and escalated to a higher authority.');
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const dl = daysLeft(g?.slaDueAt);

  return (
    <div className="min-h-screen">
      <Header title="Track" backHref="/track" right={<div className="flex items-center gap-3"><LanguageSwitcher compact /><Link href="/track" className="text-sm text-brand hover:underline">{t('trackByNumber')}</Link></div>} />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {loading && <Spinner label="Loading your grievance…" />}
        {error && (
          <div className="space-y-3">
            <ErrorNote>{error}</ErrorNote>
            <Link href="/track" className="text-sm text-brand hover:underline">← Try another ID</Link>
          </div>
        )}

        {g && (
          <div className="space-y-4">
            <Card>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-telugu text-sm text-slate-500">మీ ఫిర్యాదు</div>
                    <div className="font-mono text-lg font-bold text-slate-900">{g.ysr}</div>
                    <div className="mt-1 text-sm text-slate-600">
                      {g.subject?.en ?? 'Grievance'} {g.department ? `· ${g.department.en}` : ''}
                    </div>
                  </div>
                  <button onClick={readAloud} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" title="Read aloud (Telugu)">
                    🔊
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={g.status} />
                  {g.emergency && <Pill tone="red">🚨 Emergency lane</Pill>}
                  {g.slaBreachPredicted && <Pill tone="amber">⚠ SLA at risk</Pill>}
                  <Pill tone="purple">{`Level ${g.currentLevel}`}</Pill>
                </div>

                {/* Plain-language status (LLM, AI-labelled) */}
                <div className="mt-4 rounded-lg bg-slate-50 p-3">
                  <p className="font-telugu text-sm text-slate-800">{g.plainStatus.te}</p>
                  <p className="mt-1 text-sm text-slate-500">{g.plainStatus.en}</p>
                  {g.plainStatus.aiGenerated && <p className="mt-1 text-[11px] text-slate-400">↳ Plain-language summary · AI-generated</p>}
                </div>

                {dl !== null && g.status !== 'CLOSED' && (
                  <div className="mt-3 text-sm">
                    <span className={`font-semibold ${dl < 0 ? 'text-red-600' : dl <= 2 ? 'text-amber-600' : 'text-slate-700'}`}>
                      ⏳ SLA: {dl < 0 ? `${Math.abs(dl)} day(s) overdue` : `${dl} day(s) left`}
                    </span>
                    <span className="text-slate-400"> · due {fmtDate(g.slaDueAt)}</span>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <IntegrityShield grievanceId={g.id} />
              </CardBody>
            </Card>

            {g.status === 'RESOLVED' && (
              <Card className="border-green-200">
                <CardBody className="space-y-3">
                  <div className="text-sm font-semibold text-slate-800">{t('resolvedAsk')}</div>
                  <p className="text-xs text-slate-500">{t('resolvedAskNote')}</p>
                  {msg && <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{msg}</div>}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => confirmClosure(true)} disabled={busy} variant="primary">✓ {t('closeYes')}</Button>
                    <Button onClick={() => confirmClosure(false)} disabled={busy} variant="ghost">✗ {t('reopenNo')}</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody>
                <div className="mb-3 text-sm font-semibold text-slate-800">Timeline</div>
                <Timeline events={g.timeline} />
              </CardBody>
            </Card>

            <AssistPanel department={g.department} />
          </div>
        )}
      </main>
    </div>
  );
}

// "Talk to assistant" → the concerned department's helpline for THIS complaint
// (mapped from the grievance's department), with the general 1902 line as backup.
function AssistPanel({ department }: { department: Bilingual | null }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const number = helplineFor(department?.en);
  const deptName = department ? (lang === 'te' ? department.te : department.en) : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <a href={`tel:${GENERAL_HELPLINE}`} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700">
          📞 {t('callHelpline')}
        </a>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`rounded-lg border px-3.5 py-2 text-sm font-semibold ${open ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-slate-700'}`}
        >
          🎙 {t('talkToAssistant')}
        </button>
      </div>

      {open && (
        <Card className="animate-fade-up border-brand/25">
          <CardBody className="space-y-2.5">
            {deptName && (
              <div className="text-sm text-slate-600">
                {t('assistDept')}: <b className="text-slate-900">{deptName}</b>
              </div>
            )}
            <a
              href={`tel:${number}`}
              className="flex items-center justify-between gap-3 rounded-xl bg-india px-4 py-3 font-semibold text-white shadow-sm transition hover:brightness-110"
            >
              <span>📞 {department ? t('assistCallDept') : t('assistGeneral')}</span>
              <span className="font-mono text-xl font-extrabold tracking-wide">{number}</span>
            </a>
            {number !== GENERAL_HELPLINE && (
              <a
                href={`tel:${GENERAL_HELPLINE}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <span>{t('assistGeneral')}</span>
                <span className="font-mono text-base font-bold">{GENERAL_HELPLINE}</span>
              </a>
            )}
            <p className="text-xs text-slate-500">{t('assistVisit')}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
