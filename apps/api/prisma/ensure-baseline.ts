// Runs on every container start (scripts/start.sh) — upserts the department/
// subject/officer baseline into whatever database exists, so new departments
// reach an already-seeded production database without a reseed.
import { PrismaClient } from '@prisma/client';
import { ensureBaseline } from './baseline';

const prisma = new PrismaClient();

ensureBaseline(prisma, (m) => console.log(`[baseline] ${m}`))
  .catch((e) => {
    console.error('[baseline] failed (continuing — app still boots):', e.message);
  })
  .finally(() => prisma.$disconnect());
