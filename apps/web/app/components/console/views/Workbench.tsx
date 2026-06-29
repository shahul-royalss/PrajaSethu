'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, API_BASE } from '../../../lib/api';
import { Officer } from '../../../lib/session';
import { ListGrievance } from '../../../lib/types';
import { speak } from '../../../lib/speech';
import { Icon, IconName } from '../Icon';
import { useBi } from '../bi';
import { isOverdue, priority, slaTimer, statusPill } from '../data';

interface Attachment { id: string; filename: string; mime: string; sizeBytes: number; originalSizeBytes?: number; compressed: boolean; createdAt: string }
interface XroadService { id: string; member: string; deptId: string; label: string; category: string; description: string }
const WAVE = [6, 12, 20, 9, 16, 24, 14, 8, 18, 26, 11, 7, 15, 22, 10, 19, 13, 25, 9, 14, 21, 8, 17, 12, 6, 20, 15, 9, 23, 11, 7, 16, 13];
const kb = (n?: number) => (!n ? '0 KB' : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function WorkbenchView({ token, officer }: { token: string; officer: Officer }) {
  const bi = useBi();
  const [list, setList] = useState<ListGrievance[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [timeline, setTimeline] = useState<{ event: string; role: string; at: string; txId: string }[]>([]);
  const [services, setServices] = useState<XroadService[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'risk' | 'high' | 'new'>('all');
  const selReq = useRef(0); // guards against out-of-order responses when switching cases

  const loadList = useCallback(async () => {
    try {
      let items = await api.get<ListGrievance[]>('/grievances/mine', token);
      if (!items.length && ['SUPERVISOR', 'COLLECTOR', 'AUDITOR'].includes(officer.role)) {
        items = await api.get<ListGrievance[]>('/grievances', token);
      }
      setList(items);
      if (items.length && !selected) select(items[0].id);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, officer.role]);

  useEffect(() => {
    loadList();
    api.get<XroadService[]>('/reference/xroad-services', token).then(setServices).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function select(id: string) {
    const my = ++selReq.current;
    setSelected(id); setDetail(null); setAttachments([]); setTimeline([]); setNote('');
    try {
      const d = await api.get<any>(`/grievances/${id}`, token);
      if (my !== selReq.current) return; // a newer selection won
      setDetail(d);
      api.get<Attachment[]>(`/grievances/${id}/attachments`, token).then((a) => { if (my === selReq.current) setAttachments(a); }).catch(() => {});
      if (d?.ysr) api.get<any>(`/grievances/public/${d.ysr}`).then((p) => { if (my === selReq.current) setTimeline(p.timeline ?? []); }).catch(() => {});
    } catch { /* ignore */ }
  }

  async function act(fn: () => Promise<unknown>, msg?: string) {
    setBusy(true);
    try { await fn(); if (selected) await select(selected); await loadList(); if (msg) flash(msg); }
    catch (e) { flash((e as Error).message); }
    finally { setBusy(false); }
  }
  function flash(m: string) { setToast(m); setTimeout(() => setToast(null), 3500); }

  async function draftAssist(kind: string) {
    setBusy(true);
    try { const d = await api.post<{ draft: string }>(`/grievances/${selected}/draft-assist`, { kind }, token); setNote(d.draft); }
    catch (e) { flash((e as Error).message); } finally { setBusy(false); }
  }
  async function compress(attId: string) {
    setBusy(true);
    try {
      const r = await api.post<{ beforeBytes: number; afterBytes: number; savedPercent: number }>(`/grievances/${selected}/attachments/${attId}/compress`, {}, token);
      flash(bi(`Compressed ✓ ${kb(r.beforeBytes)} → ${kb(r.afterBytes)} (−${r.savedPercent}%)`, `కంప్రెస్ ✓ −${r.savedPercent}%`));
      if (selected) api.get<Attachment[]>(`/grievances/${selected}/attachments`, token).then(setAttachments).catch(() => {});
    } catch (e) { flash((e as Error).message); } finally { setBusy(false); }
  }

  const shown = list.filter((g) => {
    if (filter === 'risk') return g.slaBreachPredicted || isOverdue(g);
    if (filter === 'high') return priority(g).level === 'hi';
    if (filter === 'new') return ['REGISTERED', 'CLASSIFIED', 'ASSIGNED'].includes(g.status);
    return true;
  });

  const status = detail?.status;
  const high = list.filter((g) => priority(g).level === 'hi').length;
  const dueToday = list.filter((g) => { const s = slaTimer(g); return s.tone !== 'ok' && g.status !== 'RESOLVED' && g.status !== 'CLOSED'; }).length;

  return (
    <section className="view active">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="greet" style={{ fontSize: 21 }}>{bi('Officer AI Workbench', 'అధికారి AI వర్క్‌బెంచ్')}</div>
          <div className="subtle">{bi(`${list.length} in queue · ${high} high priority · ${dueToday} due soon. Saarthi has pre-analysed each case.`, `${list.length} క్యూలో · ${high} అధిక ప్రాధాన్యత · ${dueToday} గడువు. సారథి ముందే విశ్లేషించింది.`)}</div>
        </div>
        {toast && <span className="live" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}>{toast}</span>}
      </div>

      <div className="bench">
        {/* QUEUE */}
        <div className="queue">
          <div className="queue-head">
            <div className="row"><h3>{bi('My queue', 'నా క్యూ')}</h3><span className="count">{list.length}</span></div>
            <div className="qfilters">
              {([['risk', bi('SLA risk', 'SLA ప్రమాదం')], ['high', bi('High', 'అధికం')], ['new', bi('New', 'కొత్త')], ['all', bi('All', 'అన్నీ')]] as const).map(([k, lab]) => (
                <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{lab}</button>
              ))}
            </div>
          </div>
          <div className="qlist">
            {shown.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>{bi('Nothing in this filter.', 'ఈ ఫిల్టర్‌లో ఏమీ లేదు.')}</div>}
            {shown.map((g) => {
              const p = priority(g); const sl = slaTimer(g);
              return (
                <button key={g.id} className={`qcard${selected === g.id ? ' sel' : ''}`} onClick={() => select(g.id)}>
                  <div className="qcard-top"><span className="gid">{g.ysr}</span><span className={`prio pr-${p.level}`}>{bi(p.label.en, p.label.te)}</span></div>
                  <div className="qcard-subj">{g.department ?? bi('Grievance', 'ఫిర్యాదు')}</div>
                  <div className="qcard-meta"><Icon name="pin" style={{ width: 12, height: 12, color: 'var(--faint)' }} />{g.mandal ?? '—'}<span className="dotsep" /><span style={{ color: sl.tone === 'danger' ? 'var(--bad)' : sl.tone === 'warn' ? 'var(--warn)' : 'inherit', fontWeight: 600 }}>{bi(sl.en, sl.te)}</span></div>
                </button>
              );
            })}
          </div>
        </div>

        {/* DETAIL */}
        <div className="detail">
          {!detail ? (
            <div style={{ padding: 40, color: 'var(--faint)' }}>{bi('Select a grievance from the queue.', 'క్యూ నుండి ఫిర్యాదును ఎంచుకోండి.')}</div>
          ) : (() => {
            const ov = isOverdue(detail); const p = priority(detail as any); const st = statusPill(detail.status, ov);
            return (
              <>
                <div className="detail-head">
                  <div className="top">
                    <div><span className="gid" style={{ fontSize: 13 }}>{detail.ysr}</span><h2>{detail.subject?.en ?? bi('Grievance', 'ఫిర్యాదు')}</h2></div>
                    <span className={`pill ${st.cls}`} style={{ flex: 'none' }}>{bi(st.en, st.te)}</span>
                  </div>
                  <div className="tags">
                    <span className={`prio pr-${p.level}`}>{bi(p.label.en, p.label.te)} · {p.score}/100</span>
                    <span className="chip" style={{ cursor: 'default' }}>{detail.department?.en ?? '—'}</span>
                    <span className="chip" style={{ cursor: 'default' }}>{detail.category === 'FINANCE' ? bi('Finance', 'ఫైనాన్స్') : bi('Non-finance', 'నాన్-ఫైనాన్స్')}</span>
                    <span className="verify"><Icon name="shield" />{bi('Ledger-verified', 'లెడ్జర్-ధృవీకరించబడింది')}</span>
                  </div>
                </div>
                <div className="detail-body">
                  {/* citizen */}
                  <div className="dsection">
                    <h4>{bi('Citizen', 'పౌరుడు')}</h4>
                    <div className="citizen-row">
                      <div className="ava">{(detail.petitioner?.name ?? 'C').split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div className="cz-name">{detail.petitioner?.name ?? '—'}</div>
                        <div className="cz-meta">
                          <span><Icon name="pin" />{[detail.petitioner?.village, detail.mandal].filter(Boolean).join(', ') || '—'}</span>
                          <span><Icon name="phone" />{detail.petitioner?.mobileMasked ?? '—'}</span>
                          {detail.petitioner?.applicantType === 'COMMUNITY' && <span><Icon name="users" />{bi('Community', 'సముదాయం')}</span>}
                        </div>
                      </div>
                      <button className="btn btn-ghost"><Icon name="phone" />{bi('Call', 'కాల్')}</button>
                    </div>
                  </div>
                  {/* voice + transcript */}
                  <div className="dsection">
                    <h4>{bi('Original complaint · filed in citizen language', 'అసలు ఫిర్యాదు · పౌర భాషలో')}</h4>
                    <div className="voicebar">
                      <button className="play" onClick={() => speak(detail.description ?? '', 'te-IN')} aria-label="Play"><Icon name="play" /></button>
                      <div className="wave">{WAVE.map((h, i) => <i key={i} style={{ height: h, background: h > 18 ? 'var(--navy-600)' : undefined }} />)}</div>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>0:41</span>
                    </div>
                    <div className="transcript">
                      <em>{bi('Transcribed & translated by Bhashini', 'భాషిణి ద్వారా లిప్యంతరీకరణ & అనువాదం')}</em>
                      <span className="font-telugu" lang="te">{detail.description}</span>
                      {detail.descriptionEn && <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 12 }}>EN: {detail.descriptionEn}</div>}
                    </div>
                  </div>
                  {/* evidence / documents */}
                  <div className="dsection">
                    <h4>{bi('Evidence & documents', 'ఆధారాలు & పత్రాలు')} {attachments.length ? `(${attachments.length})` : ''}</h4>
                    {attachments.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: 'var(--faint)' }}>{bi('No documents attached by the citizen.', 'పౌరుడు పత్రాలు జతచేయలేదు.')}</div>
                    ) : (
                      <div className="evlist">
                        {attachments.map((a) => {
                          const img = (a.mime ?? '').startsWith('image/');
                          return (
                            <div className="ev" key={a.id} style={{ position: 'relative' }}>
                              <a href={`${API_BASE}/grievances/${selected}/attachments/${a.id}/content`} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <Icon name={img ? 'cam' : 'doc'} /><span>{kb(a.sizeBytes)}{a.compressed ? ' ✓' : ''}</span>
                              </a>
                              {img && !a.compressed && <button onClick={() => compress(a.id)} disabled={busy} title="Compress" style={{ position: 'absolute', top: 2, right: 2, fontSize: 10, color: 'var(--royal)' }}><Icon name="bolt" style={{ width: 13, height: 13 }} /></button>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {/* timeline */}
                  <div className="dsection">
                    <h4>{bi('Notarised case timeline', 'నోటరైజ్డ్ కేసు టైమ్‌లైన్')}</h4>
                    <div className="timeline">
                      {(timeline.length ? timeline : [{ event: detail.status, role: 'SYSTEM', at: detail.createdAt, txId: '' }]).map((t, i, arr) => (
                        <div className="tl" key={i}>
                          <div className={`tl-dot ${i < arr.length - 1 ? 'tl-done' : 'tl-now'}`} />
                          <div className="tl-c">
                            <div className="t">{t.event.replace(/_/g, ' ')}</div>
                            <div className="d">{new Date(t.at).toLocaleString()} · {t.role}</div>
                            {t.txId && <div className="who">notarised · {t.txId.slice(0, 22)}…</div>}
                          </div>
                        </div>
                      ))}
                      <div className="tl"><div className="tl-dot tl-wait" /><div className="tl-c"><div className="t">{bi('Resolution & citizen confirmation', 'పరిష్కారం & పౌర నిర్ధారణ')}</div><div className="d" style={{ color: 'var(--faint)' }}>{['RESOLVED', 'CLOSED'].includes(detail.status) ? bi('Done', 'పూర్తయింది') : bi('Pending', 'పెండింగ్')}</div></div></div>
                    </div>
                  </div>
                </div>
                {/* actions */}
                <div className="actions-bar">
                  <button className="btn btn-gold" disabled={busy} onClick={() => draftAssist('RESOLUTION')}><Icon name="sparkle" />{bi('Draft update with AI', 'AIతో అప్‌డేట్ రాయండి')}</button>
                  {status === 'ASSIGNED' && <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.post(`/grievances/${selected}/accept`, {}, token), bi('Accepted', 'ఆమోదించబడింది'))}><Icon name="check2" />{bi('Accept', 'ఆమోదించు')}</button>}
                  {['ASSIGNED', 'UNDER_ENQUIRY', 'ON_HOLD'].includes(status) && <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.post(`/grievances/${selected}/action`, { actionType: 'ENQUIRY', noteEn: note || 'Field enquiry conducted.' }, token), bi('Action recorded', 'చర్య నమోదు'))}><Icon name="check2" />{bi('Record action', 'చర్య నమోదు')}</button>}
                  {['UNDER_ENQUIRY', 'ASSIGNED', 'ACTION_TAKEN'].includes(status) && <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.post(`/grievances/${selected}/resolve`, { resolutionNote: note || 'Issue resolved.', evidenceIds: attachments.map((a) => a.id) }, token), bi('Resolved', 'పరిష్కరించబడింది'))}>{bi('Resolve', 'పరిష్కరించు')}</button>}
                  {['UNDER_ENQUIRY', 'ASSIGNED', 'ACTION_TAKEN'].includes(status) && <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.post(`/grievances/${selected}/hold`, { reason: 'Awaiting citizen info' }, token), bi('On hold', 'హోల్డ్‌లో'))}>{bi('Hold', 'హోల్డ్')}</button>}
                  {status === 'ON_HOLD' && <button className="btn btn-ghost" disabled={busy} onClick={() => act(() => api.post(`/grievances/${selected}/resume`, {}, token), bi('Resumed', 'తిరిగి ప్రారంభం'))}>{bi('Resume', 'తిరిగి ప్రారంభించు')}</button>}
                </div>
                {note && (
                  <div style={{ padding: '0 20px 18px' }}>
                    <textarea className="transcript" style={{ width: '100%', minHeight: 70, fontFamily: 'inherit' }} value={note} onChange={(e) => setNote(e.target.value)} />
                  </div>
                )}
              </>
            );
          })()}
        </div>

        {/* CO-PILOT (signature) */}
        <div className="side-ai">
          <div className="aibox">
            <div className="aibox-h">
              <div className="copilot-orb"><Icon name="sparkle" /></div>
              <div><div className="t">{bi('Saarthi co-pilot', 'సారథి కో-పైలట్')}</div><div className="s">{detail ? bi('Analysed this case', 'ఈ కేసును విశ్లేషించింది') : bi('Waiting for a case', 'కేసు కోసం వేచి ఉంది')}</div></div>
            </div>
            {detail ? <CoPilot detail={detail} services={services} token={token} selected={selected!} bi={bi} onLookup={(s) => act(() => api.post(`/grievances/${selected}/xroad`, { service: s }, token), bi('X-Road verified ✓', 'X-Road ధృవీకరించబడింది ✓'))} busy={busy} /> : (
              <div className="aiseg"><div className="ai-summary">{bi('Select a grievance and Saarthi will summarise it, propose routing & priority, retrieve the governing orders, and estimate breach risk.', 'ఫిర్యాదును ఎంచుకోండి; సారథి సారాంశం, రూటింగ్, ప్రాధాన్యత, నియమాలు, ప్రమాదాన్ని చూపుతుంది.')}</div></div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function CoPilot({ detail, services, selected, token, bi, onLookup, busy }: { detail: any; services: XroadService[]; token: string; selected: string; bi: (en: string, te: string) => string; onLookup: (service: string) => void; busy: boolean }) {
  const p = priority(detail as any);
  const [ai, setAi] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setAi(null); setAiBusy(true);
    api.post<any>(`/grievances/${selected}/ai-analysis`, {}, token)
      .then((a) => { if (alive) setAi(a); })
      .catch(() => {})
      .finally(() => { if (alive) setAiBusy(false); });
    return () => { alive = false; };
  }, [selected, token]);

  const conf = ai?.confidence ? Math.round(ai.confidence * 100) : detail.aiSuggested?.confidence ? Math.round(detail.aiSuggested.confidence * 100) : 92;
  const risk = isOverdue(detail) ? 92 : detail.slaBreachPredicted ? 74 : 28;
  const dash = `${risk} 100`;
  const prScore = ai?.priority ?? p.score;
  const deptName = ai?.department && ai.department !== 'Unclassified' ? ai.department : detail.department?.en ?? bi('Department', 'విభాగం');
  const orders: string[] = ai?.relevantOrders?.length ? ai.relevantOrders : [
    bi('AP Public Services Guarantee Act, 2017 — service SLA timelines', 'AP పబ్లిక్ సర్వీసెస్ గ్యారంటీ చట్టం, 2017'),
    bi('Citizen Charter — acknowledgement & redressal obligations', 'పౌర చార్టర్ — పరిష్కార బాధ్యతలు'),
  ];
  return (
    <div className="aibox">
      {/* AI root-cause analysis (real AI when ANTHROPIC_API_KEY is set) */}
      <div className="aiseg">
        <div className="lab"><Icon name="sparkle" />{bi('Root-cause analysis', 'మూల కారణ విశ్లేషణ')}
          {ai?.source && <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", color: ai.source === 'claude' ? '#E7C988' : '#8FA6D6' }}>{ai.source === 'claude' ? 'Claude' : 'heuristic'}</span>}
        </div>
        {aiBusy && <div className="ai-summary">{bi('Analysing the complaint…', 'ఫిర్యాదును విశ్లేషిస్తోంది…')}</div>}
        {ai && <div className="ai-summary" style={{ marginBottom: 8 }}>{ai.summary}</div>}
        {ai?.rootCauses?.map((rc: any, i: number) => (
          <div className="suggest" key={i} style={{ marginTop: 7 }}>
            <div className="ic"><Icon name="alert" /></div>
            <div className="tx"><strong>{rc.cause}</strong><span>{bi('likely cause', 'సంభావ్య కారణం')} · {rc.likelihood}</span></div>
          </div>
        ))}
      </div>
      {/* Suggested next actions */}
      {ai?.suggestedActions?.length > 0 && (
        <div className="aiseg">
          <div className="lab"><Icon name="check2" />{bi('Suggested next actions', 'సూచించిన చర్యలు')}</div>
          {ai.suggestedActions.map((s: string, i: number) => (
            <div className="lawitem" key={i}><Icon name="check2" /><span>{s}</span></div>
          ))}
        </div>
      )}
      <div className="aiseg">
        <div className="lab"><Icon name="route" />{bi('Routing & priority', 'రూటింగ్ & ప్రాధాన్యత')}</div>
        <div className="suggest"><div className="ic"><Icon name="route" /></div><div className="tx"><strong>{deptName}</strong><span>{bi('lowest competent officer · ', 'తక్కువ సమర్థ అధికారి · ')}{detail.mandal ?? ''}</span></div><span className="conf">{conf}%</span></div>
        <div style={{ height: 8 }} />
        <div className="suggest"><div className="ic"><Icon name="alert" /></div><div className="tx"><strong>{bi(`Priority ${prScore} / 100`, `ప్రాధాన్యత ${prScore} / 100`)}</strong><span>{bi('explainable score', 'వివరించదగిన స్కోర్')}</span></div></div>
      </div>
      <div className="aiseg">
        <div className="lab"><Icon name="scale" />{bi('Relevant orders & rules (RAG)', 'సంబంధిత ఉత్తర్వులు & నియమాలు (RAG)')}</div>
        {orders.map((o, i) => (<div className="lawitem" key={i}><Icon name="doc" /><span>{o}</span></div>))}
      </div>
      <div className="aiseg">
        <div className="lab"><Icon name="trend" />{bi('SLA breach risk', 'SLA ఉల్లంఘన ప్రమాదం')}</div>
        <div className="riskmeter">
          <svg className="risk-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3.4" /><circle cx="18" cy="18" r="15.9" fill="none" stroke="#E7C988" strokeWidth="3.4" strokeLinecap="round" strokeDasharray={dash} transform="rotate(-90 18 18)" /></svg>
          <div className="risk-info"><div className="n">{risk}%</div><div className="l">{risk >= 60 ? bi('likely to breach — act today', 'ఉల్లంఘన అవకాశం — ఈరోజే చర్య') : bi('on track', 'సరైన మార్గంలో')}</div></div>
        </div>
      </div>
      <div className="aiseg">
        <div className="lab"><Icon name="route" />{bi('Cross-dept verification · X-Road', 'క్రాస్-డిపార్ట్‌మెంట్ ధృవీకరణ · X-Road')}</div>
        <div className="ai-cta" style={{ margin: 0, padding: 0 }}>
          {services.slice(0, 4).map((s) => <button key={s.id} onClick={() => onLookup(s.id)} disabled={busy}>{s.label}</button>)}
        </div>
      </div>
    </div>
  );
}
