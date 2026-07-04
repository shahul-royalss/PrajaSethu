import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { Roles } from '../../common/constants';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Get('supervisor')
  supervisor(@Query('mandal') mandal?: string, @Query('deptId') deptId?: string) {
    return this.dashboard.supervisor({ mandal, deptId });
  }

  @RequireRoles(Roles.COLLECTOR, Roles.SUPERVISOR, Roles.AUDITOR)
  @Get('command')
  command() {
    return this.dashboard.command();
  }

  @RequireRoles(Roles.SUPERVISOR, Roles.COLLECTOR, Roles.AUDITOR)
  @Get('hotspots')
  hotspots() {
    return this.dashboard.hotspots();
  }
}
