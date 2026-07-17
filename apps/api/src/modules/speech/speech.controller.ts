import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Public } from '../../common/auth/public.decorator';
import { SpeechService } from './speech.service';

class TranscribeDto {
  @IsString()
  audioBase64!: string;

  @IsOptional()
  @IsString()
  mime?: string;

  /** Optional internal language code hint; omitted = detect from the audio. */
  @IsOptional()
  @IsString()
  languageHint?: string;
}

// Public on purpose: guests file voice complaints before any sign-in, and the
// transcript must work for them too. The payload guard lives in the service.
@Controller('speech')
export class SpeechController {
  constructor(private readonly speech: SpeechService) {}

  @Public()
  @Get('status')
  status() {
    return this.speech.status();
  }

  @Public()
  @Post('transcribe')
  transcribe(@Body() dto: TranscribeDto) {
    return this.speech.transcribe(dto.audioBase64, dto.mime, dto.languageHint);
  }
}
