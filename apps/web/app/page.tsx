import Link from 'next/link';
import { Header } from './components/Header';

const SURFACES = [
  {
    href: '/track',
    emoji: '🔎',
    title: 'Track my grievance',
    te: 'నా ఫిర్యాదును ట్రాక్ చేయండి',
    desc: 'Citizen tracking — plain-language status, timeline, and one-tap integrity verification.',
    tone: 'bg-blue-50 border-blue-200',
  },
  {
    href: '/console',
    emoji: '🎙',
    title: 'Sachivalayam console',
    te: 'సచివాలయం కన్సోల్',
    desc: 'Primary pilot UI — file a grievance on a citizen’s behalf, voice-first, AI-assisted, consent-logged.',
    tone: 'bg-teal-50 border-teal-200',
  },
  {
    href: '/officer',
    emoji: '🗂',
    title: 'Officer workbench',
    te: 'అధికారి వర్క్‌బెంచ్',
    desc: 'Resolve grievances — SLA risk, AI summaries, X-Road verified facts, notarised actions.',
    tone: 'bg-indigo-50 border-indigo-200',
  },
  {
    href: '/supervisor',
    emoji: '📊',
    title: 'Supervisor / Mandal cell',
    te: 'సూపర్‌వైజర్',
    desc: 'SLA compliance, escalations, officer load, and anomaly leads.',
    tone: 'bg-amber-50 border-amber-200',
  },
  {
    href: '/command',
    emoji: '🛰',
    title: 'Collector command centre',
    te: 'కలెక్టర్ కమాండ్ సెంటర్',
    desc: 'Real-Time Governance — heatmap, hotspots, predictive SLA risk, systemic issues.',
    tone: 'bg-purple-50 border-purple-200',
  },
  {
    href: '/audit',
    emoji: '🛡',
    title: 'Audit & anti-corruption',
    te: 'ఆడిట్',
    desc: 'Ledger verification, fraudulent-closure leads, confidential corruption queue, access transparency.',
    tone: 'bg-rose-50 border-rose-200',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header title="" subtitle="People’s Bridge · Pilot" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <section className="mb-8 rounded-2xl bg-gradient-to-br from-brand to-brand-light px-6 py-8 text-white sm:px-10 sm:py-10">
          <h1 className="text-2xl font-bold sm:text-3xl">
            ప్రజా సేతు — People’s Bridge
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-teal-50 sm:text-base">
            A modern Public Grievance Redressal System for Andhra Pradesh — Telugu-first, voice-first, and built for the
            last mile. Keeps what works in Spandana (YSR tracking, dynamic assignment, SLA + reopen + escalation) and adds
            secure inter-department exchange (X-Road), a tamper-evident audit ledger, NLP intake, and human-in-the-loop AI.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {['Telugu + voice', 'Tamper-evident ledger', 'X-Road data exchange', 'SLA prediction', 'No silent closure', 'DPDP-aligned'].map(
              (t) => (
                <span key={t} className="rounded-full bg-white/15 px-3 py-1 font-medium">
                  {t}
                </span>
              ),
            )}
          </div>
        </section>

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Six role-tuned surfaces</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SURFACES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group rounded-xl border p-5 transition hover:shadow-md ${s.tone}`}
            >
              <div className="text-2xl" aria-hidden>
                {s.emoji}
              </div>
              <div className="mt-2 text-base font-bold text-slate-900">{s.title}</div>
              <div className="font-telugu text-sm text-slate-600">{s.te}</div>
              <p className="mt-2 text-sm text-slate-600">{s.desc}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-brand group-hover:underline">Open →</span>
            </Link>
          ))}
        </div>

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          <h3 className="mb-1 font-semibold text-slate-800">Demo logins</h3>
          <p>
            Officer surfaces (password <code className="rounded bg-slate-100 px-1">Praja@123</code>):{' '}
            <code className="rounded bg-slate-100 px-1">da1</code>, <code className="rounded bg-slate-100 px-1">rws.officer</code>,{' '}
            <code className="rounded bg-slate-100 px-1">cs.officer</code>, <code className="rounded bg-slate-100 px-1">supervisor</code>,{' '}
            <code className="rounded bg-slate-100 px-1">collector</code>, <code className="rounded bg-slate-100 px-1">auditor</code>. Track a
            grievance with a YSR like <code className="rounded bg-slate-100 px-1">YSR-AP-2026-000001</code>.
          </p>
        </section>
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-center text-xs text-slate-400 sm:px-6">
        Pilot build · A design, honestly scoped. External integrations (Aadhaar AUA/KUA, Hyperledger nodes, X-Road
        governance, Bhashini) are stubbed behind clean adapters — see README.
      </footer>
    </div>
  );
}
