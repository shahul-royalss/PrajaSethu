'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '../components/Header';
import { LoginGate } from '../components/LoginGate';
import { Button, Card, CardBody, ErrorNote, Pill, Spinner, StatusBadge } from '../components/ui';
import { IntegrityShield } from '../components/IntegrityShield';
import { Officer } from '../lib/session';
import { api } from '../lib/api';
import { ListGrievance, RefItem } from '../lib/types';
import { daysLeft, fmtDate } from '../lib/i18n';

function slaTag(g: ListGrievance) {
  const dl = daysLeft(g.slaDueAt);
  if (dl !== null && dl < 0) return <Pill tone="red">🔴 overdue</Pill>;
  if (g.slaBreachPredicted) return <Pill tone="amber">⚠ likely breach</Pill>;
  if (dl !== null) return <Pill tone="slate">⏳ {dl}d</Pill>;
  return null;
}

function Workbench({ token, officer, logout }: { token: string; officer: Officer; logout: () => void }) {
  const [list, setList] = useState<ListGrievance[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [services, setServices] = useState<RefItem[] | { id: string; label: string }[]>([]);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const items = await api.get<ListGrievance[]>('/grievances/mine', token);
      setList(items);
      if (!selected && items.length) select(items[0].id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingList(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    loadList();
    api.get<any[]>('/reference/xroad-services').then(setServices).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function select(id: string) {
    setSelected(id);
    setDetail(null);
    setDraft(null);
    setNote('');
    setError(null);
    try {
      setDetail(await api.get<any>(`/grievances/${id}`, token));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (selected) await select(selected);
      await loadList();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function getDraft(kind: string) {
    setBusy(true);
    try {
      const d = await api.post<{ draft: string }>(`/grievances/${selected}/draft-assist`, { kind }, token);
      setDraft(d.draft);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const status = detail?.status;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm text-slate-600">
          Signed in: <b>{officer.name}</b> <Pill tone="slate">{officer.role}</Pill>
        </div>
        <button className="text-sm text-slate-500 underline" onClick={logout}>Sign out</button>
      </div>
      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        {/* List */}
        <Card className="h-fit">
          <CardBody>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">My grievances</div>
              <button className="text-xs text-brand underline" onClick={loadList}>Refresh</button>
            </div>
            {loadingList && <Spinner />}
            {!loadingList && list.length === 0 && <div className="text-sm text-slate-400">Nothing assigned to you.</div>}
            <ul className="space-y-1.5">
              {list.map((g) => (
                <li key={g.id}>
                  <button
                    onClick={() => select(g.id)}
                    className={`w-full rounded-lg border p-2.5 text-left text-sm transition ${selected === g.id ? 'border-brand bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-slate-500">{g.ysr}</span>
                      {slaTag(g)}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-slate-800">{g.department ?? '—'} · {g.mandal}</span>
                      <StatusBadge status={g.status} />
                    </div>
                    {g.emergency && <span className="text-xs text-red-600">🚨 emergency</span>}
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        {/* Detail */}
        <div className="space-y-4">
          {!detail && selected && <Spinner label="Loading grievance…" />}
          {detail && (
            <>
              <Card>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-mono text-lg font-bold text-slate-900">{detail.ysr}</div>
                      <div className="text-sm text-slate-600">{detail.subject?.en ?? '—'} · {detail.department?.en ?? '—'} · {detail.mandal}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={detail.status} />
                      <Pill tone="purple">L{detail.currentLevel}</Pill>
                      {detail.emergency && <Pill tone="red">🚨</Pill>}
                      {detail.slaBreachPredicted && <Pill tone="amber">⚠ pred breach</Pill>}
                    </div>
                  </div>

                  <p className="font-telugu mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{detail.description}</p>
                  {detail.descriptionEn && <p className="mt-1 text-xs text-slate-500">EN: {detail.descriptionEn}</p>}

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
                    <div><span className="block text-slate-400">Category</span>{detail.category}</div>
                    <div><span className="block text-slate-400">Priority</span>{detail.priorityScore}</div>
                    <div><span className="block text-slate-400">SLA due</span>{fmtDate(detail.slaDueAt)}</div>
                    <div><span className="block text-slate-400">Petitioner</span>{detail.petitioner?.name} ({detail.petitioner?.mobileMasked})</div>
                  </div>
                  {detail.petitioner?.vulnerabilityFlags?.length > 0 && (
                    <div className="mt-2 flex gap-1">{detail.petitioner.vulnerabilityFlags.map((f: string) => <Pill key={f} tone="amber">{f}</Pill>)}</div>
                  )}
                </CardBody>
              </Card>

              {/* Actions */}
              <Card>
                <CardBody className="space-y-3">
                  <div className="text-sm font-semibold text-slate-800">Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {status === 'ASSIGNED' && <Button onClick={() => act(() => api.post(`/grievances/${selected}/accept`, {}, token))} disabled={busy}>Accept</Button>}
                    {['ASSIGNED', 'UNDER_ENQUIRY', 'ON_HOLD'].includes(status) && (
                      <Button variant="ghost" onClick={() => act(() => api.post(`/grievances/${selected}/action`, { actionType: 'ENQUIRY', noteEn: note || 'Field enquiry conducted.' }, token))} disabled={busy}>Record enquiry</Button>
                    )}
                    {['UNDER_ENQUIRY', 'ASSIGNED', 'ACTION_TAKEN'].includes(status) && (
                      <Button onClick={() => act(() => api.post(`/grievances/${selected}/resolve`, { resolutionNote: note || 'Issue resolved.', evidenceIds: ['ev-' + Date.now()] }, token))} disabled={busy}>Resolve</Button>
                    )}
                    {['UNDER_ENQUIRY', 'ASSIGNED', 'ACTION_TAKEN'].includes(status) && (
                      <Button variant="ghost" onClick={() => act(() => api.post(`/grievances/${selected}/hold`, { reason: 'Awaiting citizen info' }, token))} disabled={busy}>Put on hold</Button>
                    )}
                    {status === 'ON_HOLD' && <Button variant="ghost" onClick={() => act(() => api.post(`/grievances/${selected}/resume`, {}, token))} disabled={busy}>Resume</Button>}
                  </div>

                  <textarea
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Action / resolution note… (use draft-assist below, then edit)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">✍ AI draft-assist:</span>
                    <Button variant="subtle" onClick={() => getDraft('ACK')} disabled={busy}>Ack</Button>
                    <Button variant="subtle" onClick={() => getDraft('ENQUIRY_NOTE')} disabled={busy}>Enquiry note</Button>
                    <Button variant="subtle" onClick={() => getDraft('RESOLUTION')} disabled={busy}>Resolution</Button>
                  </div>
                  {draft && (
                    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
                      <div className="mb-1 text-[11px] font-semibold text-indigo-600">AI-generated · review & edit before use</div>
                      <p className="whitespace-pre-wrap text-slate-700">{draft}</p>
                      <button className="mt-1 text-xs text-brand underline" onClick={() => setNote(draft)}>Use as note ↑</button>
                    </div>
                  )}

                  {/* X-Road */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-500">🔗 X-Road verify:</span>
                    {(services as any[]).map((s) => (
                      <Button key={s.id} variant="ghost" onClick={() => act(() => api.post(`/grievances/${selected}/xroad`, { service: s.id }, token))} disabled={busy}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* X-Road results + work log */}
              {detail.xroad?.length > 0 && (
                <Card>
                  <CardBody>
                    <div className="mb-2 text-sm font-semibold text-slate-800">X-Road verified facts</div>
                    {detail.xroad.map((x: any) => (
                      <div key={x.id} className="mb-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        <b>{x.service}</b> ← {x.toMember} · signed ✔ · logged ✔ <span className="text-slate-400">({fmtDate(x.createdAt)})</span>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              )}

              {detail.workLogs?.length > 0 && (
                <Card>
                  <CardBody>
                    <div className="mb-2 text-sm font-semibold text-slate-800">Work log</div>
                    <ul className="space-y-1.5 text-sm">
                      {detail.workLogs.map((w: any, i: number) => (
                        <li key={i} className="rounded-lg bg-slate-50 px-3 py-2">
                          <span className="text-xs font-semibold text-slate-500">{w.actionType}</span> · {w.noteEn ?? w.noteTe}
                          {w.aiDrafted && <Pill tone="purple">AI-drafted</Pill>}
                          <span className="block text-[11px] text-slate-400">{w.actor} · {fmtDate(w.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                </Card>
              )}

              <Card><CardBody><IntegrityShield grievanceId={detail.id} initial={detail.integrity} /></CardBody></Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OfficerPage() {
  return (
    <div className="min-h-screen">
      <Header title="Officer workbench" />
      <LoginGate allowedRoles={['OFFICER', 'SUPERVISOR', 'COLLECTOR']} title="Officer sign-in">
        {({ token, officer, logout }) => <Workbench token={token} officer={officer} logout={logout} />}
      </LoginGate>
    </div>
  );
}
