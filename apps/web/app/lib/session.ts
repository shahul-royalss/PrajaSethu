'use client';

// Minimal client-side session store (pilot). Real deployment uses httpOnly cookies
// + Keycloak OIDC; here a bearer token in localStorage keeps the demo self-contained.
export interface Officer {
  id: string;
  name: string;
  role: string;
  deptId?: string | null;
  level?: number;
}

const TOKEN_KEY = 'praja_token';
const OFFICER_KEY = 'praja_officer';

export function saveSession(token: string, officer: Officer) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(OFFICER_KEY, JSON.stringify(officer));
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getOfficer(): Officer | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(OFFICER_KEY);
  return raw ? (JSON.parse(raw) as Officer) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(OFFICER_KEY);
}
