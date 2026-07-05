import { NextRequest } from 'next/server';

// Runtime reverse-proxy for /api/*  →  the NestJS API.
//
// WHY A ROUTE HANDLER (not next.config rewrites): Next.js bakes `rewrites()` into
// the build, so the proxy target would be frozen at build time. Managed hosts
// (Render/Railway/Fly) only provide the API URL at RUNTIME. This handler runs on
// every request and reads API_PROXY_TARGET live, so the same image works anywhere.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // allow time to ride a free-tier API cold start

function apiBase(): string {
  let t = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
  if (!/^https?:\/\//.test(t)) {
    const isPublic = t.includes('.') && !/^\d+\.\d+\.\d+\.\d+/.test(t) && !t.startsWith('localhost');
    t = `${isPublic ? 'https' : 'http'}://${t}`;
  }
  return t.replace(/\/+$/, '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const base = apiBase();
  const dest = `${base}/api/${path.join('/')}${search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('accept-encoding'); // let undici hand us a plain body

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  // Ride out a sleeping/free-tier API: gateway 502/503/504 and connection errors
  // mean the request never reached the app, so retrying is safe (even for POST).
  // 429 comes from the host platform's edge rate limiter (the app itself never
  // sends one) — the request was rejected before reaching the app, so it is
  // equally safe to retry after backing off. The backoff sums to ~47s (under
  // maxDuration=60) so a full cold start (30–60s) is absorbed here and never
  // surfaces to the citizen as an error.
  const TRANSIENT = [429, 502, 503, 504];
  const MAX = 11;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(dest, init);
    } catch (e) {
      console.error(`[api-proxy] attempt ${attempt} fetch error → ${dest}:`, (e as Error)?.message);
    }

    if (res && !TRANSIENT.includes(res.status)) {
      if (res.status >= 500) console.error(`[api-proxy] upstream ${res.status} ← ${dest}`);
      const body = await res.arrayBuffer();
      const out = new Headers(res.headers);
      out.delete('content-encoding');
      out.delete('content-length');
      out.delete('transfer-encoding');
      return new Response(body, { status: res.status, headers: out });
    }

    if (res) console.error(`[api-proxy] attempt ${attempt} ${res.status === 429 ? 'rate-limited' : `gateway ${res.status}`} ← ${dest}`);
    if (attempt < MAX) {
      // Rate limited → wait what the platform asks for (capped), else back off.
      const retryAfter = res?.status === 429 ? Number(res.headers.get('retry-after')) : NaN;
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 10_000)
        : res?.status === 429
          ? 5000
          : attempt <= 2 ? 2000 : 5000; // ~2,2,5×8 ≈ 47s
      await sleep(wait);
    }
  }

  return new Response(
    JSON.stringify({ message: 'The server is busy or waking up. Please wait a moment and try again.' }),
    { status: 502, headers: { 'content-type': 'application/json' } },
  );
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
