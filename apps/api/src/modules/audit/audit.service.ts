import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { DashboardService } from '../dashboard/dashboard.service';
import { DataExchangeService } from '../dataexchange/dataexchange.service';

/**
 * Audit & anti-corruption console (Blueprint F.6, G.3, G.4).
 *  - ledger verification (DB-vs-ledger integrity, tamper alerts),
 *  - fraudulent-closure review (ML-style anomaly leads),
 *  - confidential corruption queue with complainant identity MASKED,
 *  - access transparency for every X-Road cross-department pull.
 */
@Injectable()
export class AuditService {
  // Departments/subjects whose complaints are confidential (identity masked).
  private readonly CONFIDENTIAL_DEPT = 'VIG';

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly dashboard: DashboardService,
    private readonly dataExchange: DataExchangeService,
  ) {}

  async ledgerStatus() {
    const verification = await this.ledger.verifyChain();
    const total = await this.prisma.auditEvent.count();
    const recent = await this.prisma.auditEvent.findMany({
      orderBy: { seq: 'desc' },
      take: 10,
      select: { seq: true, eventType: true, actorRole: true, grievanceId: true, ts: true, ledgerTxId: true },
    });
    return { verification, totalEvents: total, recent };
  }

  async fraudulentClosures() {
    const { fastClosures } = await this.dashboard.anomalies();
    return { count: fastClosures.length, items: fastClosures };
  }

  /** Confidential corruption/bribe queue — complainant identity is never revealed. */
  async corruptionQueue() {
    const items = await this.prisma.grievance.findMany({
      where: { deptId: this.CONFIDENTIAL_DEPT },
      orderBy: { createdAt: 'desc' },
      include: { department: true },
    });
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: items.map((g) => g.subjectId).filter(Boolean) as string[] } },
    });
    const subjName = new Map(subjects.map((s) => [s.id, s.nameEn]));
    return items.map((g) => ({
      ysr: g.ysr,
      // Identity intentionally masked — only an opaque complainant code is exposed.
      complainant: 'CONFIDENTIAL-' + g.id.slice(-6).toUpperCase(),
      subject: g.subjectId ? subjName.get(g.subjectId) ?? 'Corruption complaint' : 'Corruption complaint',
      status: g.status,
      mandal: g.mandal,
      createdAt: g.createdAt,
    }));
  }

  async accessTransparency() {
    const logs = await this.dataExchange.accessLog();
    return logs.map((l) => ({
      exchangeId: l.id,
      grievanceId: l.grievanceId,
      service: l.service,
      fromMember: l.fromMember,
      toMember: l.toMember,
      requestedBy: l.requestedBy,
      purpose: l.purpose,
      consentId: l.consentId,
      signature: l.signature.slice(0, 16) + '…',
      at: l.createdAt,
    }));
  }
}
