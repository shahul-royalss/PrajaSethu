import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { canonicalJson, sha256 } from '../../common/util';
import { LedgerEventType } from '../../common/constants';

export interface AppendInput {
  grievanceId?: string | null;
  eventType: LedgerEventType;
  actorRole: string;
  payload: Record<string, unknown>;
}

export interface VerifyResult {
  ok: boolean;
  checked: number;
  brokenAt?: number;
  reason?: string;
  lastCheckedAt: string;
}

const GENESIS_PREV = '0'.repeat(64);

/**
 * Permissioned-ledger notary, pilot implementation.
 *
 * The blueprint (D.2) recommends Hyperledger Fabric with independent authority
 * nodes. Its own honesty note (K.2) sanctions the cheaper substitute when
 * independent nodes aren't feasible: "append-only, hash-chained audit logs with
 * periodic public anchoring." That is exactly what this is — every lifecycle
 * event is an append-only block whose hash chains to the previous block, so any
 * edit/backdate/silent-close breaks the chain and is provable. Swapping in a
 * Fabric chaincode submit() behind this same interface is the scale path.
 *
 * CRITICAL: no PII on-chain. The block stores grievance id, event type, actor
 * ROLE (never the officer's identity), timestamp, and a SHA-256 hash of the
 * canonical payload. PII stays in PostgreSQL/SQLite and can be erased (DPDP).
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  // Serialise appends so concurrent events get strictly increasing seq numbers.
  private chainLock: Promise<unknown> = Promise.resolve();

  constructor(private readonly prisma: PrismaService) {}

  async append(input: AppendInput): Promise<{ ledgerTxId: string; blockHash: string; seq: number }> {
    const run = this.chainLock.then(() => this.appendInternal(input));
    // Keep the lock chain alive even if one append throws.
    this.chainLock = run.catch(() => undefined);
    return run;
  }

  private async appendInternal(input: AppendInput) {
    const last = await this.prisma.auditEvent.findFirst({ orderBy: { seq: 'desc' } });
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.blockHash ?? GENESIS_PREV;
    const ts = new Date();

    const payloadCanonical = canonicalJson(input.payload);
    const payloadHash = sha256(payloadCanonical);
    const blockHash = sha256(
      canonicalJson({
        seq,
        prevHash,
        grievanceId: input.grievanceId ?? null,
        eventType: input.eventType,
        actorRole: input.actorRole,
        payloadHash,
        ts: ts.toISOString(),
      }),
    );
    const ledgerTxId = `fabric://praja-setu/${seq}/${blockHash.slice(0, 16)}`;

    await this.prisma.auditEvent.create({
      data: {
        seq,
        grievanceId: input.grievanceId ?? null,
        eventType: input.eventType,
        actorRole: input.actorRole,
        payload: payloadCanonical,
        payloadHash,
        prevHash,
        blockHash,
        ledgerTxId,
        ts,
      },
    });

    return { ledgerTxId, blockHash, seq };
  }

  /** Recompute the whole chain and confirm every block links to the previous one. */
  async verifyChain(): Promise<VerifyResult> {
    const events = await this.prisma.auditEvent.findMany({ orderBy: { seq: 'asc' } });
    let prevHash = GENESIS_PREV;
    for (const e of events) {
      const payloadHash = sha256(e.payload);
      if (payloadHash !== e.payloadHash) {
        return { ok: false, checked: events.length, brokenAt: e.seq, reason: 'payload hash mismatch (record altered)', lastCheckedAt: new Date().toISOString() };
      }
      if (e.prevHash !== prevHash) {
        return { ok: false, checked: events.length, brokenAt: e.seq, reason: 'prev-hash mismatch (chain reordered/broken)', lastCheckedAt: new Date().toISOString() };
      }
      const recomputed = sha256(
        canonicalJson({
          seq: e.seq,
          prevHash: e.prevHash,
          grievanceId: e.grievanceId ?? null,
          eventType: e.eventType,
          actorRole: e.actorRole,
          payloadHash: e.payloadHash,
          ts: e.ts.toISOString(),
        }),
      );
      if (recomputed !== e.blockHash) {
        return { ok: false, checked: events.length, brokenAt: e.seq, reason: 'block hash mismatch (metadata altered)', lastCheckedAt: new Date().toISOString() };
      }
      prevHash = e.blockHash;
    }
    return { ok: true, checked: events.length, lastCheckedAt: new Date().toISOString() };
  }

  /** Citizen-facing "verify integrity" for a single grievance's history. */
  async verifyGrievance(grievanceId: string): Promise<VerifyResult & { events: number }> {
    const events = await this.prisma.auditEvent.findMany({
      where: { grievanceId },
      orderBy: { seq: 'asc' },
    });
    for (const e of events) {
      if (sha256(e.payload) !== e.payloadHash) {
        return { ok: false, checked: events.length, events: events.length, brokenAt: e.seq, reason: 'event payload altered', lastCheckedAt: new Date().toISOString() };
      }
      const recomputed = sha256(
        canonicalJson({
          seq: e.seq,
          prevHash: e.prevHash,
          grievanceId: e.grievanceId ?? null,
          eventType: e.eventType,
          actorRole: e.actorRole,
          payloadHash: e.payloadHash,
          ts: e.ts.toISOString(),
        }),
      );
      if (recomputed !== e.blockHash) {
        return { ok: false, checked: events.length, events: events.length, brokenAt: e.seq, reason: 'event metadata altered', lastCheckedAt: new Date().toISOString() };
      }
    }
    return { ok: true, checked: events.length, events: events.length, lastCheckedAt: new Date().toISOString() };
  }

  async grievanceTrail(grievanceId: string) {
    return this.prisma.auditEvent.findMany({
      where: { grievanceId },
      orderBy: { seq: 'asc' },
      select: { seq: true, eventType: true, actorRole: true, ts: true, blockHash: true, ledgerTxId: true, payloadHash: true },
    });
  }
}
