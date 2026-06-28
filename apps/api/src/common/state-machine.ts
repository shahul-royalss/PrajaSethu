import { Status, StatusType } from './constants';

// Allowed transitions for the grievance lifecycle (Blueprint Part E.2).
// Any transition not listed here is rejected by CaseManagement — this is the
// guardrail that makes "no silent closure" and "reopen always escalates" enforceable.
export const TRANSITIONS: Record<string, StatusType[]> = {
  [Status.DRAFT]: [Status.REGISTERED, Status.REJECTED],
  [Status.REGISTERED]: [Status.CLASSIFIED, Status.REROUTED, Status.MERGED, Status.REJECTED],
  [Status.CLASSIFIED]: [Status.ASSIGNED, Status.REROUTED, Status.MERGED, Status.REJECTED],
  [Status.ASSIGNED]: [Status.UNDER_ENQUIRY, Status.ASSIGNED, Status.ON_HOLD, Status.REJECTED],
  [Status.UNDER_ENQUIRY]: [Status.ACTION_TAKEN, Status.ASSIGNED, Status.ON_HOLD],
  [Status.ACTION_TAKEN]: [Status.RESOLVED, Status.UNDER_ENQUIRY, Status.ON_HOLD],
  [Status.RESOLVED]: [Status.CLOSED, Status.REOPENED],
  [Status.ON_HOLD]: [Status.UNDER_ENQUIRY, Status.ASSIGNED, Status.ACTION_TAKEN],
  [Status.REOPENED]: [Status.ASSIGNED],
  [Status.CLOSED]: [Status.REOPENED], // finance/non-finance reopen allowed post-closure
  [Status.REROUTED]: [],
  [Status.MERGED]: [],
  [Status.REJECTED]: [Status.REGISTERED], // appeal path
};

export function canTransition(from: string, to: StatusType): boolean {
  const allowed = TRANSITIONS[from];
  return !!allowed && allowed.includes(to);
}

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Illegal lifecycle transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}
