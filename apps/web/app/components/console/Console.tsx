'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '../../lib/intl';
import { Officer } from '../../lib/session';
import { Icon, IconName, IconSprite } from './Icon';
import { useBi } from './bi';
import { OverviewView } from './views/Overview';
import { WorkbenchView } from './views/Workbench';
import { GisView } from './views/Gis';
import { AnalyticsView } from './views/Analytics';
import { GrievancesView } from './views/Grievances';
import { GovernanceView } from './views/Governance';

export type ViewId =
  | 'overview' | 'workbench' | 'grievances' | 'gis' | 'analytics' | 'citizens' | 'audit' | 'admin';

interface NavDef {
  id: ViewId; icon: IconName; en: string; te: string; roles: string[];
  tag?: { text: string; amber?: boolean };
  group: 'ops' | 'intel' | 'gov';
}

const NAV: NavDef[] = [
  { id: 'overview', icon: 'grid', en: 'District Command', te: 'జిల్లా కమాండ్', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'ops' },
  { id: 'workbench', icon: 'layers', en: 'Officer Workbench', te: 'అధికారి వర్క్‌బెంచ్', roles: ['OFFICER', 'SUPERVISOR', 'COLLECTOR'], group: 'ops' },
  { id: 'grievances', icon: 'inbox', en: 'All Grievances', te: 'అన్ని ఫిర్యాదులు', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'ops' },
  { id: 'gis', icon: 'map', en: 'GIS & Hotspots', te: 'GIS & హాట్‌స్పాట్‌లు', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'intel' },
  { id: 'analytics', icon: 'chart', en: 'Analytics', te: 'విశ్లేషణ', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'intel' },
  { id: 'citizens', icon: 'users', en: 'Citizens', te: 'పౌరులు', roles: ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'], group: 'intel' },
  { id: 'audit', icon: 'shield', en: 'Audit & Ledger', te: 'ఆడిట్ & లెడ్జర్', roles: ['AUDITOR', 'COLLECTOR'], group: 'gov' },
  { id: 'admin', icon: 'cog', en: 'Administration', te: 'అడ్మినిస్ట్రేషన్', roles: ['COLLECTOR', 'AUDITOR'], group: 'gov' },
];

const TITLES: Record<ViewId, { en: string; te: string; ctxEn: string; ctxTe: string }> = {
  overview: { en: 'District Command Center', te: 'జిల్లా కమాండ్ సెంటర్', ctxEn: 'Andhra Pradesh · Real-Time Governance', ctxTe: 'ఆంధ్రప్రదేశ్ · రియల్-టైమ్ గవర్నెన్స్' },
  workbench: { en: 'Officer AI Workbench', te: 'అధికారి AI వర్క్‌బెంచ్', ctxEn: 'Saarthi has pre-analysed each case', ctxTe: 'సారథి ప్రతి కేసును ముందే విశ్లేషించింది' },
  grievances: { en: 'All Grievances', te: 'అన్ని ఫిర్యాదులు', ctxEn: 'District-wide register', ctxTe: 'జిల్లా రిజిస్టర్' },
  gis: { en: 'GIS Intelligence & Hotspots', te: 'GIS ఇంటెలిజెన్స్ & హాట్‌స్పాట్‌లు', ctxEn: 'Spatial clustering', ctxTe: 'ప్రాదేశిక క్లస్టరింగ్' },
  analytics: { en: 'Analytics & Predictions', te: 'విశ్లేషణ & అంచనాలు', ctxEn: 'Executive view', ctxTe: 'ఎగ్జిక్యూటివ్ వీక్షణ' },
  citizens: { en: 'Citizen Intelligence', te: 'పౌర ఇంటెలిజెన్స్', ctxEn: 'Who we serve', ctxTe: 'మేము సేవ చేసేవారు' },
  audit: { en: 'Audit & Ledger', te: 'ఆడిట్ & లెడ్జర్', ctxEn: 'Tamper-evident governance', ctxTe: 'ట్యాంపర్-ఎవిడెంట్ పాలన' },
  admin: { en: 'Administration', te: 'అడ్మినిస్ట్రేషన్', ctxEn: 'Roles & configuration', ctxTe: 'పాత్రలు & కాన్ఫిగరేషన్' },
};

const GROUPS: { id: 'ops' | 'intel' | 'gov'; en: string; te: string }[] = [
  { id: 'ops', en: 'Operations', te: 'నిర్వహణ' },
  { id: 'intel', en: 'Intelligence', te: 'ఇంటెలిజెన్స్' },
  { id: 'gov', en: 'Governance', te: 'పాలన' },
];

const ROLE_LABEL: Record<string, { en: string; te: string }> = {
  DA: { en: 'Digital Assistant', te: 'డిజిటల్ అసిస్టెంట్' },
  OFFICER: { en: 'Redressal Officer', te: 'రిడ్రెసల్ ఆఫీసర్' },
  SUPERVISOR: { en: 'Supervisor', te: 'సూపర్‌వైజర్' },
  COLLECTOR: { en: 'District Collector', te: 'జిల్లా కలెక్టర్' },
  AUDITOR: { en: 'Vigilance & Audit', te: 'విజిలెన్స్ & ఆడిట్' },
};

export function Console({ token, officer, logout }: { token: string; officer: Officer; logout: () => void }) {
  const { lang, setLang } = useI18n();
  const bi = useBi();
  const te = lang === 'te';

  const nav = useMemo(() => NAV.filter((n) => n.roles.includes(officer.role)), [officer.role]);
  const allowed = nav.map((n) => n.id);
  const initial: ViewId = officer.role === 'OFFICER' ? 'workbench' : 'overview';
  const [view, setView] = useState<ViewId>(allowed.includes(initial) ? initial : (allowed[0] ?? 'overview'));

  const initials = officer.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const t = TITLES[view];

  return (
    <div className={`console${te ? ' te' : ''}`}>
      <IconSprite />
      <div className="app">
        {/* ===== COMMAND RAIL ===== */}
        <aside className="rail">
          <div className="brand">
            <div className="brand-mark"><Icon name="compass" /></div>
            <div>
              <div className="brand-name">SAARTHI</div>
              <div className="brand-sub">{bi('Grievance Console', 'గ్రీవెన్స్ కన్సోల్')}</div>
            </div>
          </div>
          <nav className="rail-scroll">
            {GROUPS.map((g) => {
              const items = nav.filter((n) => n.group === g.id);
              if (!items.length) return null;
              return (
                <div key={g.id}>
                  <div className="nav-label">{bi(g.en, g.te)}</div>
                  {items.map((n) => (
                    <button
                      key={n.id}
                      className={`nav-item${view === n.id ? ' active' : ''}`}
                      onClick={() => setView(n.id)}
                    >
                      <Icon name={n.icon} />
                      <span>{bi(n.en, n.te)}</span>
                      {n.tag && <span className={`tag${n.tag.amber ? ' amber' : ''}`}>{n.tag.text}</span>}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="rail-foot">
            <button className="officer" onClick={logout} aria-label={bi('Sign out', 'సైన్ అవుట్')} title={bi('Sign out', 'సైన్ అవుట్')}>
              <div className="avatar">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="officer-name">{officer.name}</div>
                <div className="officer-role">
                  {officer.designation ?? bi(ROLE_LABEL[officer.role]?.en ?? officer.role, ROLE_LABEL[officer.role]?.te ?? officer.role)}
                </div>
              </div>
            </button>
          </div>
        </aside>

        {/* ===== MAIN ===== */}
        <div className="main">
          <header className="topbar">
            <div className="crumb">
              <div className="ctx">{bi(t.ctxEn, t.ctxTe)}</div>
              <h1>{bi(t.en, t.te)}</h1>
            </div>
            <div className="search">
              <Icon name="search" />
              <input type="text" placeholder={bi('Ask Saarthi or search grievances, villages, officers…', 'సారథిని అడగండి లేదా శోధించండి…')} aria-label="Search" />
              <span className="kbd">⌘K</span>
            </div>
            <div className="top-actions">
              <div className="lang" role="group" aria-label="Language">
                <button className={te ? '' : 'on'} aria-pressed={!te} onClick={() => setLang('en')}>EN</button>
                <button className={te ? 'on' : ''} aria-pressed={te} lang="te" onClick={() => setLang('te')} style={{ fontFamily: "'Noto Sans Telugu',sans-serif" }}>తెలుగు</button>
              </div>
              <button className="icon-btn" aria-label={bi('Notifications — unread', 'నోటిఫికేషన్లు — చదవనివి')}><Icon name="bell" /><span className="dot" aria-hidden /></button>
              <Link href="/" className="icon-btn" aria-label={bi('Home', 'హోమ్')}><Icon name="compass" /></Link>
            </div>
          </header>

          <div className="views">
            {nav.length === 0 && (
              <section className="view active">
                <div className="card" style={{ maxWidth: 560, margin: '40px auto', textAlign: 'center' }}>
                  <div className="cardbody" style={{ padding: 32 }}>
                    <div className="copilot-orb" style={{ margin: '0 auto 14px' }}><Icon name="mic" /></div>
                    <div className="display" style={{ fontSize: 20, fontWeight: 700 }}>{bi(`Welcome, ${officer.name}`, `స్వాగతం, ${officer.name}`)}</div>
                    <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>{bi('As a Digital Assistant, your workspace is the voice-first Sachivalayam assisted console — file and track grievances on behalf of citizens.', 'డిజిటల్ అసిస్టెంట్‌గా, మీ వర్క్‌స్పేస్ వాయిస్-ఫస్ట్ సచివాలయం కన్సోల్.')}</p>
                    <Link href="/console" className="btn btn-gold" style={{ marginTop: 18 }}><Icon name="arrow" />{bi('Open Sachivalayam console', 'సచివాలయం కన్సోల్ తెరవండి')}</Link>
                  </div>
                </div>
              </section>
            )}
            {view === 'overview' && <OverviewView token={token} officer={officer} onOpenWorkbench={() => setView('workbench')} />}
            {view === 'workbench' && <WorkbenchView token={token} officer={officer} />}
            {view === 'grievances' && <GrievancesView token={token} />}
            {view === 'gis' && <GisView token={token} />}
            {view === 'analytics' && <AnalyticsView token={token} />}
            {(view === 'citizens' || view === 'audit' || view === 'admin') && <GovernanceView view={view} token={token} />}
          </div>
        </div>
      </div>
    </div>
  );
}
