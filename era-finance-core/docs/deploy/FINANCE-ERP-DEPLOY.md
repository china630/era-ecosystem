# Finance ERP — deploy (data plane only)

ERA Finance is **one service** in the umbrella stack, not the whole product entry point.

## Ecosystem (recommended)

| Step | Doc |
|------|-----|
| Local / Docker all services | [docs/SETUP_AND_RUN.md](../../../docs/SETUP_AND_RUN.md) (root `docker-compose.yml`, Traefik, Orch + satellites) |
| Smoke | [docs/SMOKE_ALL_SERVICES.md](../../../docs/SMOKE_ALL_SERVICES.md) |
| Control plane | [docs/CONTROL_PLANE_ARCHITECTURE.md](../../../docs/CONTROL_PLANE_ARCHITECTURE.md) |

Registration, billing UI, super-admin pricing, industry launcher — **era-orchestrator**, not Finance-only deploy.

## Finance-only production (legacy VPS)

When deploying **only** `era-finance-core` (Postgres + Redis + API + Web):

1. [README.md](./README.md) — compose files, image build
2. [deploy.ru.md](./deploy.ru.md) or [deploy.md](./deploy.md)
3. [PRE-RELEASE-CHECKLIST.md](./PRE-RELEASE-CHECKLIST.md) — migrations, guards, smoke
4. [DR_RUNBOOK.md](./DR_RUNBOOK.md) — backup / restore Finance DB

Env: copy root `env.production.example`; set `ERA_AUTH_MODE=control-plane`, `NEXT_PUBLIC_CONTROL_PLANE_URL`, `ERA_JWT_SECRET` aligned with orchestrator when CP runs elsewhere.

## Assistant extension

[EXTENSION_MVP_DEPLOY.md](./EXTENSION_MVP_DEPLOY.md) — browser extension release (independent cadence from umbrella compose).
