'use client';

import Link from 'next/link';
import { LoginGate } from '../components/LoginGate';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Logo } from '../components/Logo';
import { Officer } from '../lib/session';

const SECTIONS = [
  { href: '/console', icon: '🎙️', title: 'Sachivalayam console', desc: 'File a grievance for a citizen (voice-first, AI-assisted)', roles: ['DA', 'OFFICER', 'SUPERVISOR'] },
  { href: '/officer', icon: '🗂️', title: 'Officer workbench', desc: 'Resolve assigned grievances · documents · SLA · X-Road · draft-assist', roles: ['OFFICER', 'SUPERVISOR', 'COLLECTOR'] },
  { href: '/supervisor', icon: '📊', title: 'Supervisor / Mandal cell', desc: 'SLA compliance · escalations · officer load · anomalies', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'] },
  { href: '/command', icon: '🛰️', title: 'Command centre', desc: 'Heatmap · hotspots · predictive SLA · systemic issues', roles: ['COLLECTOR', 'SUPERVISOR', 'AUDITOR'] },
  { href: '/audit', icon: '🛡️', title: 'Audit & anti-corruption', desc: 'Ledger verification · fraud · corruption queue · access log', roles: ['AUDITOR', 'COLLECTOR'] },
];

const ROLE_LABEL: Record<string, string> = {
  DA: 'Digital Assistant', OFFICER: 'Redressal Officer', SUPERVISOR: 'Supervisor', COLLECTOR: 'Collector', AUDITOR: 'Auditor',
};

// Government hierarchy / escalation ladder (Blueprint A.2) — shown so staff can see
// where they sit and who a grievance escalates to.
const HIERARCHY = [
  { level: 'L1', who: 'Field office', titles: 'VRO · Panchayat Secretary · AE (APSPDCL) · WEA', role: 'OFFICER' },
  { level: 'L2', who: 'Mandal', titles: 'Tahsildar · MPDO · Deputy Engineer', role: 'SUPERVISOR' },
  { level: 'L3', who: 'Division / District cell', titles: 'RDO · Executive Engineer · Vigilance Officer', role: 'SUPERVISOR' },
  { level: 'L4', who: 'District / State', titles: 'Joint Collector · District Collector · CMO cell', role: 'COLLECTOR' },
];

function Hub({ officer, logout }: { officer: Officer; logout: () => void }) {
  const sections = SECTIONS.filter((s) => s.roles.includes(officer.role));
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
          <Link href="/"><Logo size={34} /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 sm:inline">Staff console</span>
            <LanguageSwitcher compact />
            <button onClick={logout} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6">
        {/* Identity banner */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-light p-6 text-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-white/70">Signed in as</div>
              <div className="text-2xl font-extrabold">{officer.name}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{officer.designation ?? ROLE_LABEL[officer.role] ?? officer.role}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{ROLE_LABEL[officer.role] ?? officer.role}</span>
                {officer.deptId && <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Dept {officer.deptId}</span>}
                {officer.level && <span className="rounded-full bg-saffron/30 px-3 py-1 text-xs font-semibold">Level L{officer.level}</span>}
              </div>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl">🏛️</div>
          </div>
        </div>

        <h2 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wide text-slate-500">Your workspaces</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lift">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/5 text-2xl" aria-hidden>{s.icon}</div>
              <div className="mt-3 font-bold text-ink">{s.title}</div>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand group-hover:underline">Open →</span>
            </Link>
          ))}
        </div>
        {sections.length === 0 && <p className="text-sm text-slate-500">No workspaces available for your role.</p>}

        {/* Government hierarchy */}
        <h2 className="mb-3 mt-9 text-sm font-semibold uppercase tracking-wide text-slate-500">Government hierarchy & escalation ladder</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HIERARCHY.map((h) => {
            const here = h.level === `L${officer.level}`;
            return (
              <div key={h.level} className={`rounded-2xl border p-4 ${here ? 'border-brand bg-brand/5' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${here ? 'text-brand' : 'text-slate-500'}`}>{h.level}</span>
                  {here && <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">YOU</span>}
                </div>
                <div className="mt-1 text-sm font-semibold text-ink">{h.who}</div>
                <p className="mt-1 text-xs text-slate-500">{h.titles}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Grievances that breach their SLA escalate automatically up this ladder — every step is notarised to the tamper-evident ledger.
        </p>
      </main>
    </div>
  );
}

export default function StaffPage() {
  return (
    <LoginGate allowedRoles={['DA', 'OFFICER', 'SUPERVISOR', 'COLLECTOR', 'AUDITOR']} title="Staff sign-in">
      {({ officer, logout }) => <Hub officer={officer} logout={logout} />}
    </LoginGate>
  );
}
