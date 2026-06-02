# ERA Data Hub API — build from umbrella root:
#   docker build -f era-data-hub/Dockerfile -t era-data-hub .

FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /workspace

COPY era-finance-core/packages/database/package.json ./era-finance-core/packages/database/
COPY era-finance-core/packages/database/prisma ./era-finance-core/packages/database/prisma
COPY era-finance-core/packages/database/index.js ./era-finance-core/packages/database/
COPY era-finance-core/packages/database/index.d.ts ./era-finance-core/packages/database/

COPY era-data-hub/package.json era-data-hub/package-lock.json* ./era-data-hub/
COPY era-data-hub/apps/api/package.json ./era-data-hub/apps/api/
COPY era-data-hub/packages/database/package.json ./era-data-hub/packages/database/

COPY era-data-hub/packages/database ./era-data-hub/packages/database
COPY era-data-hub/apps/api ./era-data-hub/apps/api

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

WORKDIR /workspace/era-data-hub
RUN npm install 2>/dev/null || true
WORKDIR /workspace/era-finance-core/packages/database
RUN npm install --include=dev 2>/dev/null || npm install
RUN npx prisma generate 2>/dev/null || true

WORKDIR /workspace/era-data-hub
RUN npm install && npm run build -w @era/data-hub-database && npm run build -w @era/data-hub-api

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /workspace/era-data-hub /app
ENV DATA_HUB_FINANCE_CATALOG_ROOT=/app/packages/database/catalog

USER nestjs

EXPOSE 4200

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4200/healthz || exit 1

CMD ["node", "apps/api/dist/main.js"]
