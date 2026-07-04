# Praja Setu web — production image (Next.js 15)
# The browser calls the API same-origin at /api/*; Next rewrites that to the
# NestJS service at API_PROXY_TARGET (set at runtime). NEXT_PUBLIC_API_BASE is
# baked at build time and defaults to "/api" for the proxy model.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG NEXT_PUBLIC_API_BASE=/api
ENV NEXT_PUBLIC_API_BASE=${NEXT_PUBLIC_API_BASE}
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# Where to reach the API service (server-side proxy target). Override at deploy.
ENV API_PROXY_TARGET=http://api:4000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000
CMD ["npm", "run", "start"]
