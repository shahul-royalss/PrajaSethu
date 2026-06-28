import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseJson } from '../../common/util';
import { MAX_LEVEL } from '../../common/constants';

export interface RoutingPick {
  officer: { id: string; name: string; role: string; level: number; deptId: string | null } | null;
  reason: string;
  level: number;
}

/**
 * Smart routing (Blueprint D.4). Pilot rule: assign to the LOWEST competent officer
 * for the subject's department + geographic jurisdiction, breaking ties by current
 * open load (a light stand-in for the learned router that comes once pilot data
 * accrues). Every pick returns an EXPLAINABLE reason — routing is never a black box.
 */
@Injectable()
export class RoutingService {
  constructor(private readonly prisma: PrismaService) {}

  async pickOfficer(input: {
    deptId: string | null;
    level: number;
    mandal?: string | null;
    secretariatCode?: string | null;
  }): Promise<RoutingPick> {
    const level = Math.min(Math.max(input.level, 1), MAX_LEVEL);

    if (!input.deptId) {
      return { officer: null, level, reason: 'No department resolved yet — needs classification before assignment.' };
    }

    // Candidate officers: same dept, competent at >= requested level, active.
    const candidates = await this.prisma.officer.findMany({
      where: { deptId: input.deptId, active: true, level: { gte: level }, role: { in: ['OFFICER', 'SUPERVISOR', 'COLLECTOR'] } },
      orderBy: { level: 'asc' },
    });

    // Prefer officers whose jurisdiction covers the grievance mandal.
    const inJurisdiction = candidates.filter((o) => {
      const j = parseJson<{ mandal?: string; secretariatCodes?: string[] }>(o.jurisdiction, {});
      if (!input.mandal) return true;
      if (!j.mandal) return true; // no mandal scope = district-wide
      return j.mandal === input.mandal;
    });
    const pool = inJurisdiction.length > 0 ? inJurisdiction : candidates;
    if (pool.length === 0) {
      return { officer: null, level, reason: `No competent officer found in department for level ${level}.` };
    }

    // Lowest competent level present in the pool.
    const lowestLevel = pool[0].level;
    const lowest = pool.filter((o) => o.level === lowestLevel);

    // Tie-break by current open load.
    const withLoad = await Promise.all(
      lowest.map(async (o) => ({
        o,
        load: await this.prisma.grievance.count({
          where: { currentAssigneeId: o.id, status: { notIn: ['CLOSED', 'MERGED', 'REJECTED', 'REROUTED', 'RESOLVED'] } },
        }),
      })),
    );
    withLoad.sort((a, b) => a.load - b.load);
    const chosen = withLoad[0].o;

    return {
      officer: { id: chosen.id, name: chosen.name, role: chosen.role, level: chosen.level, deptId: chosen.deptId },
      level: chosen.level,
      reason: `Assigned to ${chosen.name} (${chosen.role}, L${chosen.level}) — lowest competent officer for department in ${input.mandal ?? 'jurisdiction'}, current load ${withLoad[0].load}.`,
    };
  }
}
