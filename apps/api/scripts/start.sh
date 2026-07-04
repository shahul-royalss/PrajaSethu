#!/bin/sh
# SAARTHI API container entrypoint (production / Render).
#
# Applies the Prisma schema to the managed Postgres (DATABASE_URL) and seeds the
# demo baseline ONLY when the database is empty (first deploy). After that, all
# citizen/officer data PERSISTS across every redeploy and cold start — because it
# lives in the external Postgres, not in the ephemeral container.
#
# Every step is best-effort so a transient hiccup never blocks the server from
# starting (the app itself also retries the DB connection in the background).

echo "[start] Applying database schema (prisma db push)…"
# No --accept-data-loss: a stable/additive schema applies cleanly; a destructive
# change fails loudly (in the deploy log) rather than silently dropping data.
npx prisma db push --skip-generate || echo "[start] db push failed — continuing (the app will retry; re-deploy if it persists)"

NEED_SEED="$(node scripts/needs-seed.js 2>/dev/null)"
if [ "$NEED_SEED" = "yes" ]; then
  echo "[start] Empty database — seeding demo baseline…"
  npm run db:seed || echo "[start] seed failed — continuing"
else
  echo "[start] Database already has data — skipping seed (existing records preserved)."
fi

echo "[start] Launching SAARTHI API…"
exec node dist/main.js
