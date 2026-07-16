import { Status, StatusType } from './constants';

// Allowed transitions for the grievance lifecycle (Blueprint Part E.2).
// Any transition not listed here is rejected by CaseManagement — this is the
// guardrail that makes "no silent closure" and "reopen always escalates" enforceable.
export const TRANSITIONS: Record<string, StatusType[]> = {
  [Status.DRAFT]: [Status.REGISTERED, Status.REJECTED],
  [Status.REGISTERED]: [Status.PENDING_VERIFICATION, Status.CLASSIFIED, Status.REROUTED, Status.MERGED, Status.REJECTED],
  // Below the 95% AI gate → a District Grievance Officer confirms the department.
  [Status.PENDING_VERIFICATION]: [Status.CLASSIFIED, Status.REROUTED, Status.MERGED, Status.REJECTED],
  [Status.CLASSIFIED]: [Status.ASSIGNED, Status.REROUTED, Status.MERGED, Status.REJECTED],
  [Status.ASSIGNED]: [Status.UNDER_ENQUIRY, Status.ASSIGNED, Status.ON_HOLD, Status.REJECTED],
  [Status.UNDER_ENQUIRY]: [Status.ACTION_TAKEN, Status.ASSIGNED, Status.ON_HOLD],
  [Status.ACTION_TAKEN]: [Status.RESOLVED, Status.UNDER_ENQUIRY, Status.ON_HOLD],
  [Status.RESOLVED]: [Status.CLOSED, Status.QUICK_DESK_REVIEW, Status.REOPENED],
  [Status.ON_HOLD]: [Status.UNDER_ENQUIRY, Status.ASSIGNED, Status.ACTION_TAKEN],
  // A citizen reopen request goes to a higher officer's desk FIRST; the officer
  // either approves the reopen (escalates) or upholds the closure with a reason.
  [Status.QUICK_DESK_REVIEW]: [Status.REOPENED, Status.RESOLVED, Status.CLOSED],
  [Status.REOPENED]: [Status.ASSIGNED],
  [Status.CLOSED]: [Status.QUICK_DESK_REVIEW, Status.REOPENED], // post-closure reopen allowed
  [Status.REROUTED]: [],
  [Status.MERGED]: [Status.REGISTERED], // unmerge escape hatch → re-enters the pipeline
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
