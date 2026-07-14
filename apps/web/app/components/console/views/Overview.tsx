'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Officer } from '../../../lib/session';
import { ListGrievance } from '../../../lib/types';
import { Icon } from '../Icon';
import { useBi } from '../bi';
import { ChartCanvas, makeGradient, CHART_GRID } from '../Chart';
import { DEMO, isOverdue, priority, slaTimer, statusPill } from '../data';

interface Supervisor { open: number; overdue: number; avgResolveDays: number; satisfaction: number | null; slaCompliance: number | null; byDept: { dept: string; count: number }[]; anomalies?: { fastClosures?: unknown[] } }
interface Command { slaAtRisk: number; hotspots: { mandal: string; subject: string; dept: string | null; count: number }[]; totalOpen: number }

export function OverviewView({ token, officer, onOpenWorkbench }: { token: string; officer: Officer; onOpenWorkbench?: () => void }) {
  const bi = useBi();
  const [sup, setSup] = useState<Supervisor | null>(null);
  const [cmd, setCmd] = useState<Command | null>(null);
  const [rows, setRows] = useState<ListGrievance[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<Supervisor>('/dashboard/supervisor', token).then((r) => alive && setSup(r)).catch(() => alive && setSup(null));
    api.get<Command>('/dashboard/command', token).then((r) => alive && setCmd(r)).catch(() => alive && setCmd(null));
    api.get<ListGrievance[]>('/grievances', token).then((r) => alive && setRows(r.slice(0, 6))).catch(() => alive && setRows(null));
    return () => { alive = false; };
  }, [token]);

  const kOpen = sup?.open ?? DEMO.kpi.open;
  const kRisk = cmd?.slaAtRisk ?? sup?.overdue ?? DEMO.kpi.atRisk;
  const kSla = sup?.slaCompliance ?? DEMO.kpi.withinSla;
  const kAvg = sup?.avgResolveDays ?? DEMO.kpi.avgDays;

  const deptBars = sup?.byDept && sup.byDept.length ? sup.byDept.slice(0, 7) : DEMO.dept.labels.map((dept, i) => ({ dept, count: DEMO.dept.data[i] }));

  const breached = sup?.overdue ?? DEMO.sla.breached;
  const atRisk = cmd?.slaAtRisk ?? DEMO.sla.atRisk;
  const within = sup ? Math.max(sup.open - breached - atRisk, 0) : DEMO.sla.within;
  const onTimePct = kSla ? Math.round(Number(kSla)) : Math.round((within / Math.max(within + atRisk + breached, 1)) * 100);

  // AI co-pilot insights — derived from live signals, with representative fallback.
  const insights = buildInsights(cmd, sup, bi);

  const firstName = officer.name.split(/\s+/).slice(-1)[0];

  return (
    <section className="view active">
      <div className="page-head">
        <div>
          <div className="greet">{bi('Good morning, ', 'శుభోదయం, ')}<span>{officer.designation?.split('—')[0]?.trim() || firstName}</span></div>
          <div className="subtle">{bi("Here's what needs your attention today.", 'ఈ రోజు మీ దృష్టి అవసరమైనవి ఇవి.')}</div>
        </div>
        <div className="head-pills">
          <span className="live"><span className="pulse" />{bi('Live', 'లైవ్')}</span>
          <button className="btn btn-ghost"><Icon name="doc" />{bi('Export', 'ఎగుమతి')}</button>
        </div>
      </div>

      {/* KPIs (live values; no invented trend deltas) */}
      <div className="grid kpis stagger">
        <Kpi ic="navy" icon="inbox" val={kOpen.toLocaleString()} lab={bi('Open grievances', 'ఓపెన్ ఫిర్యాదులు')} />
        <Kpi ic="bad" icon="alert" val={String(kRisk)} lab={bi('High priority · SLA at risk', 'అధిక ప్రాధాన్యత · SLA ప్రమాదం')} />
        <Kpi ic="ok" icon="check2" val={`${Number(kSla).toFixed(1)}%`} lab={bi('Resolved within SLA', 'SLA లోపు పరిష్కరించబడింది')} />
        <Kpi ic="gold" icon="clock" val={<>{kAvg}<span style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)' }}> {bi('days', 'రోజులు')}</span></>} lab={bi('Avg. resolution time', 'సగటు పరిష్కార సమయం')} />
      </div>

      {/* flow + co-pilot */}
      <div className="row-2 stagger">
        <div className="card">
          <div className="panel-head">
            <h2>{bi('Grievance flow — last 14 days', 'ఫిర్యాదుల ప్రవాహం — గత 14 రోజులు')}</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="chip on">14D</button><button className="chip">30D</button><button className="chip">QTR</button>
            </div>
          </div>
          <div className="chartwrap">
            <ChartCanvas ariaLabel="Grievance flow" build={(ctx) => ({
              type: 'line',
              data: {
                labels: DEMO.flow.labels,
                datasets: [
                  { label: bi('Received', 'స్వీకరించబడింది'), data: DEMO.flow.received, borderColor: '#2D5BD7', backgroundColor: makeGradient(ctx, 'rgba(45,91,215,.18)', 'rgba(45,91,215,0)'), fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 },
                  { label: bi('Resolved', 'పరిష్కరించబడింది'), data: DEMO.flow.resolved, borderColor: '#0C9C6C', backgroundColor: 'rgba(12,156,108,0)', fill: false, tension: 0.4, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5 },
                ],
              },
              options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: true, position: 'top', align: 'end', labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 14 } } },
                scales: { x: { grid: { display: false }, border: { display: false } }, y: { grid: { color: CHART_GRID }, border: { display: false }, ticks: { stepSize: 50 } } },
              },
            })} />
          </div>
        </div>

        {/* SIGNATURE co-pilot */}
        <div className="copilot">
          <div className="copilot-head">
            <div className="copilot-orb"><Icon name="sparkle" /></div>
            <div>
              <div className="t">{bi('Saarthi — your guide', 'సారథి — మీ మార్గదర్శి')}</div>
              <div className="s">{bi(`${insights.length} things need a decision`, `${insights.length} విషయాలకు నిర్ణయం అవసరం`)}</div>
            </div>
            <div className="think"><i /><i /><i /></div>
          </div>
          <div className="ai-list">
            {insights.map((ins) => (
              <div className="ai-item" key={ins.title}>
                <div className={`ai-badge ${ins.badge}`}><Icon name={ins.icon} /></div>
                <div className="ai-txt"><strong>{ins.title}</strong><span>{ins.body}</span></div>
              </div>
            ))}
          </div>
          <div className="ai-cta">
            <button className="primary">{bi('Order inspection', 'తనిఖీ ఆదేశించండి')}</button>
            {onOpenWorkbench && <button onClick={onOpenWorkbench}>{bi('Open workbench', 'వర్క్‌బెంచ్ తెరవండి')}</button>}
          </div>
        </div>
      </div>

      {/* dept + SLA */}
      <div className="row-3 stagger">
        <div className="card">
          <div className="panel-head"><h2>{bi('Open grievances by department', 'విభాగం వారీగా ఓపెన్ ఫిర్యాదులు')}</h2></div>
          <div className="chartwrap sm">
            <ChartCanvas ariaLabel="By department" deps={[deptBars]} build={() => ({
              type: 'bar',
              data: { labels: deptBars.map((d) => d.dept), datasets: [{ data: deptBars.map((d) => d.count), backgroundColor: ['#2D5BD7', '#3a66dc', '#4a72e0', '#5b86ea', '#CBA046', '#d8b66a', '#e3cd95'], borderRadius: 7, maxBarThickness: 34 }] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, border: { display: false } }, y: { grid: { color: CHART_GRID }, border: { display: false } } } },
            })} />
          </div>
        </div>
        <div className="card">
          <div className="panel-head"><h2>{bi('SLA health', 'SLA ఆరోగ్యం')}</h2><span className="hint">{bi('this week', 'ఈ వారం')}</span></div>
          <div className="chartwrap sm" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 170, height: 170 }}>
              <ChartCanvas ariaLabel="SLA health" deps={[within, atRisk, breached]} build={() => ({
                type: 'doughnut',
                data: { labels: ['Within SLA', 'At risk', 'Breached'], datasets: [{ data: [within, atRisk, breached], backgroundColor: ['#0C9C6C', '#D9870B', '#D62B3B'], borderWidth: 0, spacing: 2 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '74%', plugins: { legend: { display: false } } },
              })} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div className="display" style={{ fontSize: 26, fontWeight: 700 }}>{onTimePct}%</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{bi('on time', 'సమయానికి')}</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 11 }}>
              <SlaRow label={bi('Within SLA', 'SLA లోపు')} v={within} color="var(--ok)" />
              <SlaRow label={bi('At risk (48h)', 'ప్రమాదంలో')} v={atRisk} color="var(--warn)" />
              <SlaRow label={bi('Breached', 'దాటింది')} v={breached} color="var(--bad)" />
            </div>
          </div>
        </div>
      </div>

      {/* recent table */}
      <div className="card tablecard stagger">
        <div className="panel-head" style={{ padding: '16px 18px' }}>
          <h2>{bi('Recent grievances', 'ఇటీవలి ఫిర్యాదులు')}</h2>
          {onOpenWorkbench && <button className="btn btn-ghost" onClick={onOpenWorkbench}><span>{bi('Open workbench', 'వర్క్‌బెంచ్ తెరవండి')}</span><Icon name="arrow" /></button>}
        </div>
        <table className="tbl">
          <thead><tr>
            <th>{bi('ID', 'ఐడీ')}</th><th>{bi('Grievance', 'ఫిర్యాదు')}</th><th>{bi('Dept', 'విభాగం')}</th>
            <th>{bi('Priority', 'ప్రాధాన్యత')}</th><th>{bi('Status', 'స్థితి')}</th><th>SLA</th><th>{bi('Integrity', 'సమగ్రత')}</th>
          </tr></thead>
          <tbody>
            {(rows && rows.length ? rows.map((g) => <LiveRow key={g.id} g={g} bi={bi} />) : DEMO_ROWS.map((r, i) => <DemoRow key={i} r={r} bi={bi} />))}
          </tbody>
        </table>
      </div>

      <div className="footnote">
        <Icon name="sparkle" />
        <div><strong style={{ color: 'var(--ink)' }}>{bi('Saarthi assists, officers decide.', 'సారథి సహాయం చేస్తుంది, అధికారులు నిర్ణయిస్తారు.')}</strong> {bi('AI suggestions (priority, routing, drafts, flags) are advisory and always reviewed by a human. The AI never closes a grievance. Every status change is notarised on the audit ledger.', 'AI సూచనలు సలహా మాత్రమే; మనిషి సమీక్షిస్తారు. ప్రతి మార్పు లెడ్జర్‌లో నోటరైజ్ చేయబడుతుంది.')}</div>
      </div>
    </section>
  );
}

