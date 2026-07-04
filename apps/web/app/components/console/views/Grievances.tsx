'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { ListGrievance } from '../../../lib/types';
import { Icon } from '../Icon';
import { useBi } from '../bi';
import { isOverdue, priority, slaTimer, statusPill } from '../data';

export function GrievancesView({ token }: { token: string }) {
  const bi = useBi();
  const [rows, setRows] = useState<ListGrievance[] | null>(null);
  const [q, setQ] = useState('');
  const [f, setF] = useState<'all' | 'open' | 'risk' | 'resolved'>('all');

  useEffect(() => {
    api.get<ListGrievance[]>('/grievances', token).then(setRows).catch(() => setRows([]));
  }, [token]);

  const filtered = useMemo(() => {
    let r = rows ?? [];
    if (f === 'open') r = r.filter((g) => !['RESOLVED', 'CLOSED', 'REJECTED'].includes(g.status));
    if (f === 'risk') r = r.filter((g) => g.slaBreachPredicted || isOverdue(g));
    if (f === 'resolved') r = r.filter((g) => ['RESOLVED', 'CLOSED'].includes(g.status));
    if (q) r = r.filter((g) => `${g.ysr} ${g.department ?? ''} ${g.mandal ?? ''}`.toLowerCase().includes(q.toLowerCase()));
    return r;
  }, [rows, f, q]);

  return (
    <section className="view active">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <div className="greet" style={{ fontSize: 21 }}>{bi('All Grievances', 'అన్ని ఫిర్యాదులు')}</div>
          <div className="subtle">{bi('District-wide register · every status change notarised on the ledger.', 'జిల్లా రిజిస్టర్ · ప్రతి మార్పు లెడ్జర్‌లో నోటరైజ్.')}</div>
        </div>
        <div className="head-pills">
          {([['all', bi('All', 'అన్నీ')], ['open', bi('Open', 'ఓపెన్')], ['risk', bi('SLA risk', 'SLA ప్రమాదం')], ['resolved', bi('Resolved', 'పరిష్కరించబడింది')]] as const).map(([k, lab]) => (
            <button key={k} className={`chip${f === k ? ' on' : ''}`} onClick={() => setF(k)}>{lab}</button>
          ))}
        </div>
      </div>

      <div className="card tablecard">
        <div className="panel-head" style={{ padding: '14px 18px' }}>
          <div className="search" style={{ margin: 0, maxWidth: 360 }}>
            <Icon name="search" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={bi('Search ID, department, mandal…', 'శోధించండి…')} />
          </div>
          <span className="hint">{filtered.length} {bi('records', 'రికార్డులు')}</span>
        </div>
        <table className="tbl">
          <thead><tr>
            <th>{bi('ID', 'ఐడీ')}</th><th>{bi('Department', 'విభాగం')}</th><th>{bi('Mandal', 'మండలం')}</th>
            <th>{bi('Priority', 'ప్రాధాన్యత')}</th><th>{bi('Status', 'స్థితి')}</th><th>SLA</th><th>{bi('Level', 'స్థాయి')}</th>
          </tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={7} style={{ color: 'var(--faint)' }}>{bi('Loading…', 'లోడ్ అవుతోంది…')}</td></tr>}
            {rows !== null && filtered.length === 0 && <tr><td colSpan={7} style={{ color: 'var(--faint)' }}>{bi('No grievances match.', 'ఏ ఫిర్యాదు సరిపోలలేదు.')}</td></tr>}
            {filtered.map((g) => {
              const ov = isOverdue(g); const p = priority(g); const st = statusPill(g.status, ov); const sl = slaTimer(g);
              return (
                <tr key={g.id}>
                  <td><span className="gid">{g.ysr}</span></td>
                  <td><span className="subj">{g.department ?? '—'}</span>{g.emergency && <span className="meta-sm" style={{ color: 'var(--bad)' }}>🚨 {bi('emergency', 'అత్యవసరం')}</span>}</td>
                  <td>{g.mandal ?? '—'}</td>
                  <td><span className={`prio pr-${p.level}`}>{bi(p.label.en, p.label.te)}</span></td>
                  <td><span className={`pill ${st.cls}`}>{bi(st.en, st.te)}</span></td>
                  <td><span className={`sla ${sl.tone}`}><Icon name={sl.icon} style={{ width: 13, height: 13 }} />{bi(sl.en, sl.te)}</span></td>
                  <td><span className="mono" style={{ fontSize: 12, color: 'var(--muted)' }}>L{g.currentLevel}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
