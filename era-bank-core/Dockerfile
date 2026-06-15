# ERA Bank Core API — build from umbrella root:
#   docker build -f era-bank-core/Dockerfile -t era-bank-core .

FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++ openssl

WORKDIR /workspace

COPY packages/era-contracts/package.json ./packages/era-contracts/
COPY packages/era-contracts/src ./packages/era-contracts/src
COPY packages/era-contracts/tsconfig.json ./packages/era-contracts/

COPY era-bank-core/package.json era-bank-core/package-lock.json* ./era-bank-core/
COPY era-bank-core/apps/api/package.json ./era-bank-core/apps/api/
COPY era-bank-core/packages/database/package.json ./era-bank-core/packages/database/

COPY era-bank-core/packages/database ./era-bank-core/packages/database
COPY era-bank-core/apps/api ./era-bank-core/apps/api

ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"

WORKDIR /workspace/packages/era-contracts
RUN npm install --include=dev && npm run build

WORKDIR /workspace/era-bank-core
RUN npm install && npm run build -w @era/bank-core-database && npm run build -w @era/bank-core-api

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /workspace/era-bank-core /app
COPY --from=builder --chown=nestjs:nodejs /workspace/packages/era-contracts /app/node_modules/@era/contracts

COPY era-bank-core/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && sed -i 's/\r$//' /app/docker-entrypoint.sh

USER nestjs

EXPOSE 4300

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4300/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/main.js"]
