'use client';

import { ReactNode, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { getOfficer, getToken, saveSession, clearSession, Officer } from '../lib/session';
import { Button, Card, CardBody, ErrorNote, Field } from './ui';

interface AuthCtx {
  token: string;
  officer: Officer;
  logout: () => void;
}

const ROLE_HINT: Record<string, string> = {
  DA: 'da1',
  OFFICER: 'cs.officer',
  SUPERVISOR: 'mpdo',
  COLLECTOR: 'collector',
  AUDITOR: 'auditor',
};

export function LoginGate({
  allowedRoles,
  title,
  children,
}: {
  allowedRoles: string[];
  title: string;
  children: (ctx: AuthCtx) => ReactNode;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [officer, setOfficer] = useState<Officer | null>(null);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('Praja@123');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = getToken();
    const o = getOfficer();
    if (t && o) {
      setToken(t);
      setOfficer(o);
    }
    setReady(true);
  }, []);

  async function login() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ accessToken: string; officer: Officer }>('/auth/officer/login', { username, password });
      saveSession(res.accessToken, res.officer);
      setToken(res.accessToken);
      setOfficer(res.officer);
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    clearSession();
    setToken(null);
    setOfficer(null);
  }

  if (!ready) return null;

  const authed = token && officer;
  const roleOk = authed && allowedRoles.includes(officer!.role);

  if (authed && !roleOk) {
    return (
      <div className="mx-auto max-w-md p-6">
        <ErrorNote>
          Signed in as <b>{officer!.role}</b>, but this surface needs one of: {allowedRoles.join(', ')}.{' '}
          <button className="underline" onClick={logout}>
            Switch account
          </button>
        </ErrorNote>
      </div>
    );
  }

  if (!authed) {
    const suggestions = [...new Set(allowedRoles.map((r) => ROLE_HINT[r]).filter(Boolean))];
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <Card>
          <CardBody className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{title}</h2>
              <p className="text-sm text-slate-500">Officer sign-in (mock Keycloak). Use a demo account below.</p>
            </div>
            <Field label="Username">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={suggestions[0] ?? 'username'}
                onKeyDown={(e) => e.key === 'Enter' && login()}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && login()}
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button onClick={login} disabled={busy || !username} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
            {suggestions.length > 0 && (
              <p className="text-center text-xs text-slate-400">
                Try: {suggestions.join(', ')} · password Praja@123
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  return <>{children({ token: token!, officer: officer!, logout })}</>;
}
