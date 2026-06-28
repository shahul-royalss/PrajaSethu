import { Body, Controller, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ClassificationService } from './classification.service';
import { Public } from '../../common/auth/public.decorator';

class ClassifyDto {
  @IsString()
  @IsNotEmpty()
  text!: string;
}

// Preview endpoint powering the operator console's "AI suggests" panel before submit.
@Controller('classification')
export class ClassificationController {
  constructor(private readonly classification: ClassificationService) {}

  @Public()
  @Post('preview')
  async preview(@Body() dto: ClassifyDto) {
    const [classification, distress, duplicate] = await Promise.all([
      this.classification.classify(dto.text),
      Promise.resolve(this.classification.detectDistress(dto.text)),
      this.classification.findDuplicate(dto.text),
    ]);
    return { classification, distress, duplicate };
  }
}
