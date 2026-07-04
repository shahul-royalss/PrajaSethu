import { TimelineEvent } from '../lib/types';
import { fmtDate } from '../lib/i18n';

const EVENT_LABEL: Record<string, string> = {
  GENESIS: 'Ledger genesis',
  REGISTERED: 'Registered (SMS sent)',
  CLASSIFIED: 'Categorised',
  ASSIGNED: 'Assigned to officer',
  REASSIGNED: 'Reassigned',
  ACCEPTED: 'Officer accepted',
  UNDER_ENQUIRY: 'Field enquiry started',
  ACTION_TAKEN: 'Action taken',
  ON_HOLD: 'Put on hold',
  RESUMED: 'Resumed',
  RESOLVED: 'Resolved',
  CITIZEN_CONFIRMED: 'You confirmed',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  ESCALATED: 'Escalated to higher authority',
  SLA_BREACHED: 'SLA breached',
  SLA_PREDICTED_BREACH: 'SLA breach predicted',
  XROAD_LOOKUP: 'Verified via X-Road',
  REROUTED: 'Rerouted',
  MERGED: 'Merged with duplicate',
  REJECTED: 'Rejected',
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <div className="text-sm text-slate-400">No events yet.</div>;
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {events.map((e, i) => (
        <li key={i} className="mb-4 ml-4">
          <span className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border border-white bg-brand" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-sm font-medium text-slate-800">{EVENT_LABEL[e.event] ?? e.event}</span>
            <span className="text-xs text-slate-400">{fmtDate(e.at)}</span>
          </div>
          <div className="text-xs text-slate-500">
            by {e.role} · <span className="font-mono text-[10px] text-slate-400">{e.txId.slice(0, 28)}…</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
