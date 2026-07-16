'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { Icon, IconName } from '../Icon';
import { useBi } from '../bi';

export function GovernanceView({ view, token }: { view: string; token: string }) {
  if (view === 'audit') return <Audit token={token} />;
  if (view === 'citizens') return <Citizens />;
  return <Admin />;
}

// ── Audit & Ledger (live) ────────────────────────────────────────────────────
function Audit({ token }: { token: string }) {
  const bi = useBi();
  const [ledger, setLedger] = useState<any>(null);
  const [access, setAccess] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<number | null>(null);

  useEffect(() => {
    api.get<any>('/audit/ledger-status', token).then(setLedger).catch(() => {});
    api.get<any[]>('/audit/access-transparency', token).then((r) => setAccess(Array.isArray(r) ? r : [])).catch(() => {});
    api.get<{ count: number }>('/audit/fraudulent-closures', token).then((r) => setAnomalies(r?.count ?? 0)).catch(() => setAnomalies(null));
  }, [token]);

  // /audit/ledger-status → { verification: { ok, checked, lastCheckedAt }, totalEvents, recent }
  const ok: boolean | null = ledger ? (ledger.verification?.ok ?? null) : null;
  const events = ledger?.totalEvents ?? ledger?.verification?.checked ?? '—';
  const okLabel = ok === null ? bi('Status unavailable', 'స్థితి అందుబాటులో లేదు') : ok ? bi('Chain intact', 'చైన్ చెక్కుచెదరలేదు') : bi('Chain broken — tamper detected', 'చైన్ విచ్ఛిన్నం — ట్యాంపర్');
  const okTone = ok === null ? 'gold' : ok ? 'ok' : 'bad';

  return (
    <section className="view active">
      <Head en="Audit & Ledger" te="ఆడిట్ & లెడ్జర్" subEn="Tamper-evident governance — the ledger stores hashes only, never complaint content." subTe="ట్యాంపర్-ఎవిడెంట్ పాలన — లెడ్జర్ హాష్‌లను మాత్రమే నిల్వ చేస్తుంది." />
      <div className="row-3">
        <div className="card"><div className="cardbody" style={{ paddingTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={`kpi-ic ic-${okTone}`} style={{ width: 44, height: 44 }}><Icon name="shield" /></div>
            <div><div className="display" style={{ fontSize: 22, fontWeight: 700 }}>{okLabel}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{bi(`${events} events verified`, `${events} ఈవెంట్‌లు ధృవీకరించబడ్డాయి`)}</div></div>
          </div>
          <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{bi('Each status change is notarised with a SHA-256 hash chained to the previous block — admissible as court evidence and impossible to tamper with retroactively.', 'ప్రతి మార్పు మునుపటి బ్లాక్‌కు చైన్ చేయబడిన SHA-256 హాష్‌తో నోటరైజ్ చేయబడుతుంది.')}</p>
        </div></div>
        <div className="card"><div className="cardbody" style={{ paddingTop: 18 }}>
          <div className="kpi-ic ic-gold" style={{ width: 44, height: 44 }}><Icon name="flag" /></div>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{anomalies ?? '—'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{bi('Anomaly leads (fast closures)', 'అసాధారణ లీడ్‌లు (వేగవంతమైన మూసివేతలు)')}</div>
        </div></div>
        <div className="card"><div className="cardbody" style={{ paddingTop: 18 }}>
          <div className="kpi-ic ic-navy" style={{ width: 44, height: 44 }}><Icon name="route" /></div>
          <div className="display" style={{ fontSize: 22, fontWeight: 700, marginTop: 10 }}>{access.length}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{bi('X-Road exchanges logged', 'X-Road మార్పిడులు లాగ్ చేయబడ్డాయి')}</div>
        </div></div>
      </div>

      {/* ── Block explorer — the chain itself, block by block ── */}
      <ChainExplorer token={token} />

      <div className="card tablecard" style={{ marginTop: 16 }}>
        <div className="panel-head" style={{ padding: '16px 18px' }}><h2>{bi('Access transparency · X-Road exchange log', 'యాక్సెస్ పారదర్శకత · X-Road లాగ్')}</h2><span className="hint">{bi('consent-gated · signed · logged', 'సమ్మతి · సంతకం · లాగ్')}</span></div>
        <table className="tbl">
          <thead><tr><th>{bi('Service', 'సేవ')}</th><th>{bi('From → To', 'నుండి → కు')}</th><th>{bi('Purpose', 'ప్రయోజనం')}</th><th>{bi('When', 'ఎప్పుడు')}</th></tr></thead>
          <tbody>
            {access.length === 0 && <tr><td colSpan={4} style={{ color: 'var(--faint)' }}>{bi('No cross-department exchanges yet.', 'క్రాస్-డిపార్ట్‌మెంట్ మార్పిడులు ఇంకా లేవు.')}</td></tr>}
            {access.slice(0, 12).map((x, i) => (
              <tr key={x.exchangeId ?? i}>
                <td><span className="gid">{x.service}</span></td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{x.fromMember} → {x.toMember}</td>
                <td style={{ fontSize: 12 }}>{x.purpose}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{x.at ? new Date(x.at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Block explorer — every governance action as a sealed, chained block ─────
interface ChainBlock {
  seq: number;
  eventType: string;
  actorRole: string;
  ysr: string | null;
  payload: unknown;
  payloadHash: string;
  prevHash: string;
  blockHash: string;
  ledgerTxId: string;
  ts: string;
  verified: boolean;
}

const EVENT_ICON: Record<string, string> = {
  GENESIS: '🌱', REGISTERED: '📥', AI_TRIAGED: '🤖', PENDING_VERIFICATION: '🧑‍⚖️', HUMAN_VERIFIED: '✅',
  CLASSIFIED: '🗂', ASSIGNED: '👮', REASSIGNED: '🔀', ACCEPTED: '🤝', UNDER_ENQUIRY: '🔎',
  ACTION_TAKEN: '🛠', RESOLVED: '✅', CITIZEN_CONFIRMED: '🙏', CLOSED: '🔒', REOPENED: '🔁',
  ESCALATED: '📈', SLA_BREACHED: '⏰', SLA_PREDICTED_BREACH: '⚠️', XROAD_LOOKUP: '🔗',
  DUPLICATE_MERGED: '🤝', UNMERGED: '↩️', PRIORITY_RAISED: '📢', DESK_REVIEW_STARTED: '⚖️',
  DESK_REVIEW_DECIDED: '🧾', VOICE_EVIDENCE_SEALED: '🎙', MERGED: '🤝', REJECTED: '⛔', ON_HOLD: '⏸', RESUMED: '▶️',
};

function ChainExplorer({ token }: { token: string }) {
  const bi = useBi();
  const [feed, setFeed] = useState<{ blocks: ChainBlock[]; total: number; head: { seq: number; blockHash: string } | null } | null>(null);
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    api.get<any>('/ledger/chain?limit=25', token).then(setFeed).catch(() => {});
  }, [token]);

  async function loadMore() {
    if (!feed || feed.blocks.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = feed.blocks[feed.blocks.length - 1].seq;
      const more = await api.get<any>(`/ledger/chain?limit=25&before=${oldest}`, token);
      setFeed((f) => (f ? { ...f, blocks: [...f.blocks, ...more.blocks] } : more));
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  }

  const short = (h: string, n = 14) => `${h.slice(0, n)}…`;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="panel-head" style={{ padding: '16px 18px' }}>
        <h2>⛓ {bi('Block explorer — hash-chained governance ledger', 'బ్లాక్ ఎక్స్‌ప్లోరర్ — హాష్-చైన్డ్ లెడ్జర్')}</h2>
        <span className="hint">
          {feed?.head
            ? bi(`head #${feed.head.seq} · ${feed.total} blocks · anchored`, `హెడ్ #${feed.head.seq} · ${feed.total} బ్లాక్‌లు`)
            : '…'}
        </span>
      </div>
      <div className="cardbody" style={{ paddingTop: 6 }}>
        {!feed && <div style={{ color: 'var(--faint)', fontSize: 13, padding: 12 }}>{bi('Loading chain…', 'చైన్ లోడ్ అవుతోంది…')}</div>}
        {feed?.blocks.map((b, i) => {
          const open = openSeq === b.seq;
          const nextInList = feed.blocks[i + 1]; // one seq lower — the block this one points to
          const linkOk = !nextInList || b.prevHash === nextInList.blockHash || b.seq - nextInList.seq !== 1;
          return (
            <div key={b.seq} style={{ position: 'relative', paddingLeft: 30 }}>
              {/* chain spine + link */}
              {i < feed.blocks.length - 1 && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute', left: 11, top: 30, bottom: -4, width: 2,
                    background: linkOk ? 'linear-gradient(180deg, rgba(45,91,215,.5), rgba(45,91,215,.12))' : 'var(--bad)',
                  }}
                />
              )}
              <span
                aria-hidden
                style={{
                  position: 'absolute', left: 2, top: 10, width: 20, height: 20, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: b.verified ? 'var(--navy-700, #143071)' : 'var(--bad)',
                  color: '#fff', fontSize: 10, fontWeight: 800,
                }}
              >
                {b.verified ? '✓' : '!'}
              </span>

              <button
                onClick={() => setOpenSeq(open ? null : b.seq)}
                style={{
                  width: '100%', textAlign: 'left', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
                  padding: '9px 10px', margin: '2px 0', borderRadius: 10, border: '1px solid var(--line)',
                  background: open ? 'var(--royal-soft, #E8EEFC)' : '#fff', cursor: 'pointer',
                }}
                aria-expanded={open}
              >
                <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: 'var(--royal)' }}>#{b.seq}</span>
                <span style={{ fontSize: 14 }} aria-hidden>{EVENT_ICON[b.eventType] ?? '▪️'}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{b.eventType.replace(/_/g, ' ')}</span>
                {b.ysr && <span className="gid" style={{ fontSize: 11 }}>{b.ysr}</span>}
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{b.actorRole}</span>
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint)' }}>{short(b.blockHash, 10)}</span>
                <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{new Date(b.ts).toLocaleTimeString()}</span>
              </button>

              {open && (
                <div style={{ margin: '2px 0 8px', border: '1px solid var(--line)', borderRadius: 10, padding: 12, background: '#0D2150', color: '#DCE6FA' }}>
                  <div style={{ display: 'grid', gap: 4, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, lineHeight: 1.6, overflowWrap: 'anywhere' }}>
                    <div><span style={{ color: '#8FA6D6' }}>block   </span>{b.blockHash}</div>
                    <div><span style={{ color: '#8FA6D6' }}>prev    </span>{b.prevHash}</div>
                    <div><span style={{ color: '#8FA6D6' }}>payload </span>{b.payloadHash}</div>
                    <div><span style={{ color: '#8FA6D6' }}>tx      </span>{b.ledgerTxId}</div>
                    <div><span style={{ color: '#8FA6D6' }}>time    </span>{new Date(b.ts).toISOString()}</div>
                    <div>
                      <span style={{ color: '#8FA6D6' }}>verify  </span>
                      <span style={{ color: b.verified ? '#7CE3B1' : '#FF9B9B', fontWeight: 700 }}>
                        {b.verified ? bi('recomputed hashes match — block intact', 'హాష్‌లు సరిపోలాయి — బ్లాక్ చెక్కుచెదరలేదు') : bi('HASH MISMATCH — tampered', 'హాష్ తేడా — ట్యాంపర్')}
                      </span>
                    </div>
                  </div>
                  <pre style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'rgba(255,255,255,.06)', fontSize: 11, lineHeight: 1.55, overflowX: 'auto' }}>
                    {JSON.stringify(b.payload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
        {feed && feed.blocks.length < feed.total && (
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '…' : bi(`Load older blocks (${feed.total - feed.blocks.length} more)`, `పాత బ్లాక్‌లు (${feed.total - feed.blocks.length})`)}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Citizens ─────────────────────────────────────────────────────────────────
function Citizens() {
  const bi = useBi();
  const channels: { icon: IconName; en: string; te: string; v: string }[] = [
    { icon: 'mic', en: 'Voice / IVR', te: 'వాయిస్ / IVR', v: '46%' },
    { icon: 'phone', en: 'Sachivalayam', te: 'సచివాలయం', v: '28%' },
    { icon: 'grid', en: 'Citizen app / web', te: 'యాప్ / వెబ్', v: '21%' },
    { icon: 'doc', en: 'WhatsApp / SMS', te: 'వాట్సాప్ / SMS', v: '5%' },
  ];
  return (
    <section className="view active">
      <Head en="Citizen Intelligence" te="పౌర ఇంటెలిజెన్స్" subEn="Who we serve — and how they reach us. Low-literacy citizens are first-class." subTe="మేము ఎవరికి సేవ చేస్తాము — తక్కువ అక్షరాస్యత పౌరులు ప్రథమ శ్రేణి." />
      <div className="grid kpis">
        <Stat icon="users" ic="navy" v="32,480" en="Citizens reached" te="చేరుకున్న పౌరులు" />
        <Stat icon="mic" ic="gold" v="61%" en="Filed by voice" te="వాయిస్ ద్వారా దాఖలు" />
        <Stat icon="scale" ic="ok" v="12" en="Languages served" te="భాషలు" />
        <Stat icon="shield" ic="bad" v="4,120" en="Vulnerable flagged & prioritised" te="బలహీనవర్గం ప్రాధాన్యత" />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="panel-head"><h2>{bi('How citizens reach Saarthi', 'పౌరులు సారథిని ఎలా చేరుకుంటారు')}</h2></div>
        <div className="cardbody">
          {channels.map((c) => (
            <div className="rankrow" key={c.en}><span className="nm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name={c.icon} style={{ width: 15, height: 15, color: 'var(--muted)' }} />{bi(c.en, c.te)}</span><span className="track"><i style={{ width: c.v }} /></span><span className="vn">{c.v}</span></div>
          ))}
        </div>
      </div>
      <div className="footnote"><Icon name="sparkle" /><div>{bi('Assisted last mile: most citizens are reached through the Grama/Ward Sachivalayam, IVR and kiosks — not only the app.', 'సహాయక చివరి మైలు: చాలా మంది పౌరులు గ్రామ సచివాలయం, IVR, కియోస్క్‌ల ద్వారా చేరుకుంటారు.')}</div></div>
    </section>
  );
}

// ── Administration ───────────────────────────────────────────────────────────
function Admin() {
  const bi = useBi();
  const ladder = [
    { lv: 'L1', en: 'Field office', te: 'క్షేత్ర కార్యాలయం', who: 'VRO · Panchayat Secretary · AE · WEA' },
    { lv: 'L2', en: 'Mandal', te: 'మండలం', who: 'Tahsildar · MPDO · Deputy Engineer' },
    { lv: 'L3', en: 'Division / District cell', te: 'డివిజన్ / జిల్లా సెల్', who: 'RDO · Executive Engineer · Vigilance' },
    { lv: 'L4', en: 'District / State', te: 'జిల్లా / రాష్ట్రం', who: 'Joint Collector · Collector · CMO cell' },
  ];
  return (
    <section className="view active">
      <Head en="Administration" te="అడ్మినిస్ట్రేషన్" subEn="Roles, hierarchy and configuration. RBAC + ABAC, MFA, consent management and audit logging." subTe="పాత్రలు, శ్రేణి & కాన్ఫిగరేషన్." />
      <div className="card">
        <div className="panel-head"><h2>{bi('Government hierarchy & escalation ladder', 'ప్రభుత్వ శ్రేణి & ఎస్కలేషన్ నిచ్చెన')}</h2></div>
        <div className="cardbody"><div className="row-3" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 0 }}>
          {ladder.map((l) => (
            <div key={l.lv} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontWeight: 700, color: 'var(--royal)', fontSize: 12 }}>{l.lv}</div>
              <div style={{ fontWeight: 600, marginTop: 4 }}>{bi(l.en, l.te)}</div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4 }}>{l.who}</div>
            </div>
          ))}
        </div></div>
      </div>
      <div className="footnote"><Icon name="cog" /><div>{bi('SLA-breaching grievances escalate automatically up this ladder; every escalation is notarised on the tamper-evident ledger. Zero-trust security: RBAC + ABAC, MFA, consent management, data anonymisation for analytics.', 'SLA దాటిన ఫిర్యాదులు ఈ నిచ్చెనపై స్వయంచాలకంగా ఎస్కలేట్ అవుతాయి; ప్రతి దశ లెడ్జర్‌లో నోటరైజ్.')}</div></div>
    </section>
  );
}

function Head({ en, te, subEn, subTe }: { en: string; te: string; subEn: string; subTe: string }) {
  const bi = useBi();
  return (
    <div className="page-head" style={{ marginBottom: 16 }}>
      <div><div className="greet" style={{ fontSize: 21 }}>{bi(en, te)}</div><div className="subtle">{bi(subEn, subTe)}</div></div>
    </div>
  );
}

function Stat({ icon, ic, v, en, te }: { icon: IconName; ic: string; v: string; en: string; te: string }) {
  const bi = useBi();
  return (
    <div className="card kpi">
      <div className="kpi-top"><div className={`kpi-ic ic-${ic}`}><Icon name={icon} /></div></div>
      <div className="kpi-val">{v}</div>
      <div className="kpi-lab">{bi(en, te)}</div>
    </div>
  );
}
