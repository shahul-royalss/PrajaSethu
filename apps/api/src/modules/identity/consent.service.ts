import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseJson } from '../../common/util';

/**
 * Consent broker (Blueprint E.1, D.1 guardrails, G.2).
 * A ConsentRecord makes the assisted path lawful (a DA filing for a citizen) AND
 * gates every X-Road cross-department lookup. No active consent → no cross-dept pull.
 */
@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async grant(input: {
    petitionerId: string;
    purpose: string;
    scope: string[]; // dept ids allowed for data pulls
    grantedBy: 'SELF' | 'DA';
    daId?: string | null;
    expiresInDays?: number;
  }) {
    const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 180) * 24 * 60 * 60 * 1000);
    return this.prisma.consentRecord.create({
      data: {
        petitionerId: input.petitionerId,
        purpose: input.purpose,
        scope: JSON.stringify(input.scope ?? []),
        grantedBy: input.grantedBy,
        daId: input.daId ?? null,
        expiresAt,
      },
    });
  }

  /** Is there an active (non-revoked, non-expired) consent covering this dept? */
  async hasConsentForDept(petitionerId: string, deptId: string): Promise<{ allowed: boolean; consentId?: string }> {
    const now = new Date();
    const records = await this.prisma.consentRecord.findMany({
      where: { petitionerId, revokedAt: null },
    });
    for (const r of records) {
      if (r.expiresAt && r.expiresAt < now) continue;
      const scope = parseJson<string[]>(r.scope, []);
      if (scope.length === 0 || scope.includes(deptId)) {
        return { allowed: true, consentId: r.id };
      }
    }
    return { allowed: false };
  }

  async revoke(id: string) {
    return this.prisma.consentRecord.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async listForPetitioner(petitionerId: string) {
    return this.prisma.consentRecord.findMany({ where: { petitionerId }, orderBy: { grantedAt: 'desc' } });
  }
}
