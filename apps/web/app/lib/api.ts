// Thin client for the Praja Setu API. All calls are client-side so `next build`
// never depends on the API being up.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, opts: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, headers, ...rest } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers ?? {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = body?.message ?? res.statusText;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : msg);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, token?: string) => request<T>(path, { method: 'GET', token }),
  post: <T>(path: string, data?: unknown, token?: string) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined, token }),
};
