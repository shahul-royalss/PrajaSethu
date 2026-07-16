import { Module } from '@nestjs/common';
import { GrievancesService } from './grievances.service';
import { GrievancesController } from './grievances.controller';
import { OptionalAuthGuard } from '../../common/auth/optional-auth.guard';
import { IdentityModule } from '../identity/identity.module';
import { ClassificationModule } from '../classification/classification.module';
import { BhashiniModule } from '../bhashini/bhashini.module';
import { RoutingModule } from '../routing/routing.module';
import { SlaModule } from '../sla/sla.module';
import { LedgerModule } from '../ledger/ledger.module';
import { NotificationModule } from '../notification/notification.module';
import { LlmModule } from '../llm/llm.module';
import { DataExchangeModule } from '../dataexchange/dataexchange.module';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [
    IdentityModule,
    ClassificationModule,
    BhashiniModule,
    RoutingModule,
    SlaModule,
    LedgerModule,
    NotificationModule,
    LlmModule,
    DataExchangeModule,
    AttachmentsModule,
  ],
  providers: [GrievancesService, OptionalAuthGuard],
  controllers: [GrievancesController],
  exports: [GrievancesService],
})
export class GrievancesModule {}