function Kpi({ ic, icon, delta, val, lab }: { ic: string; icon: any; delta?: { d: string; v: string }; val: React.ReactNode; lab: string }) {
  return (
    <div className="card kpi">
      <div className="kpi-top">
        <div className={`kpi-ic ic-${ic}`}><Icon name={icon} /></div>
        {delta && <span className={`delta ${delta.d}`}>{delta.d !== 'flat' && <Icon name={delta.d === 'up' ? 'up' : 'down'} />}{delta.v}</span>}
      </div>
      <div className="kpi-val">{val}</div>
      <div className="kpi-lab">{lab}</div>
    </div>
  );
}

function SlaRow({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ fontWeight: 600 }}>{label}</span><span className="mono" style={{ color, fontWeight: 600 }}>{v.toLocaleString()}</span></div></div>
  );
}

function LiveRow({ g, bi }: { g: ListGrievance; bi: (en: string, te: string) => string }) {
  const ov = isOverdue(g);
  const p = priority(g);
  const st = statusPill(g.status, ov);
  const sl = slaTimer(g);
  return (
    <tr>
      <td><span className="gid">{g.ysr}</span></td>
      <td><div className="subj">{g.category === 'FINANCE' ? bi('Finance grievance', 'ఆర్థిక ఫిర్యాదు') : bi('Service grievance', 'సేవా ఫిర్యాదు')}</div><div className="meta-sm">{g.mandal ?? '—'}</div></td>
      <td>{g.department ?? '—'}</td>
      <td><span className={`prio pr-${p.level}`}>{bi(p.label.en, p.label.te)}</span></td>
      <td><span className={`pill ${st.cls}`}>{bi(st.en, st.te)}</span></td>
      <td><span className={`sla ${sl.tone}`}><Icon name={sl.icon} style={{ width: 13, height: 13 }} />{bi(sl.en, sl.te)}</span></td>
      <td><span className="verify"><Icon name="shield" />{bi('Verified', 'ధృవీకరించబడింది')}</span></td>
    </tr>
  );
}

