'use client';

import { memo, useEffect, useState } from 'react';
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

// Deterministic pseudo-random (no Math.random so renders are stable).
const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Town centres in map coordinates (600×520 viewBox) — also anchor the labels,
// the urban clusters and the road network.
const TOWNS = [
  { nm: 'Jammalamadugu', x: 150, y: 115, size: 20 },
  { nm: 'Proddatur', x: 330, y: 100, size: 26 },
  { nm: 'Pulivendula', x: 470, y: 118, size: 22 },
  { nm: 'Kadapa (HQ)', x: 295, y: 242, size: 42 },
  { nm: 'Badvel', x: 118, y: 390, size: 16 },
  { nm: 'Mydukur', x: 228, y: 396, size: 18 },
  { nm: 'Rajampet', x: 392, y: 410, size: 20 },
];

// All pin-able places: the labelled towns plus region centroids that are drawn
// on the map but have no settlement cluster. Hotspots whose mandal matches
// nothing are NOT pinned — a pin in the wrong place with the right label would
// mislead officers (the list card still shows every hotspot).
const PLACES: { nm: string; x: number; y: number }[] = [
  ...TOWNS.map((t) => ({ nm: t.nm, x: t.x, y: t.y + 16 })),
  { nm: 'Kondapuram', x: 115, y: 262 },
  { nm: 'Sidhout', x: 472, y: 258 },
];

// Farmland mosaic hugging the river corridor + the eastern plain.
const FIELD_COLORS = ['#5f7034', '#6d7c3b', '#87905a', '#7c6f3f', '#95855a', '#57633a', '#a3945f', '#4d5c2f'];
const FIELDS = Array.from({ length: 150 }, (_, i) => {
  const t = rnd(i * 3 + 1);
  // two corridors: along the river (x≈300) and the south-eastern plain
  const corridor = rnd(i * 7 + 2) > 0.42;
  const cx = corridor ? 300 + (rnd(i * 5 + 3) - 0.5) * 190 : 430 + (rnd(i * 5 + 3) - 0.5) * 220;
  const cy = corridor ? t * 500 + 10 : 300 + (rnd(i * 11 + 4) - 0.5) * 190;
  return {
    x: cx,
    y: cy,
    w: 7 + rnd(i * 13 + 5) * 16,
    h: 5 + rnd(i * 17 + 6) * 11,
    r: (rnd(i * 19 + 7) - 0.5) * 24,
    c: FIELD_COLORS[Math.floor(rnd(i * 23 + 8) * FIELD_COLORS.length)],
    o: 0.35 + rnd(i * 29 + 9) * 0.4,
  };
});

// Region boundaries (unchanged geometry — hotspot pins align with these).
const REGIONS: { d: string; nm: string; density: 'high' | 'mid' | 'low' }[] = [
  { d: 'M70,60 L230,40 L260,150 L150,200 L60,160 Z', nm: 'Jammalamadugu', density: 'low' },
  { d: 'M230,40 L420,55 L430,160 L260,150 Z', nm: 'Proddatur', density: 'mid' },
  { d: 'M420,55 L540,90 L530,210 L430,160 Z', nm: 'Pulivendula', density: 'high' },
  { d: 'M60,160 L150,200 L170,330 L70,320 Z', nm: 'Kondapuram', density: 'low' },
  { d: 'M150,200 L260,150 L430,160 L420,300 L280,330 L170,330 Z', nm: 'Kadapa (HQ)', density: 'high' },
  { d: 'M430,160 L530,210 L520,350 L420,300 Z', nm: 'Sidhout', density: 'mid' },
  { d: 'M70,320 L170,330 L180,450 L90,460 Z', nm: 'Badvel', density: 'low' },
  { d: 'M170,330 L280,330 L300,460 L180,450 Z', nm: 'Mydukur', density: 'mid' },
  { d: 'M280,330 L420,300 L520,350 L500,470 L300,460 Z', nm: 'Rajampet', density: 'low' },
];

