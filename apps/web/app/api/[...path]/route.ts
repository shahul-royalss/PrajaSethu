import { NextRequest } from 'next/server';

// Runtime reverse-proxy for /api/*  →  the NestJS API.
//
// WHY A ROUTE HANDLER (not next.config rewrites): Next.js bakes `rewrites()` into
// the build, so the proxy target would be frozen at build time. Managed hosts
// (Render/Railway/Fly) only provide the API URL at RUNTIME. This handler runs on
// every request and reads API_PROXY_TARGET live, so the same image works anywhere.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function apiBase(): string {
  let t = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';
  if (!/^https?:\/\//.test(t)) {
    // Accept a bare host[:port]; public hosts (a dot, not an IP/localhost) → https.
    const isPublic = t.includes('.') && !/^\d+\.\d+\.\d+\.\d+/.test(t) && !t.startsWith('localhost');
    t = `${isPublic ? 'https' : 'http'}://${t}`;
  }
  return t.replace(/\/+$/, '');
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const search = new URL(req.url).search;
  const dest = `${apiBase()}/api/${path.join('/')}${search}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('accept-encoding'); // let undici hand us a plain body

  const init: RequestInit = { method: req.method, headers, redirect: 'manual' };
  if (!['GET', 'HEAD'].includes(req.method)) {
    init.body = await req.arrayBuffer();
  }

  let res: Response;
  try {
    res = await fetch(dest, init);
  } catch {
    return new Response(JSON.stringify({ message: 'The server is busy or waking up. Please try again in a moment.' }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await res.arrayBuffer();
  const out = new Headers(res.headers);
  // These describe the upstream transfer, not ours — drop so the browser doesn't choke.
  out.delete('content-encoding');
  out.delete('content-length');
  out.delete('transfer-encoding');
  return new Response(body, { status: res.status, headers: out });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
