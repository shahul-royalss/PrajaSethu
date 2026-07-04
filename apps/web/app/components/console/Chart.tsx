'use client';

import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import type { ChartConfiguration } from 'chart.js';

// Honour reduced-motion + the prototype's Chart.js defaults.
Chart.defaults.font.family = "'Inter',sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = '#5A6B8C';

/**
 * Thin React wrapper around raw Chart.js (the prototype uses raw Chart.js, not
 * react-chartjs-2 — which doesn't support React 19). `build` receives the 2D
 * context so callers can create gradients exactly as the prototype does.
 */
export function ChartCanvas({
  build,
  className,
  ariaLabel,
  deps = [],
}: {
  build: (ctx: CanvasRenderingContext2D) => ChartConfiguration | any;
  className?: string;
  ariaLabel?: string;
  // Re-create the chart when these change, so live data that arrives after mount
  // is reflected (Chart.js holds its own state outside React).
  deps?: unknown[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const config = buildRef.current(ctx);
    config.options = config.options ?? {};
    (config.options as any).animation = reduce ? false : (config.options as any).animation;
    const chart = new Chart(ctx, config);
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return <canvas ref={ref} className={className} role="img" aria-label={ariaLabel} />;
}

export function makeGradient(ctx: CanvasRenderingContext2D, c1: string, c2: string, height = 230) {
  const g = ctx.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

export const CHART_GRID = '#EAEFF8';
