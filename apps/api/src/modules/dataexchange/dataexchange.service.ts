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
  category: string;
  description: string;
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
  private readonly OWN_MEMBER = 'IN/GOV/SAARTHI';

  private readonly services: Record<string, ServiceDef> = {
    ration_status_by_token: {
      member: 'AP/GOV/CIVIL-SUPPLIES', deptId: 'CS', category: 'Civil Supplies',
      label: 'Ration card status',
      description: 'Verify a ration card is active and its last PDS distribution.',
      fact: () => ({ rationCard: 'ACTIVE', cardType: 'RICE_CARD', members: 4, lastDistribution: '2026-06-01' }),
    },
    pension_status: {
      member: 'AP/GOV/PENSIONS', deptId: 'PEN', category: 'Pensions',
      label: 'Pension status',
      description: 'Confirm pension scheme enrolment and last disbursement.',
      fact: () => ({ pension: 'ACTIVE', scheme: 'NTR_BHAROSA_PENSION', amount: 3000, lastPaid: '2026-06-01' }),
    },
    power_connection_status: {
      member: 'AP/GOV/APSPDCL', deptId: 'ENERGY', category: 'Energy',
      label: 'Power connection status',
      description: 'Service number status, last bill and reported outages.',
      fact: () => ({ connection: 'ACTIVE', serviceNo: 'KPM-114520', lastBilled: '2026-06-10', outageReported: true }),
    },
    land_record_status: {
      member: 'AP/GOV/REVENUE', deptId: 'REVENUE', category: 'Revenue / Land',
      label: 'Land record / mutation status',
      description: 'Webland survey number, ownership and mutation stage.',
      fact: () => ({ mutation: 'PENDING_FIELD_VERIFICATION', surveyNo: '123/4A', extentAcres: 1.5 }),
    },
    water_scheme_status: {
      member: 'AP/GOV/RWS', deptId: 'RWS', category: 'Rural Water',
      label: 'Rural water scheme status',
      description: 'Drinking-water scheme/source status and last servicing.',
      fact: () => ({ scheme: 'ACTIVE', source: 'BOREWELL', lastServiced: '2026-05-20' }),
    },
    aadhaar_demographic: {
      member: 'INDIA/UIDAI/EKYC', deptId: 'CS', category: 'Identity (UIDAI)',
      label: 'Aadhaar eKYC (name/age/address match)',
      description: 'Tokenised yes/no demographic match via UIDAI — no raw Aadhaar exchanged.',
      fact: () => ({ nameMatch: true, addressMatch: true, ageBand: '45-60', kycVerified: true }),
    },
    digilocker_documents: {
      member: 'INDIA/MEITY/DIGILOCKER', deptId: 'REVENUE', category: 'Documents (DigiLocker)',
      label: 'DigiLocker issued documents',
      description: 'List of citizen-issued verified documents (caste, income, RoR).',
      fact: () => ({ documents: ['INCOME_CERTIFICATE', 'CASTE_CERTIFICATE', 'ROR_1B'], verified: true }),
    },
    cctns_complaint_status: {
      member: 'AP/POLICE/CCTNS', deptId: 'VIG', category: 'Police (CCTNS)',
      label: 'CCTNS complaint / FIR status',
      description: 'Cross-check any linked police complaint (confidential).',
      fact: () => ({ firLinked: false, petitions: 0, status: 'NONE' }),
    },
    municipal_property_tax: {
      member: 'AP/GOV/MUNICIPAL', deptId: 'REVENUE', category: 'Municipal',
      label: 'Municipal property tax status',
      description: 'Property assessment number and dues.',
      fact: () => ({ assessmentNo: 'KPM-PT-88231', duesRupees: 0, status: 'PAID' }),
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly ledger: LedgerService,
  ) {}

  listServices() {
    return Object.entries(this.services).map(([id, s]) => ({
      id, member: s.member, deptId: s.deptId, label: s.label, category: s.category, description: s.description,
    }));
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
