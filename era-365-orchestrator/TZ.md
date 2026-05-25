# ERA 365 Orchestrator — TZ

PRD: [PRD.md](./PRD.md) · DELIVERY: [doc/DELIVERY-ORCHESTRATOR.md](./doc/DELIVERY-ORCHESTRATOR.md)

## Stack

NestJS API :4100 · Prisma · shared PostgreSQL with Finance (migration phase)

## Auth API

| Method | Path | Notes |
|--------|------|-------|
| POST | `/auth/login` | Returns `accessToken`, `refreshToken`, `claims` |
| POST | `/auth/token/refresh` | Body `{ refreshToken }` |
| POST | `/auth/sso/exchange` | HMAC SSO for satellites |
| POST | `/auth/switch-organization` | Bearer + `{ organizationId }` |
| GET | `/memberships` | Bearer — list org memberships |

## JWT (HS256)

Issuer `era-365-orchestrator`, audience `era-finance-core`. Claims: `sub`, `email`, `organizationId`, `role`, `roles[]`, `isOwner`, `isSuperAdmin`.

## Env

`DATABASE_URL`, `ERA_JWT_SECRET`, `ERA_JWT_REFRESH_SECRET`, `ERA_SSO_SHARED_SECRET`, `ERA_JWT_ISSUER`, `ERA_JWT_AUDIENCE_FINANCE`
