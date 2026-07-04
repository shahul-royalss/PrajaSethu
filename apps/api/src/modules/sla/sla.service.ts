import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { NotificationService } from '../notification/notification.service';
import { RoutingService } from '../routing/routing.service';
import { EMERGENCY_SLA_HOURS, LedgerEvent, MAX_LEVEL, Status } from '../../common/constants';

const TERMINAL = [Status.CLOSED, Status.MERGED, Status.REJECTED, Status.REROUTED];
const PREDICT_AT = 0.75; // flag a likely breach once 75% of the SLA window has elapsed

/**
 * SLA engine (Blueprint D.4, A.2, E.2). Three jobs:
 *  - set the SLA clock (emergency lane = ~24h),
 *  - PREDICT breaches before they happen (proactive nudge), and
 *  - AUTO-ESCALATE L→L+1 when the clock is missed.
 * A light interval sweep runs the prediction/escalation continuously so the demo
 * shows foresight, not just after-the-fact reaction.
 */
@Injectable()
export class SlaService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SlaService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationService,
    private readonly routing: RoutingService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.SLA_SWEEP_DISABLED === 'true') return;
    const intervalMs = Number(process.env.SLA_SWEEP_MS ?? 60_000);
    this.timer = setInterval(() => {
      this.sweep().catch((e) => this.logger.error(`SLA sweep failed: ${e.message}`));
    }, intervalMs);
    // Don't keep the event loop alive solely for the sweep.
    if (this.timer.unref) this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  computeDueAt(from: Date, slaHrs: number, emergency: boolean): Date {
    const hours = emergency ? EMERGENCY_SLA_HOURS : slaHrs;
    return new Date(from.getTime() + hours * 60 * 60 * 1000);
  }

  /** One pass: predict imminent breaches, escalate missed ones. Returns a summary. */
  async sweep(): Promise<{ predicted: number; escalated: number }> {
    const now = new Date();
    const active = await this.prisma.grievance.findMany({
      where: { status: { notIn: [...TERMINAL, Status.RESOLVED] }, slaDueAt: { not: null } },
    });

    let predicted = 0;
    let escalated = 0;
    for (const g of active) {
      const due = g.slaDueAt!;
      const created = g.registeredAt ?? g.createdAt;
      const total = due.getTime() - created.getTime();
      const elapsed = now.getTime() - created.getTime();

      if (now >= due) {
        if (g.currentLevel < MAX_LEVEL) {
          await this.escalate(g.id, 'SLA_BREACH');
          escalated++;
        } else if (!g.slaBreachPredicted) {
          // Already at the top of the ladder — flag the breach, can't escalate further.
          await this.markBreached(g.id);
        }
      } else if (total > 0 && elapsed / total >= PREDICT_AT && !g.slaBreachPredicted) {
        await this.prisma.grievance.update({ where: { id: g.id }, data: { slaBreachPredicted: true } });
        await this.ledger.append({
          grievanceId: g.id,
          eventType: LedgerEvent.SLA_PREDICTED_BREACH,
          actorRole: 'SYSTEM',
          payload: { ysr: g.ysr, dueAt: due.toISOString(), level: g.currentLevel },
        });
        await this.notifications.send({
          grievanceId: g.id,
          to: 'officer',
          template: 'SLA_NUDGE',
          body: `Grievance ${g.ysr} is likely to breach SLA by ${due.toDateString()}. Please act.`,
        });
        predicted++;
      }
    }
    if (predicted || escalated) this.logger.log(`SLA sweep: predicted=${predicted}, escalated=${escalated}`);
    return { predicted, escalated };
  }

  private async markBreached(grievanceId: string) {
    const g = await this.prisma.grievance.update({
      where: { id: grievanceId },
      data: { slaBreachPredicted: true },
    });
    await this.prisma.escalation.create({
      data: { grievanceId, level: g.currentLevel, breachedAt: new Date(), trigger: 'SLA_BREACH' },
    });
    await this.ledger.append({
      grievanceId,
      eventType: LedgerEvent.SLA_BREACHED,
      actorRole: 'SYSTEM',
      payload: { ysr: g.ysr, level: g.currentLevel, atTopOfLadder: true },
    });
  }

  /** Bump to the next level of the escalation ladder and reassign to a higher authority. */
  async escalate(grievanceId: string, trigger: 'SLA_BREACH' | 'REOPEN' | 'EMERGENCY' | 'MANUAL') {
    const g = await this.prisma.grievance.findUnique({ where: { id: grievanceId } });
    if (!g) return null;
    const nextLevel = Math.min(g.currentLevel + 1, MAX_LEVEL);

    const subject = g.subjectId ? await this.prisma.subject.findUnique({ where: { id: g.subjectId } }) : null;
    const slaHrs = subject?.defaultSlaHrs ?? 168;
    const newDue = this.computeDueAt(new Date(), Math.max(Math.floor(slaHrs / 2), EMERGENCY_SLA_HOURS), g.emergency);

    const pick = await this.routing.pickOfficer({
      deptId: g.deptId,
      level: nextLevel,
      mandal: g.mandal,
      secretariatCode: g.secretariatCode,
    });

    await this.prisma.escalation.create({
      data: {
        grievanceId,
        level: nextLevel,
        dueAt: newDue,
        breachedAt: trigger === 'SLA_BREACH' ? new Date() : null,
        escalatedTo: pick.officer?.id ?? null,
        trigger,
      },
    });

    if (pick.officer) {
      await this.prisma.assignment.create({
        data: {
          grievanceId,
          assigneeId: pick.officer.id,
          level: nextLevel,
          assignedBy: 'SYSTEM',
          reason: `Escalation (${trigger}): ${pick.reason}`,
        },
      });
    }

    const updated = await this.prisma.grievance.update({
      where: { id: grievanceId },
      data: {
        currentLevel: nextLevel,
        currentAssigneeId: pick.officer?.id ?? g.currentAssigneeId,
        status: Status.ASSIGNED,
        slaDueAt: newDue,
        slaBreachPredicted: false,
      },
    });

    if (trigger === 'SLA_BREACH') {
      await this.ledger.append({
        grievanceId,
        eventType: LedgerEvent.SLA_BREACHED,
        actorRole: 'SYSTEM',
        payload: { ysr: g.ysr, fromLevel: g.currentLevel, toLevel: nextLevel },
      });
    }
    await this.ledger.append({
      grievanceId,
      eventType: LedgerEvent.ESCALATED,
      actorRole: 'SYSTEM',
      payload: { ysr: g.ysr, trigger, fromLevel: g.currentLevel, toLevel: nextLevel, escalatedTo: pick.officer?.role ?? null },
    });
    await this.notifications.send({
      grievanceId,
      to: g.petitionerId,
      template: 'ESCALATED',
      body: `Your grievance ${g.ysr} has been escalated to a higher authority (Level ${nextLevel}).`,
    });

    return updated;
  }
}
