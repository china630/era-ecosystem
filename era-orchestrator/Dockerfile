# syntax=docker/dockerfile:1
# ERA Orchestrator — control plane (API :4000 + Web :3000). Build from repo root.
#   docker build -f era-orchestrator/Dockerfile -t era-orchestrator .

FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /workspace

COPY packages/i18n-common packages/i18n-common
COPY packages/era-contracts packages/era-contracts
COPY packages/era-storage packages/era-storage
COPY packages/era-fiscal packages/era-fiscal
COPY packages/satellite-kit packages/satellite-kit

RUN cd packages/i18n-common && npm install && npm run build \
  && cd ../era-contracts && npm install && npm run build \
  && cd ../era-storage && npm install && npm run build \
  && cd ../era-fiscal && npm install && npm run build \
  && cd ../satellite-kit && npm install && npm run build

COPY era-orchestrator era-orchestrator

WORKDIR /workspace/era-orchestrator

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1

# Baked into the Next.js client bundle — use public HTTPS hosts for GHCR/prod builds.
# Industry launcher deep-link URLs must also be baked here; runtime env is ignored for
# NEXT_PUBLIC_* client bundles. Local UAT overrides these via docker-compose build args.
ARG NEXT_PUBLIC_ORCH_API_URL=https://api.era-365.online
ARG NEXT_PUBLIC_FINANCE_WEB_URL=https://finance-core.era-365.online
ARG NEXT_PUBLIC_SATELLITE_HOTEL_URL=https://hotel-pms.era-365.online
ARG NEXT_PUBLIC_SATELLITE_FNB_POS_URL=https://fnb-pos.era-365.online
ARG NEXT_PUBLIC_SATELLITE_CLINIC_URL=https://clinic.era-365.online
ARG NEXT_PUBLIC_SATELLITE_RETAIL_URL=https://retail-pos.era-365.online
ENV NEXT_PUBLIC_ORCH_API_URL=${NEXT_PUBLIC_ORCH_API_URL}
ENV NEXT_PUBLIC_FINANCE_WEB_URL=${NEXT_PUBLIC_FINANCE_WEB_URL}
ENV NEXT_PUBLIC_SATELLITE_HOTEL_URL=${NEXT_PUBLIC_SATELLITE_HOTEL_URL}
ENV NEXT_PUBLIC_SATELLITE_FNB_POS_URL=${NEXT_PUBLIC_SATELLITE_FNB_POS_URL}
ENV NEXT_PUBLIC_SATELLITE_CLINIC_URL=${NEXT_PUBLIC_SATELLITE_CLINIC_URL}
ENV NEXT_PUBLIC_SATELLITE_RETAIL_URL=${NEXT_PUBLIC_SATELLITE_RETAIL_URL}

RUN npm ci
RUN npm run build
RUN mkdir -p apps/web/.next/standalone/apps/web/.next \
  && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 era

COPY --from=builder --chown=era:nodejs /workspace/era-orchestrator /app
COPY --from=builder --chown=era:nodejs /workspace/packages/era-contracts /packages/era-contracts
COPY --from=builder --chown=era:nodejs /workspace/packages/i18n-common /packages/i18n-common
COPY --from=builder --chown=era:nodejs /workspace/packages/era-storage /packages/era-storage
COPY --from=builder --chown=era:nodejs /workspace/packages/era-fiscal /packages/era-fiscal
COPY --from=builder --chown=era:nodejs /workspace/packages/satellite-kit /packages/satellite-kit
RUN printf '%s\n' \
    '"use strict";' \
    'const c=require("./generated/client");' \
    'const s=require("./runtime-cjs/core/pricing-module-seed");' \
    'const b=require("./runtime-cjs/core/pricing-bundle-seed");' \
    'const k=require("./runtime-cjs/core/pricing-module-keys");' \
    'const h=require("./runtime-cjs/core/hotel-module-keys");' \
    'module.exports=Object.assign({},c,s,b,k,h);' \
    > /app/packages/database/index.cjs \
  && node -e "\
const fs=require('fs');\
const pkgPath='/app/packages/database/package.json';\
const p=JSON.parse(fs.readFileSync(pkgPath,'utf8'));\
p.main='./index.cjs';\
p.type='commonjs';\
p.exports={\
  '.':{types:'./generated/client/index.d.ts',default:'./index.cjs'},\
  './generated/client':{types:'./generated/client/index.d.ts',default:'./generated/client/index.js'},\
};\
fs.writeFileSync(pkgPath,JSON.stringify(p,null,2));"
RUN chmod +x /app/docker-entrypoint.sh && sed -i 's/\r$//' /app/docker-entrypoint.sh

USER era

EXPOSE 3000 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["start"]
