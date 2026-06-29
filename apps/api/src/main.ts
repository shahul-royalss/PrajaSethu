import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  // Citizens attach photos/PDFs as base64 JSON — the default 100 kb body limit is
  // far too small, so raise it (the per-file cap is still enforced in the service).
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));

  // CORS for the web app (comma-separated origins; '*' allowed for the pilot demo).
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`SAARTHI API listening on http://localhost:${port}/api`);
}

bootstrap();
