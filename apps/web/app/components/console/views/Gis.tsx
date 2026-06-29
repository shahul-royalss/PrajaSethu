'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Icon } from '../Icon';
import { useBi } from '../bi';

interface Hotspot { mandal: string; subject: string; dept: string | null; count: number }

const DEMO_HOT: Hotspot[] = [
  { mandal: 'Pulivendula', subject: 'Drinking water', dept: 'Rural Water', count: 23 },
  { mandal: 'Kadapa', subject: 'Land mutation delays', dept: 'Revenue', count: 17 },
  { mandal: 'Jammalamadugu', subject: 'Transformer outages', dept: 'APSPDCL', count: 12 },
  { mandal: 'Badvel', subject: 'Ration shortfall', dept: 'Civil Supplies', count: 9 },
];

export function GisView({ token }: { token: string }) {
  const bi = useBi();
  const [hot, setHot] = useState<Hotspot[] | null>(null);

  useEffect(() => {
    api.get<Hotspot[]>('/dashboard/hotspots', token).then((r) => setHot(r.length ? r : DEMO_HOT)).catch(() => setHot(DEMO_HOT));
  }, [token]);

  const rows = hot ?? DEMO_HOT;
  const rankCls = (i: number) => (i === 0 ? '' : i === 1 ? ' amber' : ' gold');

  return (
    <section className="view active">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="greet" style={{ fontSize: 21 }}>{bi('GIS Intelligence & Hotspots', 'GIS ఇంటెలిజెన్స్ & హాట్‌స్పాట్‌లు')}</div>
          <div className="subtle">{bi('Real-time clustering turns isolated tickets into systemic insight.', 'రియల్-టైమ్ క్లస్టరింగ్ ఒంటరి టికెట్‌లను వ్యవస్థాగత అంతర్దృష్టిగా మారుస్తుంది.')}</div>
        </div>
      </div>

      <div className="gis">
        <div className="mapcard">
          <div className="map-toolbar">
            <button className="chip on">{bi('All issues', 'అన్నీ')}</button>
            <button className="chip"><Icon name="drop" style={{ width: 12, height: 12, verticalAlign: -1 }} /> {bi('Water', 'నీరు')}</button>
            <button className="chip"><Icon name="bolt" style={{ width: 12, height: 12, verticalAlign: -1 }} /> {bi('Power', 'విద్యుత్')}</button>
            <button className="chip">{bi('Roads', 'రహదారులు')}</button>
            <button className="chip">{bi('Health', 'ఆరోగ్యం')}</button>
            <span className="sp" />
            <button className="chip">{bi('Heatmap', 'హీట్‌మ్యాప్')}</button>
          </div>
          <div className="mapview">
            <svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid meet" role="group" aria-label={bi('District complaint-density map', 'జిల్లా ఫిర్యాదుల సాంద్రత మ్యాప్')}>
              <path className="region" role="img" d="M70,60 L230,40 L260,150 L150,200 L60,160 Z" fill="#cfe0f7"><title>Jammalamadugu — {bi('low complaint density', 'తక్కువ సాంద్రత')}</title></path>
              <path className="region" role="img" d="M230,40 L420,55 L430,160 L260,150 Z" fill="#fbd9b0"><title>Proddatur — {bi('moderate complaint density', 'మధ్యమ సాంద్రత')}</title></path>
              <path className="region" role="img" d="M420,55 L540,90 L530,210 L430,160 Z" fill="#f3b6a6"><title>Pulivendula — {bi('high complaint density', 'అధిక సాంద్రత')}</title></path>
              <path className="region" role="img" d="M60,160 L150,200 L170,330 L70,320 Z" fill="#dde8f7"><title>{bi('low complaint density', 'తక్కువ సాంద్రత')}</title></path>
              <path className="region" role="img" d="M150,200 L260,150 L430,160 L420,300 L280,330 L170,330 Z" fill="#f6a18c"><title>Kadapa (HQ) — {bi('high complaint density', 'అధిక సాంద్రత')}</title></path>
              <path className="region" role="img" d="M430,160 L530,210 L520,350 L420,300 Z" fill="#fbd9b0"><title>{bi('moderate complaint density', 'మధ్యమ సాంద్రత')}</title></path>
              <path className="region" role="img" d="M70,320 L170,330 L180,450 L90,460 Z" fill="#cfe0f7"><title>Badvel — {bi('low complaint density', 'తక్కువ సాంద్రత')}</title></path>
              <path className="region" role="img" d="M170,330 L280,330 L300,460 L180,450 Z" fill="#fbd9b0"><title>Mydukur — {bi('moderate complaint density', 'మధ్యమ సాంద్రత')}</title></path>
              <path className="region" role="img" d="M280,330 L420,300 L520,350 L500,470 L300,460 Z" fill="#dde8f7"><title>Rajampet — {bi('low complaint density', 'తక్కువ సాంద్రత')}</title></path>
              <text x="150" y="120" fontFamily="Inter" fontSize="11" fill="#5A6B8C" fontWeight="600">Jammalamadugu</text>
              <text x="320" y="105" fontFamily="Inter" fontSize="11" fill="#5A6B8C" fontWeight="600">Proddatur</text>
              <text x="470" y="120" fontFamily="Inter" fontSize="11" fill="#7a3326" fontWeight="600">Pulivendula</text>
              <text x="290" y="245" fontFamily="Inter" fontSize="11" fill="#7a3326" fontWeight="600">Kadapa (HQ)</text>
              <text x="110" y="395" fontFamily="Inter" fontSize="11" fill="#5A6B8C" fontWeight="600">Badvel</text>
              <text x="215" y="405" fontFamily="Inter" fontSize="11" fill="#5A6B8C" fontWeight="600">Mydukur</text>
              <text x="380" y="415" fontFamily="Inter" fontSize="11" fill="#5A6B8C" fontWeight="600">Rajampet</text>
            </svg>
            {rows.slice(0, 3).map((h, i) => (
              <div className="hot" key={i} style={{ left: ['64%', '45%', '30%'][i], top: ['20%', '48%', '33%'][i] }} role="img" title={bi(`Active hotspot — ${h.subject}, ${h.mandal}: ${h.count} cases`, `యాక్టివ్ హాట్‌స్పాట్ — ${h.subject}, ${h.mandal}: ${h.count} కేసులు`)} aria-label={`Active hotspot — ${h.subject}, ${h.mandal}: ${h.count} cases`}><div className="ping" /></div>
            ))}
            <div className="maplegend">
              <div className="lt">{bi('Complaint density', 'ఫిర్యాదుల సాంద్రత')}</div>
              <div className="legrow"><span className="sw" style={{ background: '#f6a18c' }} /><span>{bi('High', 'అధికం')}</span></div>
              <div className="legrow"><span className="sw" style={{ background: '#fbd9b0' }} /><span>{bi('Moderate', 'మధ్యమం')}</span></div>
              <div className="legrow"><span className="sw" style={{ background: '#cfe0f7' }} /><span>{bi('Low', 'తక్కువ')}</span></div>
              <div className="legrow"><span className="ping" style={{ position: 'static', width: 11, height: 11 }} /><span>{bi('Active hotspot', 'యాక్టివ్ హాట్‌స్పాట్')}</span></div>
            </div>
          </div>
        </div>

        <div className="card hotlist" style={{ alignSelf: 'start' }}>
          <div className="panel-head"><h2>{bi('Detected hotspots', 'గుర్తించిన హాట్‌స్పాట్‌లు')}</h2><span className="hint">{bi('AI-clustered', 'AI-క్లస్టర్')}</span></div>
          {rows.slice(0, 6).map((h, i) => (
            <div className="hotrow" key={i}>
              <div className={`hot-rank${rankCls(i)}`}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div className="nm">{h.subject} — {h.mandal}</div>
                <div className="ds">{[h.dept, bi('clustered cases', 'క్లస్టర్ కేసులు')].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="ct"><div className="n">{h.count}</div><div className="l">{bi('cases', 'కేసులు')}</div></div>
            </div>
          ))}
          <div style={{ padding: '14px 18px' }}><button className="btn btn-gold" style={{ width: '100%', justifyContent: 'center' }}><Icon name="sparkle" />{bi('Generate action plan', 'కార్యాచరణ ప్రణాళిక')}</button></div>
        </div>
      </div>
    </section>
  );
}