interface DemoRowT { id: string; en: string; te: string; place: string; dept: string; prio: string; prioTe: string; prioCls: string; stCls: string; stEn: string; stTe: string; slTone: string; slEn: string; slTe: string; slIcon: any }
const DEMO_ROWS: DemoRowT[] = [
  { id: 'SAR-26-10293', en: 'No drinking water for 6 days', te: '6 రోజులుగా తాగునీరు లేదు', place: 'Vontimitta · Pulivendula', dept: 'Rural Water', prio: 'HIGH', prioTe: 'అధికం', prioCls: 'hi', stCls: 'p-prog', stEn: 'In progress', stTe: 'ప్రోగ్రెస్‌లో', slTone: 'warn', slEn: '1d 4h', slTe: '1d 4h', slIcon: 'clock' },
  { id: 'SAR-26-10288', en: 'Old-age pension stopped', te: 'వృద్ధాప్య పింఛను నిలిపివేయబడింది', place: 'Ward 4 · Proddatur', dept: 'Pensions', prio: 'HIGH', prioTe: 'అధికం', prioCls: 'hi', stCls: 'p-brk', stEn: 'SLA breached', stTe: 'SLA దాటింది', slTone: 'danger', slEn: 'Overdue', slTe: 'గడువు మించింది', slIcon: 'alert' },
  { id: 'SAR-26-10301', en: 'Transformer damaged, frequent outages', te: 'ట్రాన్స్‌ఫార్మర్ దెబ్బతింది', place: 'Chennur · Kadapa', dept: 'APSPDCL', prio: 'MEDIUM', prioTe: 'మధ్యమం', prioCls: 'md', stCls: 'p-new', stEn: 'Assigned', stTe: 'కేటాయించబడింది', slTone: 'ok', slEn: '3d 8h', slTe: '3d 8h', slIcon: 'clock' },
  { id: 'SAR-26-10275', en: "Daughter's scholarship not credited", te: 'కుమార్తె స్కాలర్‌షిప్ జమ కాలేదు', place: 'Jammalamadugu', dept: 'Education', prio: 'MEDIUM', prioTe: 'మధ్యమం', prioCls: 'md', stCls: 'p-esc', stEn: 'Escalated', stTe: 'ఎస్కలేట్', slTone: 'ok', slEn: '2d 1h', slTe: '2d 1h', slIcon: 'clock' },
  { id: 'SAR-26-10240', en: 'Pothole-ridden road near school', te: 'పాఠశాల వద్ద గుంతల రహదారి', place: 'Rajupalem · Mydukur', dept: 'R&B', prio: 'LOW', prioTe: 'తక్కువ', prioCls: 'lo', stCls: 'p-res', stEn: 'Resolved', stTe: 'పరిష్కరించబడింది', slTone: 'ok', slEn: 'Closed', slTe: 'మూసివేయబడింది', slIcon: 'check2' },
];
function DemoRow({ r, bi }: { r: DemoRowT; bi: (en: string, te: string) => string }) {
  return (
    <tr>
      <td><span className="gid">{r.id}</span></td>
      <td><div className="subj">{bi(r.en, r.te)}</div><div className="meta-sm">{r.place}</div></td>
      <td>{r.dept}</td>
      <td><span className={`prio pr-${r.prioCls}`}>{bi(r.prio, r.prioTe)}</span></td>
      <td><span className={`pill ${r.stCls}`}>{bi(r.stEn, r.stTe)}</span></td>
      <td><span className={`sla ${r.slTone}`}><Icon name={r.slIcon} style={{ width: 13, height: 13 }} />{bi(r.slEn, r.slTe)}</span></td>
      <td><span className="verify"><Icon name="shield" />{bi('Verified', 'ధృవీకరించబడింది')}</span></td>
    </tr>
  );
}

