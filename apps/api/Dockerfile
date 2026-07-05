# SAARTHI API — production image (NestJS + Prisma + PostgreSQL)
# Debian bookworm-slim has OpenSSL 3.x, matching the Prisma binaryTarget
# "debian-openssl-3.0.x". Builds on any host with normal internet (Render,
# Railway, your machine) — Prisma downloads its engines during `npm ci`.
#
# Data lives in an external managed Postgres (DATABASE_URL), so it persists across
# every redeploy/cold start. The schema is applied and the demo baseline is seeded
# at container start (scripts/start.sh), only when the DB is empty.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
# Generate the Prisma client + compile. DB schema apply + seed happen at RUNTIME
# (against the managed Postgres), not at build — the build never touches the DB.
RUN npx prisma generate && npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=4000
# DATABASE_URL is provided at runtime (Render env) — a managed Postgres connection
# string, e.g. postgresql://USER:PASS@HOST/DB?sslmode=require

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
# The seed (prisma/seed.ts) runs via ts-node at container start and imports the
# application services from src/, so the runtime image needs the sources and the
# compiler config too — without them seeding fails and the demo logins never exist.
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 4000
CMD ["sh", "scripts/start.sh"]
