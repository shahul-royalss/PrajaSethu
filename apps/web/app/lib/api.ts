// Thin client for the Praja Setu API. All calls are client-side so `next build`
// never depends on the API being up.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const isGet = (rest.method ?? 'GET') === 'GET';

  let res: Response;
  let attempt = 0;
  // Retry GETs through a transient gateway error / cold start (free hosting wakes
  // up slowly). POSTs are not retried to avoid double-submits.
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
      if (isGet && attempt < 2) {
        attempt++;
        await sleep(1500 * attempt);
        continue;
      }
      throw new ApiError(0, 'Cannot reach the server. Please check your connection and try again.');
    }
    if (isGet && [502, 503, 504].includes(res.status) && attempt < 2) {
      attempt++;
      await sleep(1500 * attempt);
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
      msg = 'The server is busy or waking up. Please wait a moment and try again.';
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
};
