'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { LoginGate } from '../components/LoginGate';
import { Button, Card, CardBody, ErrorNote, Pill, Spinner, Stat } from '../components/ui';

interface SupervisorData {
  open: number;
  overdue: number;
  reopened: number;
  avgResolveDays: number;
  satisfaction: number | null;
  slaCompliance: number | null;
  escalationsPending: number;
  byDept: { dept: string; count: number }[];
  officerLoad: { officer: string; role: string; load: number; overdue: number }[];
  anomalies: { fastClosures: { ysr: string; minutes: number; evidence: number; reason: string }[] };
}

function Supervisor({ token }: { token: string }) {
  const [data, setData] = useState<SupervisorData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api'}/dashboard/supervisor`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!r.ok) throw new Error((await r.json()).message ?? 'Failed');
      setData(await r.json());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function sweep() {
    setBusy(true);
    setSweepMsg(null);
    try {
      const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api'}/sla/sweep`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      setSweepMsg(`Sweep: ${j.predicted} predicted, ${j.escalated} escalated`);
      await load();
    } catch (e) {
      setSweepMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <main className="mx-auto max-w-3xl p-6"><ErrorNote>{error}</ErrorNote></main>;
  if (!data) return <main className="p-6"><Spinner label="Loading dashboard…" /></main>;

  const maxDept = Math.max(1, ...data.byDept.map((d) => d.count));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Mandal: Kuppam — Grievance cell</h1>
        <div className="flex items-center gap-2">
          {sweepMsg && <span className="text-xs text-slate-500">{sweepMsg}</span>}
          <Button variant="ghost" onClick={sweep} disabled={busy}>{busy ? 'Running…' : 'Run SLA sweep'}</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Open" value={data.open} />
        <Stat label="Overdue" value={data.overdue} tone={data.overdue ? 'danger' : 'default'} />
        <Stat label="Reopened" value={data.reopened} tone={data.reopened ? 'warn' : 'default'} />
        <Stat label="Avg resolve" value={`${data.avgResolveDays}d`} />
        <Stat label="Satisfaction" value={data.satisfaction === null ? '—' : `${data.satisfaction}%`} tone="good" />
        <Stat label="SLA compliance" value={data.slaCompliance === null ? '—' : `${data.slaCompliance}%`} tone="good" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-3 text-sm font-semibold text-slate-800">Open by department</div>
            <div className="space-y-2">
              {data.byDept.map((d) => (
                <div key={d.dept} className="flex items-center gap-2 text-sm">
                  <span className="w-40 shrink-0 truncate text-slate-600">{d.dept}</span>
                  <div className="h-3 flex-1 rounded bg-slate-100">
                    <div className="h-3 rounded bg-brand" style={{ width: `${(d.count / maxDept) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-semibold text-slate-700">{d.count}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm text-slate-600">Escalations pending: <b>{data.escalationsPending}</b></div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 text-sm font-semibold text-slate-800">Officer load / health</div>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-400"><th className="pb-1">Officer</th><th>Role</th><th className="text-right">Load</th><th className="text-right">Overdue</th></tr></thead>
              <tbody>
                {data.officerLoad.map((o) => (
                  <tr key={o.officer} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{o.officer}</td>
                    <td className="text-slate-500">{o.role}</td>
                    <td className="text-right font-semibold">{o.load}</td>
                    <td className="text-right">{o.overdue ? <span className="text-red-600">{o.overdue}</span> : 0}</td>
                  </tr>
                ))}
                {data.officerLoad.length === 0 && <tr><td colSpan={4} className="py-2 text-slate-400">No active load.</td></tr>}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      {data.anomalies.fastClosures.length > 0 && (
        <Card className="mt-4 border-amber-200">
          <CardBody>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">⚠ Anomaly leads <Pill tone="amber">for human review</Pill></div>
            <ul className="space-y-1.5 text-sm">
              {data.anomalies.fastClosures.map((a) => (
                <li key={a.ysr} className="rounded-lg bg-amber-50 px-3 py-2 text-slate-700">
                  <span className="font-mono text-xs">{a.ysr}</span> — {a.reason}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </main>
  );
}

export default function SupervisorPage() {
  return (
    <div className="min-h-screen">
      <Header title="Supervisor" />
      <LoginGate allowedRoles={['SUPERVISOR', 'COLLECTOR', 'AUDITOR']} title="Supervisor sign-in">
        {({ token }) => <Supervisor token={token} />}
      </LoginGate>
    </div>
  );
}
