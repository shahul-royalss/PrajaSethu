import { CSSProperties } from 'react';

/**
 * SAARTHI brandmark — a charioteer's wheel (chakra). "Saarthi" means the guide /
 * charioteer who steers the citizen through the system; the 24-spoke wheel also
 * nods to the national emblem. Pure SVG so it renders crisp at any size with no
 * external asset or network dependency.
 */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const spokes = Array.from({ length: 16 });
  const c = 50;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="SAARTHI"
    >
      <defs>
        <linearGradient id="saarthiRim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b5bdb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </linearGradient>
      </defs>
      <circle cx={c} cy={c} r="48" fill="url(#saarthiRim)" />
      <circle cx={c} cy={c} r="38" fill="none" stroke="#fbbf24" strokeWidth="3" />
      <g stroke="#e2e8ff" strokeWidth="2.4" strokeLinecap="round">
        {spokes.map((_, i) => {
          const a = (i * Math.PI * 2) / spokes.length;
          return (
            <line
              key={i}
              x1={c + Math.cos(a) * 10}
              y1={c + Math.sin(a) * 10}
              x2={c + Math.cos(a) * 36}
              y2={c + Math.sin(a) * 36}
            />
          );
        })}
      </g>
      <circle cx={c} cy={c} r="11" fill="#fbbf24" />
      <circle cx={c} cy={c} r="5" fill="#1e3a8a" />
    </svg>
  );
}

/**
 * Full lockup: mark + wordmark + Government-of-India sub-line. `tone="light"`
 * for dark/coloured backgrounds.
 */
export function Logo({
  size = 38,
  tone = 'dark',
  showSub = true,
  className = '',
  style,
}: {
  size?: number;
  tone?: 'dark' | 'light';
  showSub?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const title = tone === 'light' ? 'text-white' : 'text-ink';
  const sub = tone === 'light' ? 'text-white/70' : 'text-slate-500';
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`} style={style}>
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className={`block text-lg font-extrabold tracking-tight ${title}`}>SAARTHI</span>
        {showSub && (
          <span className={`block text-[10px] font-medium uppercase tracking-[0.14em] ${sub}`}>
            Government of India
          </span>
        )}
      </span>
    </span>
  );
}
