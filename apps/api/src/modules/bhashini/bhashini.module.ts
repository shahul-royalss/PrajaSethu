import { Module } from '@nestjs/common';
import { BhashiniService } from './bhashini.service';

@Module({
  providers: [BhashiniService],
  exports: [BhashiniService],
})
export class BhashiniModule {}
