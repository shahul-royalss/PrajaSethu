import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { DataExchangeModule } from '../dataexchange/dataexchange.module';

@Module({
  imports: [LedgerModule, DashboardModule, DataExchangeModule],
  providers: [AuditService],
  controllers: [AuditController],
})
export class AuditModule {}
