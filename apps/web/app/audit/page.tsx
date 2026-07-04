'use client';

import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { LoginGate } from '../components/LoginGate';
import { Card, CardBody, ErrorNote, Pill, Spinner } from '../components/ui';
import { Officer } from '../lib/session';
import { api } from '../lib/api';
import { fmtDate } from '../lib/i18n';

function Audit({ token, officer }: { token: string; officer: Officer }) {
  const [ledger, setLedger] = useState<any>(null);
  const [fraud, setFraud] = useState<any>(null);
  const [corruption, setCorruption] = useState<any[] | null>(null);
  const [access, setAccess] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<any>('/audit/ledger-status', token).then(setLedger).catch((e) => setError(e.message));
    api.get<any>('/audit/fraudulent-closures', token).then(setFraud).catch(() => {});
    api.get<any[]>('/audit/access-transparency', token).then(setAccess).catch(() => {});
    if (officer.role === 'AUDITOR') api.get<any[]>('/audit/corruption-queue', token).then(setCorruption).catch(() => {});
  }, [token, officer.role]);

  if (error) return <main className="mx-auto max-w-3xl p-6"><ErrorNote>{error}</ErrorNote></main>;

  const v = ledger?.verification;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-lg font-bold text-slate-900">Audit & anti-corruption console <Pill tone="red">restricted</Pill></h1>

      {/* Ledger verification */}
      <Card className={v ? (v.ok ? 'border-teal-300' : 'border-red-300') : ''}>
        <CardBody>
          {!ledger && <Spinner label="Verifying ledger…" />}
          {ledger && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{v.ok ? '🛡' : '⚠'}</span>
                <div>
                  <div className="text-sm font-bold text-slate-900">{v.ok ? 'Ledger verified — no tampering' : `TAMPER at #${v.brokenAt}: ${v.reason}`}</div>
                  <div className="text-xs text-slate-500">{ledger.totalEvents} events · DB-vs-ledger checked {fmtDate(v.lastCheckedAt)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {ledger.recent.slice(0, 6).map((e: any) => <Pill key={e.seq} tone="slate">#{e.seq} {e.eventType}</Pill>)}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Fraudulent closures */}
        <Card>
          <CardBody>
            <div className="mb-2 text-sm font-semibold text-slate-800">Fraudulent-closure review</div>
            {!fraud && <Spinner />}
            {fraud && fraud.count === 0 && <div className="text-sm text-slate-400">No suspicious closures.</div>}
            {fraud && fraud.items?.map((f: any) => (
              <div key={f.ysr} className="mb-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-mono text-xs">{f.ysr}</span> — resolved {f.minutes} min after assignment{f.evidence === 0 ? ', no evidence' : ''}
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Confidential corruption queue (auditor only) */}
        <Card>
          <CardBody>
            <div className="mb-2 text-sm font-semibold text-slate-800">Confidential corruption queue</div>
            {officer.role !== 'AUDITOR' && <div className="text-sm text-slate-400">Auditor role required.</div>}
            {officer.role === 'AUDITOR' && !corruption && <Spinner />}
            {corruption && corruption.length === 0 && <div className="text-sm text-slate-400">Queue empty.</div>}
            {corruption?.map((c) => (
              <div key={c.ysr} className="mb-1.5 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-mono text-xs">{c.ysr}</span> · {c.subject}
                <span className="block text-xs text-slate-500">Complainant: <b>{c.complainant}</b> (identity masked) · {c.mandal}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Access transparency */}
      <Card className="mt-4">
        <CardBody>
          <div className="mb-2 text-sm font-semibold text-slate-800">Access transparency — X-Road cross-department pulls</div>
          {!access && <Spinner />}
          {access && access.length === 0 && <div className="text-sm text-slate-400">No cross-department data pulls yet.</div>}
          {access && access.length > 0 && (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400"><th className="pb-1">Service</th><th>To member</th><th>Requested by</th><th>Purpose</th><th>When</th></tr></thead>
              <tbody>
                {access.map((a) => (
                  <tr key={a.exchangeId} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{a.service}</td>
                    <td className="text-slate-500">{a.toMember}</td>
                    <td className="text-slate-500">{a.requestedBy}</td>
                    <td className="text-slate-500">{a.purpose}</td>
                    <td className="text-slate-400">{fmtDate(a.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </main>
  );
}

export default function AuditPage() {
  return (
    <div className="min-h-screen">
      <Header title="Audit" />
      <LoginGate allowedRoles={['AUDITOR', 'COLLECTOR']} title="Audit sign-in">
        {({ token, officer }) => <Audit token={token} officer={officer} />}
      </LoginGate>
    </div>
  );
}
