import { Module } from '@nestjs/common';
import { ReferenceService } from './reference.service';
import { ReferenceController } from './reference.controller';
import { DataExchangeModule } from '../dataexchange/dataexchange.module';

@Module({
  imports: [DataExchangeModule],
  providers: [ReferenceService],
  controllers: [ReferenceController],
})
export class ReferenceModule {}
