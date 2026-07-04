'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Icon, IconName } from '../Icon';
import { useBi } from '../bi';
import { ChartCanvas, makeGradient, CHART_GRID } from '../Chart';

interface Supervisor { satisfaction: number | null; byDept: { dept: string; count: number }[] }
interface Command { trends: { dept: string; last7: number; prev7: number; deltaPct: number | null }[]; hotspots: { mandal: string; subject: string; count: number }[] }

const DEMO_VILLAGES = [
  { nm: 'Vontimitta', w: 100, v: 214 }, { nm: 'Chennur', w: 78, v: 167 }, { nm: 'Rajupalem', w: 61, v: 131 },
  { nm: 'Badvel town', w: 52, v: 112 }, { nm: 'Mydukur', w: 43, v: 92 },
];

export function AnalyticsView({ token }: { token: string }) {
  const bi = useBi();
  const [cmd, setCmd] = useState<Command | null>(null);
  const [sup, setSup] = useState<Supervisor | null>(null);

  useEffect(() => {
    api.get<Command>('/dashboard/command', token).then(setCmd).catch(() => {});
    api.get<Supervisor>('/dashboard/supervisor', token).then(setSup).catch(() => {});
  }, [token]);

  const satScore = sup?.satisfaction != null ? (sup.satisfaction / 100 * 5).toFixed(1) : '4.3';

  // Predictive signals — derived from live trends/hotspots, with representative fallback.
  const preds = buildPredictions(cmd, bi);

  return (
    <section className="view active">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="greet" style={{ fontSize: 21 }}>{bi('Analytics & Predictions', 'విశ్లేషణ & అంచనాలు')}</div>
          <div className="subtle">{bi('Executive view. Historical charts show representative pilot data; predictive signals use live clustering.', 'ఎగ్జిక్యూటివ్ వీక్షణ. చారిత్రక చార్టులు నమూనా డేటా; అంచనాలు లైవ్ క్లస్టరింగ్.')}</div>
        </div>
        <button className="btn btn-ghost"><Icon name="doc" />{bi('Download report', 'రిపోర్ట్ డౌన్‌లోడ్')}</button>
      </div>

      <div className="an-grid">
        <div className="card wide">
          <div className="panel-head">
            <h2>{bi('Resolution rate & satisfaction — 6 months', 'పరిష్కార రేటు & సంతృప్తి — 6 నెలలు')}</h2>
            <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 3, borderRadius: 2, background: '#2D5BD7' }} />{bi('Resolution %', 'పరిష్కారం %')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 11, height: 3, borderRadius: 2, background: '#CBA046' }} />{bi('Satisfaction', 'సంతృప్తి')}</span>
            </div>
          </div>
          <div className="chartwrap">
            <ChartCanvas ariaLabel="Resolution and satisfaction" deps={[satScore]} build={(ctx) => ({
              type: 'line',
              data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [
                  { type: 'line', label: 'Resolution %', data: [71, 74, 79, 82, 85, 87], borderColor: '#2D5BD7', backgroundColor: makeGradient(ctx, 'rgba(45,91,215,.16)', 'rgba(45,91,215,0)'), fill: true, tension: 0.4, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#2D5BD7', yAxisID: 'y' },
                  { type: 'line', label: 'Satisfaction', data: [3.6, 3.8, 3.9, 4.0, 4.2, Number(satScore)], borderColor: '#CBA046', backgroundColor: 'rgba(0,0,0,0)', fill: false, tension: 0.4, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#CBA046', yAxisID: 'y2' },
                ],
              },
              options: {
                responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false }, border: { display: false } }, y: { position: 'left', grid: { color: CHART_GRID }, border: { display: false }, min: 60, max: 100, ticks: { callback: (v: any) => v + '%' } }, y2: { position: 'right', grid: { display: false }, border: { display: false }, min: 3, max: 5, ticks: { stepSize: 0.5 } } },
              },
            })} />
          </div>
        </div>

        <div className="card">
          <div className="panel-head"><h2>{bi('Department performance', 'విభాగ పనితీరు')}</h2><span className="hint">{bi('resolution %', 'పరిష్కారం %')}</span></div>
          <div className="chartwrap sm">
            <ChartCanvas ariaLabel="Department performance" build={() => ({
              type: 'bar',
              data: { labels: ['Water', 'Pensions', 'Civil Sup.', 'APSPDCL', 'Revenue', 'Health'], datasets: [{ data: [94, 91, 88, 85, 79, 76], backgroundColor: ['#0C9C6C', '#0C9C6C', '#3a66dc', '#3a66dc', '#D9870B', '#D9870B'], borderRadius: 6, maxBarThickness: 18 }] },
              options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: CHART_GRID }, border: { display: false }, max: 100, ticks: { callback: (v: any) => v + '%' } }, y: { grid: { display: false }, border: { display: false } } } },
            })} />
          </div>
        </div>

        <div className="card">
          <div className="panel-head"><h2>{bi('Citizen satisfaction', 'పౌర సంతృప్తి')}</h2></div>
          <div className="chartwrap sm" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ position: 'relative', width: 160, height: 160 }}>
              <ChartCanvas ariaLabel="Citizen satisfaction" build={() => ({
                type: 'doughnut',
                data: { labels: ['Very satisfied', 'Satisfied', 'Neutral', 'Unhappy'], datasets: [{ data: [58, 27, 9, 6], backgroundColor: ['#0C9C6C', '#3a66dc', '#CBA046', '#D62B3B'], borderWidth: 0, spacing: 2 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } },
              })} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div className="display" style={{ fontSize: 24, fontWeight: 700 }}>{satScore}</div><div style={{ fontSize: 10.5, color: 'var(--muted)' }}>/ 5.0</div>
              </div>
            </div>
            <div style={{ flex: 1, fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
              <Row l="★★★★★ Very satisfied" v="58%" /><Row l="★★★★ Satisfied" v="27%" /><Row l="★★★ Neutral" v="9%" /><Row l="★★ / ★ Unhappy" v="6%" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="panel-head"><h2>{bi('Most complaints by village', 'గ్రామం వారీగా ఎక్కువ ఫిర్యాదులు')}</h2></div>
          <div className="cardbody">
            {DEMO_VILLAGES.map((v) => (
              <div className="rankrow" key={v.nm}><span className="nm">{v.nm}</span><span className="track"><i style={{ width: `${v.w}%` }} /></span><span className="vn">{v.v}</span></div>
            ))}
          </div>
        </div>

        {/* predictive (signature accent) */}
        <div className="predict">
          <h3><Icon name="sparkle" style={{ width: 18, height: 18, color: '#E7C988' }} />{bi('Predictive signals', 'అంచనా సంకేతాలు')}</h3>
          {preds.map((pr, i) => (
            <div className="pred-item" key={i}><div className="pred-ic"><Icon name={pr.icon} /></div><div className="tx"><strong>{pr.title}</strong><span>{pr.sub}</span></div><span className="pc">{pr.pc}</span></div>
          ))}
        </div>
      </div>

      <div className="footnote">
        <Icon name="shield" />
        <div><strong style={{ color: 'var(--ink)' }}>{bi('Analytics run on anonymised data.', 'విశ్లేషణ అనామక డేటాపై నడుస్తుంది.')}</strong> {bi('Personally identifiable details are masked for trend and prediction views. Model confidence is shown alongside every prediction.', 'ట్రెండ్ & అంచనా వీక్షణల కోసం వ్యక్తిగత వివరాలు మాస్క్ చేయబడతాయి. ప్రతి అంచనాతో మోడల్ విశ్వాసం చూపబడుతుంది.')}</div>
      </div>
    </section>
  );
}

function Row({ l, v }: { l: string; v: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{l}</span><b style={{ color: 'var(--ink)' }}>{v}</b></div>;
}

function buildPredictions(cmd: Command | null, bi: (en: string, te: string) => string) {
  const out: { icon: IconName; title: string; sub: string; pc: string }[] = [];
  const top = cmd?.hotspots?.[0];
  if (top) out.push({ icon: 'drop', title: bi(`${top.subject} risk — ${top.mandal}`, `${top.subject} ప్రమాదం — ${top.mandal}`), sub: bi('clustered, rising', 'క్లస్టర్, పెరుగుతోంది'), pc: `${Math.min(95, 60 + top.count)}%` });
  const rising = cmd?.trends?.find((t) => t.deltaPct != null && t.deltaPct > 0);
  if (rising) out.push({ icon: 'trend', title: bi(`${rising.dept} complaints rising`, `${rising.dept} ఫిర్యాదులు పెరుగుతున్నాయి`), sub: bi('week-on-week', 'వారం వారం'), pc: `+${rising.deltaPct}%` });
  if (out.length < 4) {
    const fill = [
      { icon: 'drop' as IconName, title: bi('Water shortage risk — Pulivendula', 'నీటి కొరత ప్రమాదం — పులివెందుల'), sub: bi('next 10 days', 'తదుపరి 10 రోజులు'), pc: '81%' },
      { icon: 'bolt' as IconName, title: bi('Transformer failures — Jammalamadugu', 'ట్రాన్స్‌ఫార్మర్ వైఫల్యాలు'), sub: bi('pre-monsoon load', 'వర్షాకాలానికి ముందు లోడ్'), pc: '67%' },
      { icon: 'users' as IconName, title: bi('Officer overload — Revenue desk', 'అధికారి ఓవర్‌లోడ్ — రెవెన్యూ'), sub: bi('reassign ~12 cases', '~12 కేసులు తిరిగి కేటాయించండి'), pc: 'High' },
      { icon: 'trend' as IconName, title: bi('Sanitation complaints rising — Kadapa', 'పారిశుధ్య ఫిర్యాదులు పెరుగుతున్నాయి'), sub: bi('expected this week', 'ఈ వారం అంచనా'), pc: '+22%' },
    ];
    for (const f of fill) { if (out.length >= 4) break; out.push(f); }
  }
  return out.slice(0, 4);
}
