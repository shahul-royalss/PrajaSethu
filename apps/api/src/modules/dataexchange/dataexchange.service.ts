import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsentService } from '../identity/consent.service';
import { LedgerService } from '../ledger/ledger.service';
import { canonicalJson, sha256 } from '../../common/util';
import { LedgerEvent } from '../../common/constants';

interface ServiceDef {
  member: string; // owning department's X-Road member
  deptId: string; // dept whose data is pulled (consent is checked against this)
  label: string;
  fact: (g: any) => Record<string, unknown>;
}

/**
 * X-Road inter-department data exchange, pilot implementation (Blueprint D.1).
 * Real deployment runs Security Servers with mTLS + a central trust service. The
 * load-bearing PROPERTIES are reproduced here: every exchange is purpose-bound,
 * CONSENT-GATED (DPDP), digitally signed, and logged on both ends + notarised to
 * the ledger for the access-transparency view. Facts are canned (no live dept
 * systems in the pilot); the request/response shape is the real contract.
 */
@Injectable()
export class DataExchangeService {
  private readonly OWN_MEMBER = 'AP/GOV/PRAJA-SETU';

  private readonly services: Record<string, ServiceDef> = {
    ration_status_by_token: {
      member: 'AP/GOV/CIVIL-SUPPLIES',
      deptId: 'CS',
      label: 'Ration card status',
      fact: () => ({ rationCard: 'ACTIVE', cardType: 'RICE_CARD', lastDistribution: '2026-06-01' }),
    },
    pension_status: {
      member: 'AP/GOV/PENSIONS',
      deptId: 'PEN',
      label: 'Pension status',
      fact: () => ({ pension: 'ACTIVE', scheme: 'YSR_PENSION_KANUKA', lastPaid: '2026-06-01' }),
    },
    power_connection_status: {
      member: 'AP/GOV/APSPDCL',
      deptId: 'ENERGY',
      label: 'Power connection status',
      fact: () => ({ connection: 'ACTIVE', lastBilled: '2026-06-10', outageReported: true }),
    },
    land_record_status: {
      member: 'AP/GOV/REVENUE',
      deptId: 'REVENUE',
      label: 'Land record / mutation status',
      fact: () => ({ mutation: 'PENDING_FIELD_VERIFICATION', surveyNo: '123/4A' }),
    },
    water_scheme_status: {
      member: 'AP/GOV/RWS',
      deptId: 'RWS',
      label: 'Rural water scheme status',
      fact: () => ({ scheme: 'ACTIVE', source: 'BOREWELL', lastServiced: '2026-05-20' }),
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly ledger: LedgerService,
  ) {}

  listServices() {
    return Object.entries(this.services).map(([id, s]) => ({ id, member: s.member, deptId: s.deptId, label: s.label }));
  }

  async lookup(input: { grievanceId: string; service: string; requestedByRole: string; requestedById: string }) {
    const def = this.services[input.service];
    if (!def) throw new NotFoundException(`Unknown X-Road service: ${input.service}`);

    const grievance = await this.prisma.grievance.findUnique({ where: { id: input.grievanceId } });
    if (!grievance) throw new NotFoundException('Grievance not found');

    // DPDP consent gate — no cross-department pull without active consent.
    const consent = await this.consent.hasConsentForDept(grievance.petitionerId, def.deptId);
    if (!consent.allowed) {
      throw new ForbiddenException(
        `No active citizen consent covering ${def.label}. Record consent before a cross-department lookup.`,
      );
    }

    const requestPayload = {
      service: input.service,
      grievanceId: input.grievanceId,
      // Reference the petitioner by token-style id only — no raw PII over the wire.
      subjectRef: grievance.petitionerId,
      requestedAt: new Date().toISOString(),
    };
    const responsePayload = def.fact(grievance);

    const requestHash = sha256(canonicalJson(requestPayload));
    const responseHash = sha256(canonicalJson(responsePayload));
    // Mock detached signature standing in for the X-Road message signature.
    const signature = sha256(`${this.OWN_MEMBER}|${def.member}|${requestHash}|${responseHash}`);

    const log = await this.prisma.dataExchangeLog.create({
      data: {
        grievanceId: input.grievanceId,
        consentId: consent.consentId ?? null,
        fromMember: this.OWN_MEMBER,
        toMember: def.member,
        service: input.service,
        requestHash,
        responseHash,
        signature,
        requestedBy: `${input.requestedByRole}:${input.requestedById}`,
        purpose: `grievance-resolution:${grievance.ysr}`,
      },
    });

    // Notarise the access for the audit/access-transparency view (no PII on-chain).
    await this.ledger.append({
      grievanceId: input.grievanceId,
      eventType: LedgerEvent.XROAD_LOOKUP,
      actorRole: input.requestedByRole,
      payload: { service: input.service, toMember: def.member, requestHash, responseHash, consentId: consent.consentId },
    });

    return {
      ok: true,
      service: input.service,
      label: def.label,
      member: def.member,
      fact: responsePayload,
      signed: true,
      signature: signature.slice(0, 24) + '…',
      logged: true,
      exchangeId: log.id,
    };
  }

  async accessLog(grievanceId?: string) {
    return this.prisma.dataExchangeLog.findMany({
      where: grievanceId ? { grievanceId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