const HEAT: { x: number; y: number; rx: number; ry: number; level: 'high' | 'mid' }[] = [
  { x: 470, y: 122, rx: 88, ry: 62, level: 'high' }, // Pulivendula
  { x: 295, y: 245, rx: 112, ry: 82, level: 'high' }, // Kadapa
  { x: 330, y: 102, rx: 70, ry: 44, level: 'mid' }, // Proddatur
  { x: 228, y: 396, rx: 66, ry: 46, level: 'mid' }, // Mydukur
  { x: 472, y: 268, rx: 62, ry: 48, level: 'mid' }, // Sidhout
];

const Urban = memo(function Urban({ cx, cy, size, seed }: { cx: number; cy: number; size: number; seed: number }) {
  const n = Math.round(size * 1.1);
  const roofs = ['#cfc8ba', '#b8b1a3', '#a89f92', '#98a0ac', '#c2bbae'];
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={size * 1.5} ry={size * 1.1} fill="#d8cfc0" opacity="0.14" filter="url(#sat-blur6)" />
      {Array.from({ length: n }, (_, i) => {
        // sum of two randoms ≈ denser at the centre, like real settlements
        const a = rnd(seed * 97 + i * 13) + rnd(seed * 53 + i * 29) - 1;
        const b = rnd(seed * 71 + i * 17) + rnd(seed * 31 + i * 41) - 1;
        const w = 1.6 + rnd(seed + i * 7) * 2.6;
        return (
          <rect
            key={i}
            x={cx + a * size * 1.4}
            y={cy + b * size}
            width={w}
            height={1.4 + rnd(seed + i * 11) * 2.2}
            fill={roofs[Math.floor(rnd(seed + i * 19) * roofs.length)]}
            opacity={0.75 + rnd(seed + i * 23) * 0.25}
            transform={`rotate(${(rnd(seed + i * 29) - 0.5) * 30} ${cx + a * size * 1.4} ${cy + b * size})`}
          />
        );
      })}
    </g>
  );
});

