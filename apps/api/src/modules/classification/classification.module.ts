import { Module } from '@nestjs/common';
import { ClassificationService } from './classification.service';
import { ClassificationController } from './classification.controller';

@Module({
  providers: [ClassificationService],
  controllers: [ClassificationController],
  exports: [ClassificationService],
})
export class ClassificationModule {}
