import { Module } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { ConsentService } from './consent.service';

@Module({
  providers: [IdentityService, ConsentService],
  exports: [IdentityService, ConsentService],
})
export class IdentityModule {}
