// Praja Setu — domain constants. SQLite has no native enums, so the allowed
// values live here and are enforced in code (DTO validators + the state machine).

export const Roles = {
  DA: 'DA', // Digital Assistant / Volunteer (Sachivalayam operator)
  OFFICER: 'OFFICER', // Redressal officer
  SUPERVISOR: 'SUPERVISOR', // Mandal/District grievance cell
  COLLECTOR: 'COLLECTOR', // Collector / State command centre
  AUDITOR: 'AUDITOR', // Audit & anti-corruption console
} as const;
export type Role = (typeof Roles)[keyof typeof Roles];

export const Channels = {
  SACHIVALAYAM_ASSISTED: 'SACHIVALAYAM_ASSISTED',
  CITIZEN_APP: 'CITIZEN_APP',
  WEB: 'WEB',
  IVR: 'IVR',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  CALL_1902: 'CALL_1902',
} as const;
export type Channel = (typeof Channels)[keyof typeof Channels];

export const Category = {
  FINANCE: 'FINANCE',
  NON_FINANCE: 'NON_FINANCE',
} as const;
export type CategoryType = (typeof Category)[keyof typeof Category];

// Grievance lifecycle states (Blueprint Part E.2)
export const Status = {
  DRAFT: 'DRAFT',
  REGISTERED: 'REGISTERED',
  CLASSIFIED: 'CLASSIFIED',
  ASSIGNED: 'ASSIGNED',
  UNDER_ENQUIRY: 'UNDER_ENQUIRY',
  ACTION_TAKEN: 'ACTION_TAKEN',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
  ON_HOLD: 'ON_HOLD',
  REROUTED: 'REROUTED', // wrong type → service request / RTI desk
  MERGED: 'MERGED', // duplicate → linked to parent
  REJECTED: 'REJECTED', // invalid, with reason (appealable)
} as const;
export type StatusType = (typeof Status)[keyof typeof Status];

// Escalation ladder (statutory spirit — Blueprint A.2)
export const Levels: Record<number, string> = {
  1: 'L1 — Local office / Nodal Officer',
  2: 'L2 — District grievance cell / Public Grievance Officer',
  3: 'L3 — State grievance authority / Head of Dept',
  4: 'L4 — Chief Minister grievance cell (CMO)',
};
export const MAX_LEVEL = 4;

// Audit/ledger event types notarised to the hash-chain (Blueprint G.4)
export const LedgerEvent = {
  GENESIS: 'GENESIS',
  REGISTERED: 'REGISTERED',
  CLASSIFIED: 'CLASSIFIED',
  ASSIGNED: 'ASSIGNED',
  REASSIGNED: 'REASSIGNED',
  ACCEPTED: 'ACCEPTED',
  UNDER_ENQUIRY: 'UNDER_ENQUIRY',
  ACTION_TAKEN: 'ACTION_TAKEN',
  ON_HOLD: 'ON_HOLD',
  RESUMED: 'RESUMED',
  RESOLVED: 'RESOLVED',
  CITIZEN_CONFIRMED: 'CITIZEN_CONFIRMED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
  ESCALATED: 'ESCALATED',
  SLA_BREACHED: 'SLA_BREACHED',
  SLA_PREDICTED_BREACH: 'SLA_PREDICTED_BREACH',
  REROUTED: 'REROUTED',
  MERGED: 'MERGED',
  REJECTED: 'REJECTED',
  XROAD_LOOKUP: 'XROAD_LOOKUP',
} as const;
export type LedgerEventType = (typeof LedgerEvent)[keyof typeof LedgerEvent];

export const EMERGENCY_SLA_HOURS = 24; // ~24h emergency lane (Blueprint A.2)
