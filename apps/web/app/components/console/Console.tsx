'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useI18n } from '../../lib/intl';
import { DEPARTMENTS } from '../../lib/departments';
import { clearSession, Officer } from '../../lib/session';
import { BackButton } from '../AppNav';
import { Icon, IconSprite } from './Icon';
import { NAV, ViewId } from './nav';
import { useBi } from './bi';
import { OverviewView } from './views/Overview';
import { WorkbenchView } from './views/Workbench';
import { GisView } from './views/Gis';
import { AnalyticsView } from './views/Analytics';
import { GrievancesView } from './views/Grievances';
import { GovernanceView } from './views/Governance';

export type { ViewId } from './nav';

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

export function Console({ token, officer }: { token: string; officer: Officer }) {
  const { lang, setLang } = useI18n();
  const bi = useBi();
  const te = lang === 'te';

  const nav = useMemo(() => NAV.filter((n) => n.roles.includes(officer.role)), [officer.role]);
  const allowed = useMemo(() => nav.map((n) => n.id), [nav]);
  const initial: ViewId = officer.role === 'OFFICER' ? 'workbench' : 'overview';
  const defaultView: ViewId = allowed.includes(initial) ? initial : (allowed[0] ?? 'overview');

  // The active view lives in the URL (?view=gis etc.) so views are deep-linkable
  // (e.g. the bottom nav's Heatmap tab) and back/forward — including a WebView's
  // hardware back — walk through them. Next syncs useSearchParams with pushState.
  const search = useSearchParams();
  const urlView = search.get('view') as ViewId | null;
  const view: ViewId = urlView && allowed.includes(urlView) ? urlView : defaultView;
  const setView = (v: ViewId) => {
    if (v === view || !allowed.includes(v)) return;
    const q = new URLSearchParams(window.location.search);
    q.set('view', v); // merge, so markers like ?app=1 survive view switches
    window.history.pushState(null, '', `?${q.toString()}`);
  };

  const initials = officer.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const t = TITLES[view];

  // Officer profile card (opens in place above the rail chip; sign-out inside).
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => {
    if (!profileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProfileOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [profileOpen]);
  const signOut = () => {
    setProfileOpen(false);
    // Clear the stored session directly (not via the LoginGate logout prop):
    // flipping LoginGate's state would flash its sign-in card at /staff while
    // the navigation to the landing page is still in flight.
    clearSession();
    router.push('/'); // back to the landing / sign-in page
  };
  const roleLabel = bi(ROLE_LABEL[officer.role]?.en ?? officer.role, ROLE_LABEL[officer.role]?.te ?? officer.role);
  const dept = officer.deptId ? DEPARTMENTS[officer.deptId] : null;

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
            <button
              className="officer"
              onClick={() => setProfileOpen((o) => !o)}
              aria-expanded={profileOpen}
              aria-haspopup="dialog"
              aria-label={bi('Officer profile', 'అధికారి ప్రొఫైల్')}
              title={bi('Officer profile', 'అధికారి ప్రొఫైల్')}
            >
              <div className="avatar">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="officer-name">{officer.name}</div>
                <div className="officer-role">{officer.designation ?? roleLabel}</div>
              </div>
            </button>

            {profileOpen && (
              <>
                <div className="profile-scrim" onClick={() => setProfileOpen(false)} aria-hidden />
                <div className="profile-pop" role="dialog" aria-label={bi('Officer profile', 'అధికారి ప్రొఫైల్')}>
                  <div className="pp-head">
                    <div className="pp-avatar">{initials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="pp-name">{officer.name}</div>
                      <div className="pp-desg">{officer.designation ?? roleLabel}</div>
                    </div>
                  </div>
                  <div className="pp-rows">
                    <div className="pp-row"><span>{bi('Role', 'పాత్ర')}</span><b>{roleLabel}</b></div>
                    {dept && <div className="pp-row"><span>{bi('Department', 'విభాగం')}</span><b>{bi(dept.en, dept.te)}</b></div>}
                    {officer.level != null && <div className="pp-row"><span>{bi('Escalation level', 'ఎస్కలేషన్ స్థాయి')}</span><b>L{officer.level}</b></div>}
                    <div className="pp-row"><span>{bi('Officer ID', 'అధికారి ఐడీ')}</span><b className="mono">{officer.id}</b></div>
                  </div>
                  <button className="pp-signout" onClick={signOut}>
                    <Icon name="arrow" style={{ width: 14, height: 14 }} />
                    {bi('Sign out', 'సైన్ అవుట్')}
                  </button>
                </div>
              </>
            )}
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
              <BackButton className="icon-btn" fallback="/" />
              <Link href="/" className="icon-btn" aria-label={bi('Home', 'హోమ్')} title={bi('Home', 'హోమ్')}><Icon name="compass" /></Link>
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
            {nav.length > 0 && (
              <>
                {view === 'overview' && (
                  <OverviewView token={token} officer={officer} onOpenWorkbench={allowed.includes('workbench') ? () => setView('workbench') : undefined} />
                )}
                {view === 'workbench' && <WorkbenchView token={token} officer={officer} />}
                {view === 'grievances' && <GrievancesView token={token} />}
                {view === 'gis' && <GisView token={token} />}
                {view === 'analytics' && <AnalyticsView token={token} />}
                {(view === 'citizens' || view === 'audit' || view === 'admin') && <GovernanceView view={view} token={token} />}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
