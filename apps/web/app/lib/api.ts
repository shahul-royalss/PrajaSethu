// Thin client for the SAARTHI API. All calls are client-side so `next build`
// never depends on the API being up.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GATEWAY = [0, 502, 503, 504];

async function request<T>(path: string, opts: RequestInit & { token?: string; retry?: boolean; tries?: number } = {}): Promise<T> {
  const { token, headers, retry, tries, ...rest } = opts;
  const isGet = (rest.method ?? 'GET') === 'GET';
  // GETs and explicitly-idempotent calls (auth: request/verify-OTP, officer login)
  // may be retried to ride a sleeping free-tier API cold start. The backoff below
  // sums to ~30s, on top of the proxy which itself rides ~47s — so a cold start
  // (30–60s) almost never surfaces as an error to the citizen.
  const canRetry = isGet || !!retry;
  const maxAttempts = tries ?? (canRetry ? 6 : 1);

  let res: Response;
  let attempt = 0;
  while (true) {
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(headers ?? {}),
        },
        cache: 'no-store',
      });
    } catch {
      if (canRetry && attempt < maxAttempts - 1) {
        attempt++;
        await sleep(Math.min(1500 * attempt, 6000));
        continue;
      }
      throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.');
    }
    if (GATEWAY.includes(res.status) && canRetry && attempt < maxAttempts - 1) {
      attempt++;
      await sleep(Math.min(1500 * attempt, 6000));
      continue;
    }
    break;
  }

  // The server may return non-JSON on errors (e.g. a proxy/gateway "Internal
  // Server Error" page). Parse defensively so the UI never shows a raw
  // "Unexpected token …" JSON error.
  const text = await res.text();
  let body: any = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text; // keep as plain text
    }
  }

  if (!res.ok) {
    const apiMsg = body && typeof body === 'object' ? body.message : undefined;
    let msg: string;
    if (apiMsg) {
      msg = Array.isArray(apiMsg) ? apiMsg.join(', ') : String(apiMsg);
    } else if (res.status >= 500 || res.status === 0) {
      msg = 'The server is waking up — please try once more in a few seconds.';
    } else if (typeof body === 'string' && body.trim()) {
      msg = body.trim().slice(0, 140);
    } else {
      msg = res.statusText || `Request failed (${res.status})`;
    }
    throw new ApiError(res.status, msg);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, { method: 'GET', token }),
  post: <T>(path: string, data?: unknown, token?: string) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined, token }),
  // Idempotent POST that may be retried through a cold start (auth flows only).
  postSafe: <T>(path: string, data?: unknown, token?: string) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined, token, retry: true }),
  // Fire-and-forget warm-up: starts a sleeping API's cold start early (e.g. on the
  // login page) so it's awake by the time the citizen submits. Never throws.
  warm: () => request('/health', { method: 'GET', retry: true, tries: 8 }).then(() => true).catch(() => false),
};
