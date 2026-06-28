import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { Public } from '../../common/auth/public.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { RequireRoles } from '../../common/auth/roles.decorator';
import { Roles } from '../../common/constants';

@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledger: LedgerService) {}

  // Citizen "verify integrity" — public, keyed by grievance id (no PII returned).
  @Public()
  @Get('verify/:grievanceId')
  verifyOne(@Param('grievanceId') grievanceId: string) {
    return this.ledger.verifyGrievance(grievanceId);
  }

  @Public()
  @Get('trail/:grievanceId')
  trail(@Param('grievanceId') grievanceId: string) {
    return this.ledger.grievanceTrail(grievanceId);
  }

  // Full-chain verification — auditor only.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(Roles.AUDITOR, Roles.COLLECTOR)
  @Get('verify')
  verifyAll() {
    return this.ledger.verifyChain();
  }
}
