import { Body, Controller, Get, HttpException, HttpStatus, Post, Query, Req } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import type { Request } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { SpeechService } from './speech.service';

// Dependency-free per-IP limiter for the public STT proxy: without it, anyone
// could loop this endpoint against the paid Sarvam key. A rolling minute window
// of 30 requests comfortably covers real dictation (segments arrive every few
// seconds) while shutting down scripted abuse.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function rateLimit(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(ip, list);
    throw new HttpException('Too many transcription requests — please slow down.', HttpStatus.TOO_MANY_REQUESTS);
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) {
    // Housekeeping so the map cannot grow without bound.
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  }
}

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
  transcribe(@Body() dto: TranscribeDto, @Req() req: Request) {
    rateLimit(req.ip ?? req.socket?.remoteAddress ?? 'unknown');
    return this.speech.transcribe(dto.audioBase64, dto.mime, dto.languageHint);
  }
}
