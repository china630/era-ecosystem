# syntax=docker/dockerfile:1
# ERA Finance Core — data plane API only (:4000), internal Docker network.
# Public ERP UI: era-finance-core/Dockerfile.web → finance-web :3100 (finance-core.era-365.online).
# Build context MUST be umbrella root (sibling @era365/database):
#   docker build -f era-finance-core/Dockerfile -t era-finance-core .

FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /workspace

COPY packages/era-contracts packages/era-contracts
COPY packages/era-storage packages/era-storage
COPY packages/i18n-common packages/i18n-common
COPY packages/era-fiscal packages/era-fiscal
COPY packages/satellite-kit packages/satellite-kit
COPY era-orchestrator/packages/database ./era-orchestrator/packages/database

COPY era-finance-core/package.json era-finance-core/package-lock.json ./era-finance-core/
COPY era-finance-core/apps/api/package.json ./era-finance-core/apps/api/
COPY era-finance-core/apps/web/package.json ./era-finance-core/apps/web/
COPY era-finance-core/packages/database/package.json ./era-finance-core/packages/database/
COPY era-finance-core/packages/api-contracts/package.json ./era-finance-core/packages/api-contracts/
COPY era-finance-core/packages/i18n/package.json ./era-finance-core/packages/i18n/
COPY era-finance-core/packages/ui/package.json ./era-finance-core/packages/ui/

COPY era-finance-core/packages/database ./era-finance-core/packages/database
COPY era-finance-core/packages/api-contracts ./era-finance-core/packages/api-contracts
COPY era-finance-core/packages/i18n ./era-finance-core/packages/i18n
COPY era-finance-core/packages/ui ./era-finance-core/packages/ui
COPY era-finance-core/apps/api ./era-finance-core/apps/api
COPY era-finance-core/apps/web/lib/i18n/resources.ts ./era-finance-core/apps/web/lib/i18n/resources.ts

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

RUN cd /workspace/packages/i18n-common && npm install && npm run build \
  && cd /workspace/packages/era-contracts && npm install && npm run build \
  && cd /workspace/packages/era-storage && npm install && npm run build \
  && cd /workspace/packages/era-fiscal && npm install && npm run build \
  && cd /workspace/packages/satellite-kit && npm install && npm run build \
  && cd /workspace/era-orchestrator/packages/database && npm install --include=dev --ignore-scripts && npm run build

WORKDIR /workspace/era-finance-core

RUN npm ci
RUN npm run build -w @erafinance/api-contracts \
  && npm run build -w @erafinance/database \
  && npm run build -w @erafinance/api
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /workspace/era-finance-core /app
COPY era-finance-core/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && sed -i 's/\r$//' /app/docker-entrypoint.sh
COPY --from=builder --chown=nestjs:nodejs /workspace/packages/era-contracts /packages/era-contracts
COPY --from=builder --chown=nestjs:nodejs /workspace/packages/era-storage /packages/era-storage
COPY --from=builder --chown=nestjs:nodejs /workspace/packages/i18n-common /packages/i18n-common
COPY --from=builder --chown=nestjs:nodejs /workspace/packages/era-fiscal /packages/era-fiscal
COPY --from=builder --chown=nestjs:nodejs /workspace/packages/satellite-kit /packages/satellite-kit
COPY --from=builder --chown=nestjs:nodejs /workspace/era-orchestrator/packages/database /era-orchestrator/packages/database

# @era365/database ships a TS entry; Nest CJS runtime needs a concrete JS export path.
RUN printf '%s\n' \
    '"use strict";' \
    'const c=require("./generated/client");' \
    'const s=require("./runtime-cjs/core/pricing-module-seed");' \
    'const b=require("./runtime-cjs/core/pricing-bundle-seed");' \
    'const k=require("./runtime-cjs/core/pricing-module-keys");' \
    'module.exports=Object.assign({},c,s,b,k);' \
    > /era-orchestrator/packages/database/index.cjs \
  && node -e "\
const fs=require('fs');\
const pkgPath='/era-orchestrator/packages/database/package.json';\
const p=JSON.parse(fs.readFileSync(pkgPath,'utf8'));\
p.main='./index.cjs';\
p.type='commonjs';\
p.exports={\
  '.':{types:'./generated/client/index.d.ts',default:'./index.cjs'},\
  './generated/client':{types:'./generated/client/index.d.ts',default:'./generated/client/index.js'},\
};\
fs.writeFileSync(pkgPath,JSON.stringify(p,null,2));"

USER nestjs

EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4100/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
