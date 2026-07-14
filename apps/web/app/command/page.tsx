'use client';

import { useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { LoginGate } from '../components/LoginGate';
import { Card, CardBody, ErrorNote, Pill, Spinner, Stat } from '../components/ui';
import { api } from '../lib/api';

interface CommandData {
  heatmap: { mandal: string; total: number; overdue: number; emergency: number }[];
  hotspots: { mandal: string; subject: string; dept: string | null; count: number }[];
  trends: { dept: string; last7: number; prev7: number; deltaPct: number | null }[];
  slaAtRisk: number;
  topSystemic: { subject: string; count: number }[];
  spandanaMondayReadiness: number;
  totalOpen: number;
}

function heatColor(total: number, max: number): string {
  const r = total / Math.max(1, max);
  if (r > 0.66) return 'bg-red-500';
  if (r > 0.33) return 'bg-amber-400';
  return 'bg-emerald-400';
}

function Command({ token }: { token: string }) {
  const [data, setData] = useState<CommandData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<CommandData>('/dashboard/command', token).then(setData).catch((e) => setError(e.message));
  }, [token]);

  if (error) return <main className="mx-auto max-w-3xl p-6"><ErrorNote>{error}</ErrorNote></main>;
  if (!data) return <main className="p-6"><Spinner label="Loading command centre…" /></main>;

  const maxMandal = Math.max(1, ...data.heatmap.map((h) => h.total));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-lg font-bold text-slate-900">District — Real-Time Governance</h1>
      <p className="mb-4 text-sm text-slate-500">Glanceable, map-first, predictive — turns thousands of complaints into actionable insight.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Open (district)" value={data.totalOpen} />
        <Stat label="SLA at-risk (predicted)" value={data.slaAtRisk} tone={data.slaAtRisk ? 'warn' : 'default'} />
        <Stat label="Hotspots" value={data.hotspots.length} tone={data.hotspots.length ? 'danger' : 'default'} />
        <Stat label="Spandana-Monday queue" value={data.spandanaMondayReadiness} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-3 text-sm font-semibold text-slate-800">Grievance density by mandal</div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.heatmap.map((h) => (
                <div key={h.mandal} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">{h.mandal}</span>
                    <span className={`h-3 w-3 rounded-full ${heatColor(h.total, maxMandal)}`} />
                  </div>
                  <div className="mt-1 text-2xl font-bold text-slate-900">{h.total}</div>
                  <div className="mt-1 flex gap-2 text-xs">
                    {h.overdue > 0 && <Pill tone="red">{h.overdue} overdue</Pill>}
                    {h.emergency > 0 && <Pill tone="red">{h.emergency} 🚨</Pill>}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 text-sm font-semibold text-slate-800">🔥 Hotspots (clustered)</div>
            {data.hotspots.length === 0 && <div className="text-sm text-slate-400">No hotspots above threshold.</div>}
            <ul className="space-y-2">
              {data.hotspots.map((h, i) => (
                <li key={i} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-slate-700">
                  <b>{h.count}</b> {h.subject} complaints in <b>{h.mandal}</b> {h.dept ? `· ${h.dept}` : ''}
                  <span className="block text-xs text-slate-500">→ fix the scheme here, not one ticket at a time</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 text-sm font-semibold text-slate-800">Trends (last 7d vs prior 7d)</div>
            <ul className="space-y-1.5 text-sm">
              {data.trends.map((t) => (
                <li key={t.dept} className="flex items-center justify-between">
                  <span className="text-slate-600">{t.dept}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{t.last7}</span>
                    {t.deltaPct !== null && (
                      <span className={t.deltaPct > 0 ? 'text-red-600' : t.deltaPct < 0 ? 'text-green-600' : 'text-slate-400'}>
                        {t.deltaPct > 0 ? '▲' : t.deltaPct < 0 ? '▼' : '–'} {Math.abs(t.deltaPct)}%
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-3 text-sm font-semibold text-slate-800">Top systemic issues</div>
            <ul className="space-y-1.5 text-sm">
              {data.topSystemic.map((s) => (
                <li key={s.subject} className="flex items-center justify-between">
                  <span className="text-slate-600">{s.subject}</span>
                  <Pill tone="slate">{s.count}</Pill>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}

export default function CommandPage() {
  return (
    <div className="min-h-screen">
      <Header title="Command centre" backHref="/staff" />
      <LoginGate allowedRoles={['COLLECTOR', 'SUPERVISOR', 'AUDITOR']} title="Collector / command sign-in">
        {({ token }) => <Command token={token} />}
      </LoginGate>
    </div>
  );
}
