import { Body, Controller, Get, Post, Query } from '@nestjs/common';
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
  status(@Query('probe') probe?: string) {
    // ?probe=1 → one real (cached) Sarvam call, so "is my key working in
    // production?" is answerable from a browser tab.
    return this.speech.status(probe === '1' || probe === 'true');
  }

  @Public()
  @Post('transcribe')
  transcribe(@Body() dto: TranscribeDto) {
    return this.speech.transcribe(dto.audioBase64, dto.mime, dto.languageHint);
  }
}