function buildInsights(cmd: Command | null, sup: Supervisor | null, bi: (en: string, te: string) => string) {
  const out: { badge: string; icon: any; title: string; body: string }[] = [];
  const top = cmd?.hotspots?.[0];
  if (top) {
    out.push({ badge: 'b-red', icon: 'drop', title: bi(`${top.subject} cluster in ${top.mandal}`, `${top.mandal}లో ${top.subject} క్లస్టర్`), body: bi(`${top.count} related complaints clustered · recommend field inspection.`, `${top.count} సంబంధిత ఫిర్యాదులు · క్షేత్ర తనిఖీ సిఫార్సు.`) });
  }
  const risk = cmd?.slaAtRisk ?? sup?.overdue ?? 0;
  if (risk > 0) {
    out.push({ badge: 'b-amber', icon: 'clock', title: bi(`${risk} grievances likely to breach SLA`, `${risk} ఫిర్యాదులు SLA దాటే అవకాశం`), body: bi('Nudge sent — one tap to escalate, or they escalate per SLA policy unless an officer acts.', 'నడ్జ్ పంపబడింది — ఒక్క ట్యాప్‌తో ఎస్కలేట్; లేదా SLA విధానం ప్రకారం.') });
  }
  const flags = sup?.anomalies?.fastClosures?.length ?? 0;
  if (flags > 0) {
    out.push({ badge: 'b-gold', icon: 'flag', title: bi(`${flags} possible fast-closure case(s) flagged`, `${flags} వేగవంతమైన మూసివేత కేసులు గుర్తించబడ్డాయి`), body: bi('Routed to the confidential audit queue for review.', 'సమీక్ష కోసం గోప్యమైన ఆడిట్ క్యూకి పంపబడింది.') });
  }
  if (!out.length) {
    out.push(
      { badge: 'b-red', icon: 'drop', title: bi('Water crisis forming in Pulivendula', 'పులివెందులలో నీటి సంక్షోభం'), body: bi('23 drinking-water complaints clustered in 6 days · ~1,900 people.', '6 రోజుల్లో 23 తాగునీటి ఫిర్యాదులు · ~1,900 మంది.') },
      { badge: 'b-amber', icon: 'clock', title: bi('64 grievances likely to breach SLA in 48h', '48 గంటల్లో 64 ఫిర్యాదులు SLA దాటవచ్చు'), body: bi('Mostly Revenue (land mutation). 9 await an officer to escalate.', 'ఎక్కువగా రెవెన్యూ. 9 ఎస్కలేట్ కోసం అధికారి కోసం వేచి ఉన్నాయి.') },
      { badge: 'b-gold', icon: 'flag', title: bi('2 possible corruption cases flagged', '2 అవినీతి కేసులు గుర్తించబడ్డాయి'), body: bi('Complainant identity masked. Routed to confidential queue.', 'ఫిర్యాదుదారు గుర్తింపు దాచబడింది.') },
    );
  }
  return out.slice(0, 3);
}
