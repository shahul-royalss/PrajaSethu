import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Status } from '../../common/constants';

const TERMINAL_OPEN_EXCLUDE = [Status.CLOSED, Status.MERGED, Status.REJECTED, Status.REROUTED];

/**
 * Analytics for the supervisor cell + Collector command centre + audit console
 * (Blueprint F.4, F.5, D.4). Aggregates are computed in-memory from the ops DB —
 * fine at pilot volume; the scale path is a warehouse + materialised views (Part J).
 */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async supervisor(filter: { mandal?: string; deptId?: string }) {
    const now = new Date();
    const where: any = {};
    if (filter.mandal) where.mandal = filter.mandal;
    if (filter.deptId) where.deptId = filter.deptId;

    const grievances = await this.prisma.grievance.findMany({
      where,
      include: { department: true, reopens: true, feedback: true },
    });

    const open = grievances.filter((g) => !TERMINAL_OPEN_EXCLUDE.includes(g.status as any));
    const overdue = open.filter((g) => g.slaDueAt && g.slaDueAt < now && g.status !== Status.RESOLVED);
    const reopened = grievances.filter((g) => g.reopens.length > 0 || g.status === Status.REOPENED);

    const resolvedOrClosed = grievances.filter((g) => g.resolvedAt);
    const avgResolveDays =
      resolvedOrClosed.length === 0
        ? 0
        : Number(
            (
              resolvedOrClosed.reduce(
                (sum, g) => sum + (g.resolvedAt!.getTime() - g.createdAt.getTime()) / (1000 * 60 * 60 * 24),
                0,
              ) / resolvedOrClosed.length
            ).toFixed(1),
          );

    const ratings = grievances.flatMap((g) => g.feedback.map((f) => f.rating));
    const satisfaction = ratings.length === 0 ? null : Math.round((ratings.filter((r) => r >= 4).length / ratings.length) * 100);

    const slaTracked = grievances.filter((g) => g.slaDueAt && g.resolvedAt);
    const slaWithin = slaTracked.filter((g) => g.resolvedAt! <= g.slaDueAt!);
    const slaCompliance = slaTracked.length === 0 ? null : Math.round((slaWithin.length / slaTracked.length) * 100);

    const escalationsPending = open.filter((g) => g.currentLevel > 1).length;

    const byDeptMap = new Map<string, number>();
    for (const g of open) {
      const k = g.department?.nameEn ?? 'Unclassified';
      byDeptMap.set(k, (byDeptMap.get(k) ?? 0) + 1);
    }
    const byDept = [...byDeptMap.entries()].map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count);

    const officerLoad = await this.officerLoad(filter.deptId);
    const anomalies = await this.anomalies();

    return {
      open: open.length,
      overdue: overdue.length,
      reopened: reopened.length,
      avgResolveDays,
      satisfaction,
      slaCompliance,
      escalationsPending,
      byDept,
      officerLoad,
      anomalies,
    };
  }

  async command() {
    const now = new Date();
    const grievances = await this.prisma.grievance.findMany({ include: { department: true } });
    const open = grievances.filter((g) => !TERMINAL_OPEN_EXCLUDE.includes(g.status as any));

    // Heatmap by mandal.
    const heatMap = new Map<string, { total: number; overdue: number; emergency: number }>();
    for (const g of open) {
      const m = g.mandal ?? 'Unknown';
      const cur = heatMap.get(m) ?? { total: 0, overdue: 0, emergency: 0 };
      cur.total++;
      if (g.slaDueAt && g.slaDueAt < now) cur.overdue++;
      if (g.emergency) cur.emergency++;
      heatMap.set(m, cur);
    }
    const heatmap = [...heatMap.entries()].map(([mandal, v]) => ({ mandal, ...v })).sort((a, b) => b.total - a.total);

    const hotspots = await this.hotspots();

    // Department trends (last 7 days vs previous 7).
    const week = 7 * 24 * 60 * 60 * 1000;
    const trendMap = new Map<string, { last: number; prev: number }>();
    for (const g of grievances) {
      const dept = g.department?.nameEn ?? 'Unclassified';
      const age = now.getTime() - g.createdAt.getTime();
      const cur = trendMap.get(dept) ?? { last: 0, prev: 0 };
      if (age <= week) cur.last++;
      else if (age <= 2 * week) cur.prev++;
      trendMap.set(dept, cur);
    }
    const trends = [...trendMap.entries()]
      .map(([dept, v]) => ({ dept, last7: v.last, prev7: v.prev, deltaPct: v.prev === 0 ? null : Math.round(((v.last - v.prev) / v.prev) * 100) }))
      .sort((a, b) => b.last7 - a.last7);

    const slaAtRisk = open.filter((g) => g.slaBreachPredicted).length;

    // Top systemic issues (subject clusters).
    const subjectMap = new Map<string, number>();
    for (const g of open) {
      if (!g.subjectId) continue;
      subjectMap.set(g.subjectId, (subjectMap.get(g.subjectId) ?? 0) + 1);
    }
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: [...subjectMap.keys()] } } });
    const subjName = new Map(subjects.map((s) => [s.id, s.nameEn]));
    const topSystemic = [...subjectMap.entries()]
      .map(([id, count]) => ({ subject: subjName.get(id) ?? id, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const spandanaMondayReadiness = open.length;

    return { heatmap, hotspots, trends, slaAtRisk, topSystemic, spandanaMondayReadiness, totalOpen: open.length };
  }

  /** Cluster open grievances by (mandal, subject); surface clusters at/above threshold. */
  async hotspots(threshold = 3) {
    const open = await this.prisma.grievance.findMany({
      where: { status: { notIn: TERMINAL_OPEN_EXCLUDE as any }, subjectId: { not: null } },
      include: { department: true },
    });
    const clusters = new Map<string, { mandal: string; subjectId: string; dept: string | null; count: number }>();
    for (const g of open) {
      const key = `${g.mandal ?? 'Unknown'}::${g.subjectId}`;
      const cur = clusters.get(key) ?? { mandal: g.mandal ?? 'Unknown', subjectId: g.subjectId!, dept: g.department?.nameEn ?? null, count: 0 };
      cur.count++;
      clusters.set(key, cur);
    }
    const flagged = [...clusters.values()].filter((c) => c.count >= threshold);
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: flagged.map((c) => c.subjectId) } } });
    const subjName = new Map(subjects.map((s) => [s.id, s.nameEn]));
    return flagged
      .map((c) => ({ mandal: c.mandal, subject: subjName.get(c.subjectId) ?? c.subjectId, dept: c.dept, count: c.count }))
      .sort((a, b) => b.count - a.count);
  }

  /** Anomaly leads for humans (Blueprint D.4 / G.6): suspiciously fast closures. */
  async anomalies() {
    const fastClosures = await this.findFastClosures();
    return { fastClosures };
  }

  private async findFastClosures(thresholdMinutes = 5) {
    const grievances = await this.prisma.grievance.findMany({
      where: { resolvedAt: { not: null } },
      include: { assignments: { orderBy: { assignedAt: 'asc' } }, workLogs: true },
    });
    const flags: { ysr: string; grievanceId: string; minutes: number; evidence: number; reason: string }[] = [];
    for (const g of grievances) {
      const firstAssign = g.assignments[0]?.assignedAt ?? g.createdAt;
      const minutes = (g.resolvedAt!.getTime() - firstAssign.getTime()) / (1000 * 60);
      const evidence = g.workLogs.reduce((n, w) => n + (w.evidenceIds && w.evidenceIds !== '[]' ? 1 : 0), 0);
      if (minutes >= 0 && minutes < thresholdMinutes) {
        flags.push({
          ysr: g.ysr,
          grievanceId: g.id,
          minutes: Number(minutes.toFixed(1)),
          evidence,
          reason: `Resolved ${minutes.toFixed(1)} min after assignment${evidence === 0 ? ', no evidence attached' : ''}.`,
        });
      }
    }
    return flags.sort((a, b) => a.minutes - b.minutes);
  }

  private async officerLoad(deptId?: string) {
    const officers = await this.prisma.officer.findMany({
      where: { role: { in: ['OFFICER', 'SUPERVISOR'] }, ...(deptId ? { deptId } : {}) },
    });
    const now = new Date();
    const rows = await Promise.all(
      officers.map(async (o) => {
        const open = await this.prisma.grievance.findMany({
          where: { currentAssigneeId: o.id, status: { notIn: TERMINAL_OPEN_EXCLUDE as any } },
          select: { slaDueAt: true, status: true },
        });
        const overdue = open.filter((g) => g.slaDueAt && g.slaDueAt < now && g.status !== Status.RESOLVED).length;
        return { officer: o.name, role: o.role, load: open.length, overdue };
      }),
    );
    return rows.filter((r) => r.load > 0).sort((a, b) => b.load - a.load);
  }
}
