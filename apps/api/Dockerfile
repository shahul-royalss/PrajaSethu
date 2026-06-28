# Praja Setu API — production image (NestJS + Prisma + SQLite)
# Debian bookworm-slim has OpenSSL 3.x, matching the Prisma binaryTarget
# "debian-openssl-3.0.x". Builds on any host with normal internet (Render,
# Railway, your machine) — Prisma downloads its engines during `npm ci`.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate \
 && npx prisma db push --skip-generate \
 && npm run db:seed \
 && npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
# SQLite path is resolved relative to the schema dir (apps/api/prisma), so this
# points at the seeded db baked below. Mount a volume at /app/prisma for persistence.
ENV DATABASE_URL="file:./dev.db"
ENV PORT=4000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 4000
CMD ["node", "dist/main.js"]
