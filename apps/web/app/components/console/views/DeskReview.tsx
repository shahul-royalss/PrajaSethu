'use client';

// Quick Desk Review (Saarthi 2.0). A citizen asked to reopen a resolved/closed
// case and gave a MANDATORY reason (typed or spoken — the voice file is right
// here, playable in the citizen's own language). The officer sees:
//   · the original complaint + the department's resolution record
//   · the citizen's background profile (history, ratings, vulnerability)
//   · the AI's explanation of WHY the citizen is reopening + a recommendation
// …then decides: approve the reopen (auto-escalates) or uphold the closure
// with a reason the citizen will read. The officer always decides — the AI
// only explains.

import { useCallback, useEffect, useState } from 'react';
import { api, API_BASE } from '../../../lib/api';
import { Icon } from '../Icon';
import { useBi } from '../bi';

interface DeskItem {
  id: string;
  ysr: string;
  department: { id: string; en: string; te: string } | null;
  severity: string | null;
  urgency: string | null;
  mandal: string | null;
  village: string | null;
  description: string;
  descriptionEn: string | null;
  summaryEn: string | null;
  resolutionNotes: { note: string; at: string; role: string }[];
  citizen: {
    name: string | null;
    profile: {
      totalComplaints: number;
      resolvedOrClosed: number;
      reopens: number;
      avgRating: number | null;
      vulnerabilityFlags: string[];
      memberSinceDays: number;
    };
  };
  reopen: {
    id: string;
    reason: string | null;
    reasonTe: string | null;
    channel: string;
    reasonLang: string | null;
    reasonLangName: { en: string; native: string };
    reasonAudioId: string | null;
    requestedAt: string;
    aiReview: {
      reasonSummary: string;
      reasonCategory: string;
      recommendation: 'REOPEN' | 'FIELD_VERIFY' | 'UPHOLD';
      rationale: string;
      profileSignals: string[];
      confidence: number;
      source: string;
    } | null;
  };
  wasClosed: boolean;
  resolvedAt: string | null;
  closedAt: string | null;
}

const REC_TONE: Record<string, { label: { en: string; te: string }; color: string }> = {
  REOPEN: { label: { en: 'AI leans: REOPEN', te: 'AI మొగ్గు: రీఓపెన్' }, color: 'var(--ok, #0C9C6C)' },
  FIELD_VERIFY: { label: { en: 'AI leans: FIELD VERIFY', te: 'AI మొగ్గు: క్షేత్ర ధృవీకరణ' }, color: 'var(--warn, #B7791F)' },
  UPHOLD: { label: { en: 'AI leans: UPHOLD', te: 'AI మొగ్గు: సమర్థించండి' }, color: 'var(--muted)' },
};

