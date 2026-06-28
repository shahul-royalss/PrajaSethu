import { Controller, Get } from '@nestjs/common';
import { AuditService } from './audit.service';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { Roles } from '../../common/constants';

// Restricted console (Blueprint F.6) — auditor role, with collector visibility on integrity.
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @RequireRoles(Roles.AUDITOR, Roles.COLLECTOR)
  @Get('ledger-status')
  ledgerStatus() {
    return this.audit.ledgerStatus();
  }

  @RequireRoles(Roles.AUDITOR, Roles.COLLECTOR)
  @Get('fraudulent-closures')
  fraudulentClosures() {
    return this.audit.fraudulentClosures();
  }

  @RequireRoles(Roles.AUDITOR)
  @Get('corruption-queue')
  corruptionQueue() {
    return this.audit.corruptionQueue();
  }

  @RequireRoles(Roles.AUDITOR, Roles.COLLECTOR)
  @Get('access-transparency')
  accessTransparency() {
    return this.audit.accessTransparency();
  }
}
