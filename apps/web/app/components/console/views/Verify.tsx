'use client';

// AI Gate — Human Verification desk (Saarthi 2.0 §8.4). Cases the two-stage
// classifier could NOT auto-route (below the 95% gate, or stage disagreement)
// land here. The District Grievance Officer sees the AI's top-3 with calibrated
// probabilities, the extraction summary and the original text, then assigns
// with one tap — and that decision becomes a training example.

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Icon } from '../Icon';
import { useBi } from '../bi';

interface VerifyItem {
  taskId: string;
  grievanceId: string;
  ysr: string;
  description: string;
  descriptionEn: string | null;
  summaryEn: string | null;
  summaryTe: string | null;
  severity: string | null;
  urgency: string | null;
  detectedLang: string | null;
  langName: string;
  mandal: string | null;
  village: string | null;
  suggestions: { deptId: string; name: string; probability: number }[];
  llmHint: string | null;
  rationale: string | null;
  slaDeadline: string;
  createdAt: string;
}

interface Dept {
  id: string;
  nameEn: string;
  nameTe: string;
}

export function VerifyView({ token }: { token: string }) {
  const bi = useBi();
  const [items, setItems] = useState<VerifyItem[] | null>(null);
  const [depts, setDepts] = useState<Dept[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setItems(await api.get<VerifyItem[]>('/grievances/verification/queue', token));
    } catch {
      setItems([]);
    }
  }, [token]);

  useEffect(() => {
    load();
    api.get<Dept[]>('/reference/departments').then(setDepts).catch(() => {});
  }, [load]);

  async function decide(g: VerifyItem, deptId: string) {
    setBusy(g.taskId);
    try {
      await api.post(`/grievances/${g.grievanceId}/verification/decision`, { deptId }, token);
      setToast(bi(`✓ ${g.ysr} routed to ${deptId} — decision recorded for training`, `✓ ${g.ysr} ${deptId}కు పంపబడింది — నిర్ణయం శిక్షణ కోసం నమోదైంది`));
      setTimeout(() => setToast(null), 4000);
      await load();
    } catch (e) {
      setToast((e as Error).message);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(null);
    }
  }

  const hoursLeft = (d: string) => Math.round((new Date(d).getTime() - Date.now()) / 3600000);

  return (
    <section className="view active">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="greet" style={{ fontSize: 21 }}>{bi('AI Gate — Human Verification', 'AI గేట్ — మానవ ధృవీకరణ')}</div>
          <div className="subtle">
            {bi(
              'The AI auto-routes only at ≥95% confidence with model agreement. Everything else waits for YOUR decision — and your decision retrains the classifier.',
              'AI ≥95% నమ్మకంతో మాత్రమే ఆటో-రూట్ చేస్తుంది. మిగతావన్నీ మీ నిర్ణయం కోసం వేచి ఉంటాయి — మీ నిర్ణయం మోడల్‌ను తిరిగి శిక్షణ ఇస్తుంది.',
            )}
          </div>
        </div>
        {toast && <span className="live" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}>{toast}</span>}
      </div>

      {items === null && <div className="card"><div className="cardbody" style={{ padding: 24, color: 'var(--faint)' }}>{bi('Loading…', 'లోడ్ అవుతోంది…')}</div></div>}
      {items && items.length === 0 && (
        <div className="card">
          <div className="cardbody" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 34 }} aria-hidden>🎯</div>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{bi('Queue clear — the gate is holding', 'క్యూ ఖాళీ — గేట్ పనిచేస్తోంది')}</div>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6 }}>{bi('Every incoming case cleared the 95% confidence gate and was auto-routed.', 'ప్రతి కొత్త కేసు 95% గేట్ దాటి ఆటో-రూట్ అయింది.')}</p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {items?.map((g) => {
          const hl = hoursLeft(g.slaDeadline);
          return (
            <div className="card" key={g.taskId}>
              <div className="cardbody" style={{ padding: 18 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span className="gid" style={{ fontSize: 13 }}>{g.ysr}</span>
                  <span className="chip" style={{ cursor: 'default' }}>{g.langName}{g.detectedLang ? ` · ${g.detectedLang}` : ''}</span>
                  {g.severity && <span className={`prio pr-${g.severity === 'CRITICAL' || g.severity === 'HIGH' ? 'hi' : 'md'}`}>{g.severity}</span>}
                  <span className="chip" style={{ cursor: 'default' }}><Icon name="pin" style={{ width: 12, height: 12 }} />{[g.village, g.mandal].filter(Boolean).join(', ') || '—'}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: hl <= 1 ? 'var(--bad)' : hl <= 2 ? 'var(--warn)' : 'var(--muted)' }}>
                    ⏳ {bi(`${hl}h left of the 4h SLA`, `4గం SLAలో ${hl}గం మిగిలింది`)}
                  </span>
                </div>

                <div className="transcript" style={{ marginTop: 12 }}>
                  <em>{bi('Citizen’s original words', 'పౌరుడి అసలు మాటలు')}</em>
                  <span className="font-telugu">{g.description}</span>
                  {g.descriptionEn && g.descriptionEn !== g.description && /\p{L}{3,}/u.test(g.descriptionEn) && (
                    <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12 }}>EN: {g.descriptionEn}</div>
                  )}
                </div>
                {g.rationale && (
                  <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
                    <Icon name="sparkle" style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> {bi('AI summary: ', 'AI సారాంశం: ')}{g.rationale}
                  </div>
                )}

                {/* AI top-3 — one-tap assign */}
                <div style={{ marginTop: 14 }}>
                  <div className="nav-label" style={{ padding: 0, marginBottom: 8 }}>
                    {bi('AI top-3 · tap to assign (your choice trains the model)', 'AI టాప్-3 · కేటాయించడానికి నొక్కండి (మీ ఎంపిక మోడల్‌ను నేర్పుతుంది)')}
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {g.suggestions.map((s, i) => (
                      <button
                        key={s.deptId}
                        disabled={busy === g.taskId}
                        onClick={() => decide(g, s.deptId)}
                        style={{
                          width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10, border: i === 0 ? '1px solid rgba(45,91,215,.4)' : '1px solid var(--line)',
                          background: i === 0 ? 'var(--royal-soft, #E8EEFC)' : '#fff',
                        }}
                      >
                        <span style={{ display: 'flex', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(45,91,215,.1)', color: 'var(--royal)' }}>
                          <Icon name="route" style={{ width: 14, height: 14 }} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ink, #0F1A33)' }}>{s.name}</span>
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)' }}>
                            {g.llmHint === s.deptId ? bi('LLM hint agrees · ', 'LLM సూచన అంగీకరిస్తుంది · ') : ''}
                            {bi('calibrated probability', 'కాలిబ్రేటెడ్ సంభావ్యత')}
                          </span>
                        </span>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 800, color: i === 0 ? 'var(--royal)' : 'var(--muted)' }}>
                          {Math.round(s.probability * 100)}%
                        </span>
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <select
                      value={manual[g.taskId] ?? ''}
                      onChange={(e) => setManual((m) => ({ ...m, [g.taskId]: e.target.value }))}
                      style={{ flex: 1, padding: '9px 10px', borderRadius: 10, border: '1px solid var(--line)', fontSize: 13, background: '#fff', color: 'var(--ink)' }}
                    >
                      <option value="">{bi('…or pick a different department', '…లేదా వేరే శాఖను ఎంచుకోండి')}</option>
                      {depts.map((d) => (
                        <option key={d.id} value={d.id}>{d.nameEn}</option>
                      ))}
                    </select>
                    <button
                      className="btn btn-primary"
                      disabled={busy === g.taskId || !manual[g.taskId]}
                      onClick={() => manual[g.taskId] && decide(g, manual[g.taskId])}
                    >
                      <Icon name="check2" />{bi('Assign', 'కేటాయించు')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