export function DeskReviewView({ token }: { token: string }) {
  const bi = useBi();
  const [items, setItems] = useState<DeskItem[] | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.get<DeskItem[]>('/grievances/desk-review/queue', token));
    } catch {
      setItems([]);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(g: DeskItem, decision: 'REOPEN' | 'UPHOLD') {
    const n = (note[g.id] ?? '').trim();
    if (!n) {
      setToast(bi('A decision note is mandatory — the citizen reads it.', 'నిర్ణయ గమనిక తప్పనిసరి — పౌరుడు దాన్ని చదువుతారు.'));
      setTimeout(() => setToast(null), 3500);
      return;
    }
    setBusy(g.id);
    try {
      await api.post(`/grievances/${g.id}/desk-review/decision`, { decision, note: n }, token);
      setToast(decision === 'REOPEN' ? bi(`✓ ${g.ysr} reopened & escalated`, `✓ ${g.ysr} రీఓపెన్ & ఎస్కలేట్`) : bi(`✓ ${g.ysr} closure upheld`, `✓ ${g.ysr} మూసివేత సమర్థించబడింది`));
      setTimeout(() => setToast(null), 4000);
      await load();
    } catch (e) {
      setToast((e as Error).message);
      setTimeout(() => setToast(null), 4000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="view active">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="greet" style={{ fontSize: 21 }}>{bi('Quick Desk Review', 'త్వరిత డెస్క్ సమీక్ష')}</div>
          <div className="subtle">
            {bi(
              'Citizens asking to reopen. Read their reason (or listen to it), weigh the AI brief and their background — then decide. Your note goes to the citizen.',
              'రీఓపెన్ కోరుతున్న పౌరులు. వారి కారణం చదవండి (లేదా వినండి), AI బ్రీఫ్ & నేపథ్యాన్ని పరిశీలించి నిర్ణయించండి. మీ గమనిక పౌరుడికి వెళ్తుంది.',
            )}
          </div>
        </div>
        {toast && <span className="live" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}>{toast}</span>}
      </div>

      {items === null && <div className="card"><div className="cardbody" style={{ padding: 24, color: 'var(--faint)' }}>{bi('Loading…', 'లోడ్ అవుతోంది…')}</div></div>}
      {items && items.length === 0 && (
        <div className="card">
          <div className="cardbody" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 34 }} aria-hidden>⚖️</div>
            <div className="display" style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{bi('No reopen requests waiting', 'రీఓపెన్ అభ్యర్థనలు లేవు')}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {items?.map((g) => {
          const ai = g.reopen.aiReview;
          const rec = ai ? REC_TONE[ai.recommendation] : null;
          const p = g.citizen.profile;
          return (
            <div className="card" key={g.id}>
              <div className="cardbody" style={{ padding: 18 }}>
                {/* head */}
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <span className="gid" style={{ fontSize: 13 }}>{g.ysr}</span>
                  <span className="chip" style={{ cursor: 'default' }}>{g.department?.en ?? '—'}</span>
                  <span className="chip" style={{ cursor: 'default' }}><Icon name="pin" style={{ width: 12, height: 12 }} />{[g.village, g.mandal].filter(Boolean).join(', ') || '—'}</span>
                  <span className="chip" style={{ cursor: 'default' }}>{g.wasClosed ? bi('was CLOSED', 'మూసివేయబడింది') : bi('was RESOLVED', 'పరిష్కరించబడింది')}</span>
                  {rec && <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 800, color: rec.color }}>✦ {bi(rec.label.en, rec.label.te)} · {Math.round((ai?.confidence ?? 0) * 100)}%</span>}
                </div>

                <div className="bench" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,1fr)', gap: 16, marginTop: 14 }}>
                  {/* left: the case */}
                  <div style={{ minWidth: 0 }}>
                    <div className="transcript">
                      <em>{bi('Original complaint', 'అసలు ఫిర్యాదు')}</em>
                      <span className="font-telugu">{g.description}</span>
                    </div>

                    <div style={{ marginTop: 10 }}>
                      <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>{bi('Department resolution record', 'శాఖ పరిష్కార రికార్డు')}</div>
                      {g.resolutionNotes.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: 'var(--bad)', fontWeight: 600 }}>
                          ⚠ {bi('No resolution notes/evidence were recorded — weigh this in the citizen’s favour.', 'పరిష్కార గమనికలు/ఆధారాలు నమోదు కాలేదు — ఇది పౌరుడి పక్షాన పరిగణించండి.')}
                        </div>
                      ) : (
                        g.resolutionNotes.slice(-3).map((n, i) => (
                          <div key={i} className="lawitem" style={{ alignItems: 'flex-start' }}>
                            <Icon name="doc" />
                            <span>{n.note} <span style={{ color: 'var(--faint)' }}>· {new Date(n.at).toLocaleDateString()}</span></span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* citizen's reason — text and/or original-language voice */}
                    <div style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: '#FDF7FF' }}>
                      <div className="nav-label" style={{ padding: 0, marginBottom: 6 }}>
                        {bi('Citizen’s reopen reason', 'పౌరుడి రీఓపెన్ కారణం')} · {g.reopen.channel === 'VOICE' ? '🎙 ' + bi('voice', 'వాయిస్') : '⌨ ' + bi('typed', 'టైప్')}
                        {g.reopen.reasonLang ? ` · ${g.reopen.reasonLangName.native} (${g.reopen.reasonLangName.en})` : ''}
                      </div>
                      {g.reopen.reason && <div style={{ fontSize: 13.5, lineHeight: 1.55 }} className="font-telugu">“{g.reopen.reason}”</div>}
                      {g.reopen.reasonAudioId && (
                        <audio
                          controls
                          preload="none"
                          src={`${API_BASE}/grievances/${g.id}/attachments/${g.reopen.reasonAudioId}/content`}
                          style={{ width: '100%', marginTop: 8 }}
                        />
                      )}
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>
                        {bi('Requested', 'అభ్యర్థించినది')} {new Date(g.reopen.requestedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* right: AI brief + citizen profile + decision */}
                  <div style={{ minWidth: 0 }}>
                    {ai && (
                      <div className="aibox" style={{ borderRadius: 12 }}>
                        <div className="aiseg">
                          <div className="lab"><Icon name="sparkle" />{bi('Why the citizen is reopening (AI)', 'పౌరుడు ఎందుకు రీఓపెన్ చేస్తున్నారు (AI)')}
                            <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: ai.source === 'claude' ? '#E7C988' : '#8FA6D6' }}>{ai.source}</span>
                          </div>
                          <div className="ai-summary">{ai.reasonSummary}</div>
                          <div className="suggest" style={{ marginTop: 8 }}>
                            <div className="ic"><Icon name="flag" /></div>
                            <div className="tx"><strong>{ai.reasonCategory.replace(/_/g, ' ')}</strong><span>{ai.rationale}</span></div>
                          </div>
                        </div>
                        <div className="aiseg">
                          <div className="lab"><Icon name="users" />{bi('Citizen background profile', 'పౌరుడి నేపథ్య ప్రొఫైల్')}</div>
                          {(ai.profileSignals.length ? ai.profileSignals : [bi('First-time complainant', 'మొదటి ఫిర్యాదుదారు')]).map((s, i) => (
                            <div className="lawitem" key={i}><Icon name="check2" /><span>{s}</span></div>
                          ))}
                          <div className="lawitem"><Icon name="users" /><span>{g.citizen.name ?? '—'} · {p.totalComplaints} {bi('cases', 'కేసులు')} · {p.reopens} {bi('reopen(s)', 'రీఓపెన్లు')}{p.avgRating != null ? ` · ${p.avgRating.toFixed(1)}★` : ''}</span></div>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <textarea
                        className="transcript"
                        style={{ width: '100%', minHeight: 64, fontFamily: 'inherit', fontSize: 13 }}
                        placeholder={bi('Decision note (mandatory — the citizen will read this)', 'నిర్ణయ గమనిక (తప్పనిసరి — పౌరుడు చదువుతారు)')}
                        value={note[g.id] ?? ''}
                        onChange={(e) => setNote((m) => ({ ...m, [g.id]: e.target.value }))}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy === g.id} onClick={() => decide(g, 'REOPEN')}>
                          <Icon name="check2" />{bi('Approve reopen (escalates)', 'రీఓపెన్ ఆమోదించు (ఎస్కలేట్)')}
                        </button>
                        <button className="btn btn-ghost" style={{ flex: 1 }} disabled={busy === g.id} onClick={() => decide(g, 'UPHOLD')}>
                          {bi('Uphold closure', 'మూసివేత సమర్థించు')}
                        </button>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 6 }}>
                        {bi('Both outcomes are notarised on the ledger and SMS’d to the citizen.', 'రెండు నిర్ణయాలూ లెడ్జర్‌లో నమోదై పౌరుడికి SMS వెళ్తాయి.')}
                      </p>
                    </div>
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
