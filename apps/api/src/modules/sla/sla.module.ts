import { Module } from '@nestjs/common';
import { SlaService } from './sla.service';
import { SlaController } from './sla.controller';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationModule } from '../notification/notification.module';
import { RoutingModule } from '../routing/routing.module';

@Module({
  imports: [LedgerModule, NotificationModule, RoutingModule],
  providers: [SlaService],
  controllers: [SlaController],
  exports: [SlaService],
})
export class SlaModule {}
