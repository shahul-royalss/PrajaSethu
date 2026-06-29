// Prints "yes" if the database has no officers (i.e. it's empty and should be
// seeded), else "no". Used by scripts/start.sh to seed only on the first deploy,
// so citizen/officer data persists across all later redeploys.
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.officer
  .count()
  .then((n) => process.stdout.write(n > 0 ? 'no' : 'yes'))
  .catch(() => process.stdout.write('yes'))
  .finally(() => p.$disconnect());
