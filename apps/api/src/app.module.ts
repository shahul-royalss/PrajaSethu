import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';

import { AuthModule } from './modules/auth/auth.module';
import { IdentityModule } from './modules/identity/identity.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { BhashiniModule } from './modules/bhashini/bhashini.module';
import { ClassificationModule } from './modules/classification/classification.module';
import { DataExchangeModule } from './modules/dataexchange/dataexchange.module';
import { LlmModule } from './modules/llm/llm.module';
import { RoutingModule } from './modules/routing/routing.module';
import { SlaModule } from './modules/sla/sla.module';
import { NotificationModule } from './modules/notification/notification.module';
import { GrievancesModule } from './modules/grievances/grievances.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { SpeechModule } from './modules/speech/speech.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReferenceModule } from './modules/reference/reference.module';

@Module({
  imports: [
    // .env.local (gitignored) overrides .env (committed defaults) — API keys
    // and other real secrets belong ONLY in .env.local or the host's env vars.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'praja-setu-pilot-dev-secret-change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '12h' },
    }),
    PrismaModule,
    AuthModule,
    IdentityModule,
    LedgerModule,
    BhashiniModule,
    ClassificationModule,
    DataExchangeModule,
    LlmModule,
    RoutingModule,
    SlaModule,
    NotificationModule,
    GrievancesModule,
    AttachmentsModule,
    SpeechModule,
    DashboardModule,
    AuditModule,
    ReferenceModule,
  ],
  controllers: [AppController],
  providers: [
    // Global validation (whitelist strips unknown props; transform applies types).
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
    },
    // Global auth: JWT first (attaches user / honours @Public), then RBAC.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
