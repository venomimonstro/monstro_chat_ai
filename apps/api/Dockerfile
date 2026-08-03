# Debian slim: argon2 uses prebuilt binaries (no 15–30 min gcc build on Alpine).
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace=@ai-consultant/api --workspace=@ai-consultant/shared-types

FROM base AS builder
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build -w @ai-consultant/shared-types
RUN npm run db:generate -w @ai-consultant/api
RUN npm run build -w @ai-consultant/api
RUN cd apps/api && npx tsc prisma/seed.ts --outDir prisma/dist --module commonjs --target ES2022 --esModuleInterop --skipLibCheck

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -r nodejs \
  && useradd -r -g nodejs nestjs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
RUN rm -rf node_modules/@ai-consultant
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-types ./node_modules/@ai-consultant/shared-types

USER nestjs

EXPOSE 3000
CMD ["node", "dist/main.js"]
