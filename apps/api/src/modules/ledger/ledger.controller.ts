import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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

  // Per-case block explorer — public (a citizen may inspect their own case's
  // chain; ids are unguessable cuids and blocks carry no raw PII).
  @Public()
  @Get('chain/:grievanceId')
  chainForGrievance(@Param('grievanceId') grievanceId: string) {
    return this.ledger.chain({ grievanceId, limit: 100 });
  }

  // District-wide block explorer — staff.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(Roles.AUDITOR, Roles.COLLECTOR, Roles.SUPERVISOR, Roles.OFFICER, Roles.DA)
  @Get('chain')
  chain(@Query('limit') limit?: string, @Query('before') before?: string) {
    return this.ledger.chain({
      limit: limit ? Number(limit) : undefined,
      before: before ? Number(before) : undefined,
    });
  }

  // Full-chain verification — auditor only.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @RequireRoles(Roles.AUDITOR, Roles.COLLECTOR)
  @Get('verify')
  verifyAll() {
    return this.ledger.verifyChain();
  }
}
