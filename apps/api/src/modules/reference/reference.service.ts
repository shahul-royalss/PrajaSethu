import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DataExchangeService } from '../dataexchange/dataexchange.service';
import { parseJson } from '../../common/util';
import { AP_DISTRICTS, AP_DISTRICTS_MANDALS, VILLAGES_BY_MANDAL } from './ap-geography';

@Injectable()
export class ReferenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataExchange: DataExchangeService,
  ) {}

  async departments() {
    const depts = await this.prisma.department.findMany({ orderBy: { nameEn: 'asc' } });
    return depts.map((d) => ({ id: d.id, en: d.nameEn, te: d.nameTe }));
  }

  async subjects(deptId?: string) {
    const subjects = await this.prisma.subject.findMany({
      where: { parentId: null, ...(deptId ? { deptId } : {}) },
      orderBy: { nameEn: 'asc' },
    });
    return subjects.map((s) => ({
      id: s.id,
      deptId: s.deptId,
      en: s.nameEn,
      te: s.nameTe,
      category: s.categoryHint,
      defaultSlaHrs: s.defaultSlaHrs,
      keywords: parseJson<string[]>(s.keywords, []),
    }));
  }

  async officers(deptId?: string) {
    const officers = await this.prisma.officer.findMany({
      where: { active: true, ...(deptId ? { deptId } : {}) },
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
    return officers.map((o) => ({
      id: o.id,
      name: o.name,
      role: o.role,
      deptId: o.deptId,
      level: o.level,
      jurisdiction: parseJson<{ mandal?: string; secretariatCodes?: string[] }>(o.jurisdiction, {}),
    }));
  }

  xroadServices() {
    return this.dataExchange.listServices();
  }

  // Full Andhra Pradesh geography (26 districts + mandals) for the form's location
  // pickers. Village/ward is free text in the form.
  geography() {
    return {
      districts: AP_DISTRICTS,
      mandalsByDistrict: AP_DISTRICTS_MANDALS,
      villagesByMandal: VILLAGES_BY_MANDAL,
    };
  }
}