export function GisView({ token }: { token: string }) {
  const bi = useBi();
  const [hot, setHot] = useState<Hotspot[] | null>(null);
  const [heatOn, setHeatOn] = useState(true);

  useEffect(() => {
    api.get<Hotspot[]>('/dashboard/hotspots', token).then((r) => setHot(r.length ? r : DEMO_HOT)).catch(() => setHot(DEMO_HOT));
  }, [token]);

  const rows = hot ?? DEMO_HOT;
  const rankCls = (i: number) => (i === 0 ? '' : i === 1 ? ' amber' : ' gold');
  const densityTitle = (d: 'high' | 'mid' | 'low') =>
    d === 'high' ? bi('high complaint density', 'అధిక సాంద్రత') : d === 'mid' ? bi('moderate complaint density', 'మధ్యమ సాంద్రత') : bi('low complaint density', 'తక్కువ సాంద్రత');

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
            <button className="chip on">{bi('Satellite', 'శాటిలైట్')}</button>
            <button className="chip"><Icon name="drop" style={{ width: 12, height: 12, verticalAlign: -1 }} /> {bi('Water', 'నీరు')}</button>
            <button className="chip"><Icon name="bolt" style={{ width: 12, height: 12, verticalAlign: -1 }} /> {bi('Power', 'విద్యుత్')}</button>
            <button className="chip">{bi('Roads', 'రహదారులు')}</button>
            <button className="chip">{bi('Health', 'ఆరోగ్యం')}</button>
            <span className="sp" />
            <button className={`chip${heatOn ? ' on' : ''}`} aria-pressed={heatOn} onClick={() => setHeatOn((v) => !v)}>{bi('Heatmap', 'హీట్‌మ్యాప్')}</button>
          </div>
          <div className="mapview sat">
            {/* viewBox extends past the 600×520 scene so full-bleed (slice)
                rendering crops spare terrain, not towns/labels, on wide cards */}
            <svg viewBox="-160 -40 920 600" preserveAspectRatio="xMidYMid slice" role="group" aria-label={bi('District complaint-density satellite map', 'జిల్లా ఫిర్యాదుల సాంద్రత శాటిలైట్ మ్యాప్')}>
              <defs>
                <linearGradient id="sat-land" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#38471f" />
                  <stop offset="0.4" stopColor="#48522a" />
                  <stop offset="0.72" stopColor="#5d5c33" />
                  <stop offset="1" stopColor="#6e653d" />
                </linearGradient>
                <radialGradient id="sat-heat-high" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" stopColor="#ff4b2e" stopOpacity="0.72" />
                  <stop offset="0.45" stopColor="#ff7c31" stopOpacity="0.4" />
                  <stop offset="1" stopColor="#ffb03c" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="sat-heat-mid" cx="0.5" cy="0.5" r="0.5">
                  <stop offset="0" stopColor="#ffa42e" stopOpacity="0.5" />
                  <stop offset="0.55" stopColor="#ffc14d" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#ffd97a" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="sat-vignette" cx="0.5" cy="0.42" r="0.75">
                  <stop offset="0.62" stopColor="#000814" stopOpacity="0" />
                  <stop offset="1" stopColor="#000814" stopOpacity="0.42" />
                </radialGradient>
                <linearGradient id="sat-sun" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#fff7dd" stopOpacity="0.10" />
                  <stop offset="0.5" stopColor="#fff7dd" stopOpacity="0" />
                  <stop offset="1" stopColor="#001030" stopOpacity="0.18" />
                </linearGradient>
                {/* generous filter regions so the blur halo is never clipped
                    to a hard-edged rectangle around small elements */}
                <filter id="sat-blur18" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="18" /></filter>
                <filter id="sat-blur10" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="10" /></filter>
                <filter id="sat-blur6" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" /></filter>
                {/* fine sensor grain — mapped to alpha so it darkens like imagery */}
                <filter id="sat-grain" x="0" y="0" width="100%" height="100%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="11" stitchTiles="stitch" />
                  <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.55 0.55 0.55 0 0" />
                </filter>
                {/* broad land-cover mottling */}
                <filter id="sat-mottle" x="-20%" y="-20%" width="140%" height="140%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.012 0.016" numOctaves="4" seed="7" stitchTiles="stitch" />
                  <feColorMatrix type="matrix" values="0 0 0 0 0.18  0 0 0 0 0.22  0 0 0 0 0.10  0.9 0.4 0 0 0" />
                  <feComposite operator="in" in2="SourceGraphic" />
                </filter>
              </defs>

              {/* ── terrain base (covers the extended viewBox) ── */}
              <rect x="-160" y="-40" width="920" height="600" fill="url(#sat-land)" />
              <rect x="-160" y="-40" width="920" height="600" filter="url(#sat-mottle)" opacity="0.55" />

              {/* land-cover variation: forest, scrub, rocky ridges */}
              <g filter="url(#sat-blur18)">
                <ellipse cx="95" cy="105" rx="120" ry="80" fill="#2c3d1d" opacity="0.55" />
                <ellipse cx="120" cy="420" rx="150" ry="95" fill="#31431f" opacity="0.5" />
                <ellipse cx="520" cy="60" rx="120" ry="70" fill="#7a6c41" opacity="0.55" />
                <ellipse cx="545" cy="430" rx="130" ry="90" fill="#3a4a24" opacity="0.45" />
                <ellipse cx="390" cy="330" rx="110" ry="60" fill="#6b6138" opacity="0.4" />
                {/* margin terrain beyond the district, revealed on wide cards */}
                <ellipse cx="-80" cy="150" rx="130" ry="110" fill="#2f4020" opacity="0.5" />
                <ellipse cx="-70" cy="430" rx="120" ry="90" fill="#6f6640" opacity="0.45" />
                <ellipse cx="690" cy="120" rx="140" ry="100" fill="#75683f" opacity="0.5" />
                <ellipse cx="680" cy="420" rx="130" ry="95" fill="#334521" opacity="0.5" />
              </g>
              {/* rocky ridge band with lit/shadow edges (relief) */}
              <g filter="url(#sat-blur10)">
                <ellipse cx="70" cy="255" rx="34" ry="95" fill="#403c26" opacity="0.7" transform="rotate(14 70 255)" />
                <ellipse cx="83" cy="252" rx="22" ry="88" fill="#8d8256" opacity="0.35" transform="rotate(14 83 252)" />
                <ellipse cx="556" cy="255" rx="30" ry="120" fill="#3d3a25" opacity="0.65" transform="rotate(-10 556 255)" />
                <ellipse cx="568" cy="250" rx="18" ry="110" fill="#948a5e" opacity="0.3" transform="rotate(-10 568 250)" />
              </g>

              {/* farmland mosaic */}
              <g>
                {FIELDS.map((f, i) => (
                  <rect key={i} x={f.x} y={f.y} width={f.w} height={f.h} fill={f.c} opacity={f.o} transform={`rotate(${f.r} ${f.x} ${f.y})`} />
                ))}
              </g>

              {/* river + reservoir */}
              <path d="M290,-12 C 278,70 322,130 302,205 C 288,262 326,298 312,358 C 300,418 334,468 322,532" fill="none" stroke="#1d3b45" strokeWidth="8" strokeLinecap="round" opacity="0.92" />
              <path d="M290,-12 C 278,70 322,130 302,205 C 288,262 326,298 312,358 C 300,418 334,468 322,532" fill="none" stroke="#2c5a68" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
              <path d="M60,205 C 130,215 200,225 296,232" fill="none" stroke="#20414c" strokeWidth="4" strokeLinecap="round" opacity="0.8" />
              <ellipse cx="205" cy="430" rx="26" ry="14" fill="#16333e" />
              <ellipse cx="205" cy="430" rx="26" ry="14" fill="none" stroke="#2c5a68" strokeWidth="1.4" opacity="0.7" />
              <ellipse cx="500" cy="180" rx="14" ry="8" fill="#16333e" />

              {/* roads */}
              <g stroke="#cdbb92" fill="none" strokeLinecap="round">
                <path d="M55,300 Q 170,270 295,242 T 540,110" strokeWidth="2.4" opacity="0.85" />
                <path d="M150,115 Q 240,100 330,100 T 470,118" strokeWidth="1.5" opacity="0.6" />
                <path d="M295,242 Q 290,320 228,396 T 118,390" strokeWidth="1.5" opacity="0.6" />
                <path d="M228,396 Q 310,405 392,410" strokeWidth="1.5" opacity="0.6" />
                <path d="M330,100 Q 312,170 295,242" strokeWidth="1.3" opacity="0.5" />
                <path d="M470,118 Q 472,195 472,268 T 392,410" strokeWidth="1.2" opacity="0.45" />
              </g>

              {/* settlements */}
              {TOWNS.map((tn, i) => <Urban key={tn.nm} cx={tn.x} cy={tn.y} size={tn.size} seed={i + 1} />)}

              {/* heat overlay (complaint density) */}
              {heatOn && (
                <g className="heatlayer" filter="url(#sat-blur10)">
                  {HEAT.map((h, i) => (
                    <ellipse key={i} cx={h.x} cy={h.y} rx={h.rx} ry={h.ry} fill={`url(#sat-heat-${h.level})`} />
                  ))}
                </g>
              )}

              {/* admin boundaries + hover/tooltip targets */}
              <g>
                {REGIONS.map((r) => (
                  <path key={r.nm} className="region" d={r.d} stroke="rgba(255,255,255,.5)" strokeWidth="1" strokeDasharray="5 4" role="img">
                    <title>{`${r.nm} — ${densityTitle(r.density)}`}</title>
                  </path>
                ))}
              </g>

              {/* atmosphere: sun angle, wispy clouds, vignette */}
              <rect x="-160" y="-40" width="920" height="600" fill="url(#sat-sun)" pointerEvents="none" />
              <g filter="url(#sat-blur18)" pointerEvents="none">
                <ellipse cx="150" cy="70" rx="90" ry="16" fill="#ffffff" opacity="0.055" />
                <ellipse cx="480" cy="330" rx="110" ry="20" fill="#ffffff" opacity="0.05" />
              </g>
              <rect x="-160" y="-40" width="920" height="600" fill="url(#sat-vignette)" pointerEvents="none" />
              <rect x="-160" y="-40" width="920" height="600" filter="url(#sat-grain)" opacity="0.16" pointerEvents="none" />

              {/* labels — white with dark halo, like imagery basemaps */}
              <g fontFamily="Inter" fontSize="11" fontWeight="700" fill="#fff" stroke="#0b1220" strokeWidth="3" strokeOpacity="0.75" paintOrder="stroke" pointerEvents="none">
                {TOWNS.map((tn) => (
                  <g key={tn.nm}>
                    <circle cx={tn.x} cy={tn.y} r="2.1" stroke="none" />
                    <text x={tn.x + 6} y={tn.y - 6}>{tn.nm}</text>
                  </g>
                ))}
              </g>

              {/* active hotspot pins — in SVG coordinates so they track their
                  places exactly however the full-bleed map is cropped */}
              {rows.slice(0, 3).map((h, i) => {
                const p = PLACES.find((pl) => pl.nm.toLowerCase().startsWith(h.mandal.toLowerCase().slice(0, 6)));
                if (!p) return null; // unknown mandal: no pin (the hotspot list still shows it)
                const label = `Active hotspot — ${h.subject}, ${h.mandal}: ${h.count} cases`;
                return (
                  <g key={i} className="svg-hot" role="img" aria-label={label}>
                    <title>{bi(label, `యాక్టివ్ హాట్‌స్పాట్ — ${h.subject}, ${h.mandal}: ${h.count} కేసులు`)}</title>
                    <circle className="ring" cx={p.x} cy={p.y} r="10" />
                    <circle className="core" cx={p.x} cy={p.y} r="5.5" />
                  </g>
                );
              })}
            </svg>

            {/* map furniture as overlays (never cropped by the full-bleed map) */}
            <div className="map-north" aria-hidden>
              <svg viewBox="0 0 12 14" width="12" height="14"><polygon points="6,0 10,12 6,9.4 2,12" fill="#fff" /></svg>
              <div>N</div>
            </div>
            <div className="map-attrib" aria-hidden>
              <span className="scalebar" /><span>10 km</span>
              <span className="dot">·</span>
              <span>{bi('Simulated satellite imagery · SAARTHI GIS', 'అనుకరణ శాటిలైట్ చిత్రాలు · సారథి GIS')}</span>
            </div>
            <div className="maplegend">
              <div className="lt">{bi('Complaint density', 'ఫిర్యాదుల సాంద్రత')}</div>
              {heatOn && (
                <>
                  <div className="legrow"><span className="sw" style={{ background: 'linear-gradient(135deg,#ff4b2e,#ff7c31)' }} /><span>{bi('High', 'అధికం')}</span></div>
                  <div className="legrow"><span className="sw" style={{ background: 'linear-gradient(135deg,#ffa42e,#ffd97a)' }} /><span>{bi('Moderate', 'మధ్యమం')}</span></div>
                  <div className="legrow"><span className="sw" style={{ background: '#3f4c28' }} /><span>{bi('Low (no overlay)', 'తక్కువ (ఓవర్‌లే లేదు)')}</span></div>
                </>
              )}
              <div className="legrow"><span className="pin" /><span>{bi('Active hotspot', 'యాక్టివ్ హాట్‌స్పాట్')}</span></div>
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
