'use client';

import Link from 'next/link';
import { LoginGate } from '../components/LoginGate';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Officer } from '../lib/session';

const SECTIONS = [
  { href: '/console', icon: '🎙️', title: 'Sachivalayam console', desc: 'File a grievance for a citizen (voice-first, AI-assisted)', roles: ['DA', 'OFFICER', 'SUPERVISOR'] },
  { href: '/officer', icon: '🗂️', title: 'Officer workbench', desc: 'Resolve assigned grievances · SLA · X-Road · draft-assist', roles: ['OFFICER', 'SUPERVISOR', 'COLLECTOR'] },
  { href: '/supervisor', icon: '📊', title: 'Supervisor / Mandal cell', desc: 'SLA compliance · escalations · officer load · anomalies', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'] },
  { href: '/command', icon: '🛰️', title: 'Command centre', desc: 'Heatmap · hotspots · predictive SLA · systemic issues', roles: ['COLLECTOR', 'SUPERVISOR', 'AUDITOR'] },
  { href: '/audit', icon: '🛡️', title: 'Audit & anti-corruption', desc: 'Ledger verification · fraud · corruption queue · access log', roles: ['AUDITOR', 'COLLECTOR'] },
];

const ROLE_LABEL: Record<string, string> = {
  DA: 'Digital Assistant', OFFICER: 'Redressal Officer', SUPERVISOR: 'Supervisor', COLLECTOR: 'Collector', AUDITOR: 'Auditor',
};

function Hub({ officer, logout }: { officer: Officer; logout: () => void }) {
  const sections = SECTIONS.filter((s) => s.roles.includes(officer.role));
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-bold text-white" aria-hidden>ప</span>
            <span className="text-sm font-bold text-slate-900">Praja Setu · Staff</span>
          </Link>
          <div className="flex items-center gap-3">
            <LanguageSwitcher compact />
            <button onClick={logout} className="text-sm text-slate-500 underline">Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-light p-6 text-white">
          <div className="text-sm text-teal-50">Signed in as</div>
          <div className="text-2xl font-bold">{officer.name}</div>
          <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm">
            {ROLE_LABEL[officer.role] ?? officer.role}
            {officer.deptId ? ` · ${officer.deptId}` : ''}
          </div>
        </div>

        <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">Your workspaces</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="text-2xl" aria-hidden>{s.icon}</div>
              <div className="mt-2 font-bold text-slate-900">{s.title}</div>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand group-hover:underline">Open →</span>
            </Link>
          ))}
        </div>
        {sections.length === 0 && <p className="text-sm text-slate-500">No workspaces available for your role.</p>}
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
