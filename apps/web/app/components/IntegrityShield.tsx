'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { VerifyResult } from '../lib/types';
import { fmtDate } from '../lib/i18n';

/**
 * The blockchain payoff (Blueprint D.2 / F.2): one tap re-hashes the grievance's
 * ledger trail and tells the citizen whether the record is unaltered.
 */
export function IntegrityShield({ grievanceId, initial }: { grievanceId: string; initial?: VerifyResult }) {
  const [result, setResult] = useState<VerifyResult | undefined>(initial);
  const [loading, setLoading] = useState(false);

  async function verify() {
    setLoading(true);
    try {
      const r = await api.get<VerifyResult>(`/ledger/verify/${grievanceId}`);
      setResult(r);
    } catch {
      setResult({ ok: false, checked: 0, reason: 'verification unavailable', lastCheckedAt: new Date().toISOString() });
    } finally {
      setLoading(false);
    }
  }

  const ok = result?.ok;
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
        ok === undefined ? 'border-slate-200 bg-slate-50' : ok ? 'border-teal-300 bg-teal-50' : 'border-red-300 bg-red-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-lg ${ok === false ? 'text-red-600' : 'text-ledger'}`} aria-hidden>
          🛡
        </span>
        <div className="text-sm">
          <div className="font-semibold text-slate-800">
            {ok === undefined ? 'Ledger integrity' : ok ? 'Verified & unaltered' : 'Tamper detected'}
          </div>
          <div className="text-xs text-slate-500">
            {result
              ? `${result.events ?? result.checked} event(s) checked · ${fmtDate(result.lastCheckedAt)}`
              : 'Blockchain-notarised audit trail'}
            {result && !ok && result.reason ? ` · ${result.reason}` : ''}
          </div>
        </div>
      </div>
      <button
        onClick={verify}
        disabled={loading}
        className="rounded-md border border-teal-300 bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-50"
      >
        {loading ? 'Verifying…' : 'Verify integrity'}
      </button>
    </div>
  );
}
