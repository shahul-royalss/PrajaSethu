import { Controller, Get } from '@nestjs/common';
import { Public } from './common/auth/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', service: 'praja-setu-api', time: new Date().toISOString() };
  }

  @Public()
  @Get()
  root() {
    return {
      name: 'Praja Setu — Pilot API',
      description: 'Next-generation Public Grievance Redressal System (pilot).',
      docs: 'See docs/PrajaSetu-Blueprint.md and README.md',
      health: '/health',
    };
  }
}
