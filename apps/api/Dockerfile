FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
# argon2 compiles native bindings via node-gyp
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci --workspace=@ai-consultant/api --workspace=@ai-consultant/shared-types

FROM base AS builder
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npm run build -w @ai-consultant/shared-types
RUN npm run db:generate -w @ai-consultant/api
RUN npm run build -w @ai-consultant/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache wget && \
  addgroup -S nodejs && \
  adduser -S nestjs -G nodejs

COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
# Replace workspace symlink with built package files
RUN rm -rf node_modules/@ai-consultant
COPY --from=builder --chown=nestjs:nodejs /app/packages/shared-types ./node_modules/@ai-consultant/shared-types

USER nestjs

EXPOSE 3000
CMD ["node", "dist/main.js"]
