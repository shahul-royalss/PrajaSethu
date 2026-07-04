import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    // IMPORTANT: never let a slow/failing DB connect crash app boot. If $connect
    // threw here, Nest would fail to finish bootstrapping, the HTTP server would
    // never bind, and the platform health check (/api/health) would 502 forever —
    // even though /health doesn't touch the DB. So connect best-effort and retry
    // in the background; the server comes up immediately and stays healthy.
    try {
      await this.$connect();
      this.logger.log('Connected to database');
    } catch (e) {
      this.logger.error(`DB connect failed at boot (continuing, will retry): ${(e as Error).message}`);
      this.retryConnect();
    }
  }

  private retryConnect(attempt = 1) {
    const delay = Math.min(2000 * attempt, 15000);
    setTimeout(async () => {
      try {
        await this.$connect();
        this.logger.log(`Connected to database (retry ${attempt})`);
      } catch {
        if (attempt < 40) this.retryConnect(attempt + 1);
      }
    }, delay);
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      /* no-op */
    }
  }
}
