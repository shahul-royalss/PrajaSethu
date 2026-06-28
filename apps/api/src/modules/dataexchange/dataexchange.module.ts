import { Module } from '@nestjs/common';
import { DataExchangeService } from './dataexchange.service';
import { IdentityModule } from '../identity/identity.module';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [IdentityModule, LedgerModule],
  providers: [DataExchangeService],
  exports: [DataExchangeService],
})
export class DataExchangeModule {}
