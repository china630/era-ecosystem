# syntax=docker/dockerfile:1
# ERA 365 Orchestrator — control plane (Nest API :4100 + Next web :3100).
# Build: docker build -f era-365-orchestrator/Dockerfile -t era-orchestrator ./era-365-orchestrator

FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/

COPY packages/database packages/database
COPY apps/api apps/api
COPY apps/web apps/web
COPY docker-entrypoint.sh docker-entrypoint.sh

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm ci
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache openssl wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 era

COPY --from=builder --chown=era:nodejs /app /app
RUN chmod +x /app/docker-entrypoint.sh

USER era

EXPOSE 3100 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4100/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["start"]
