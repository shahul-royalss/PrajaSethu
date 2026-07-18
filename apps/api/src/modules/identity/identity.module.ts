import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { ConsentService } from './consent.service';
import { IdentityController } from './identity.controller';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, ConsentService],
  exports: [IdentityService, ConsentService],
})
export class IdentityModule {}
