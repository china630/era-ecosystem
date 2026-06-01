# Quartet UAT — Finance · Orchestrator · Hotel · FB-POS

Product core for Nafta hospitality + F&B. Run after `docker compose up` or local dev ports.

## Prerequisites

| Service | Default URL | Env |
|---------|-------------|-----|
| era-orchestrator web | http://127.0.0.1:3000 | `ORCH_WEB_URL` |
| era-orchestrator API | http://127.0.0.1:4000 | `ORCH_URL` |
| era-finance-core web | http://127.0.0.1:3100 | `FINANCE_WEB_URL` |
| era-finance-core API | http://127.0.0.1:4100 | `FINANCE_URL` |
| era-hotel-pms | http://127.0.0.1:3201 | `PMS_URL` |
| era-fnb-pos | http://127.0.0.1:3202 | `FB_URL` |

Shared: `ERA_SATELLITE_ORGANIZATION_ID`, `CONTROL_PLANE_URL`, `SATELLITE_EVENT_SERVICE_TOKEN`, `POS_BRIDGE_SECRET`.

## Quick health

```bash
node scripts/quartet-smoke.mjs
node era-hotel-pms/scripts/test-pos-bridge.mjs
```

## SSO launch (owner → satellite)

Orchestrator / Industry launcher opens `{satellite}/sso/callback?...` (HMAC `ERA_SSO_SHARED_SECRET`).

```bash
# Same secret on Orch API, Orch web, and each satellite
export ERA_SSO_SHARED_SECRET=dev-sso-shared-secret
export SSO_EMAIL=owner@demo.local
export SSO_ORG_ID=<your-org-uuid>

node scripts/sso-launch-smoke.mjs
```

Manual: Orch web → Industry → **Open** (Hotel/FB) → lands logged in; ops staff still use `/login` locally.

## Track checklist

| # | Flow | Doc |
|---|------|-----|
| 1 | Finance CP login + billing summary | [SETUP_AND_RUN.md](./SETUP_AND_RUN.md), `ERA_AUTH_MODE=control-plane` |
| 2 | Orch platform smoke | [UAT-SMOKE-PLATFORM.md](../era-orchestrator/doc/UAT-SMOKE-PLATFORM.md) |
| 3 | Hotel PMS + POS bridge | [era-hotel-pms/doc/UAT-SMOKE.md](../era-hotel-pms/doc/UAT-SMOKE.md) |
| 4 | FB pay + room charge | [era-fnb-pos/doc/UAT-SMOKE.md](../era-fnb-pos/doc/UAT-SMOKE.md) |
| 5 | FB E8 consumption event → Finance worker | FB pay with `STOCK_CONSUMPTION_ENABLED=true` |
| 6 | Entitlement-gated platform hooks | Pay without loyalty module → no promotion row |

**Pass:** items 1–4 green on staging; 5–6 after Track B/C deploy.

## CI

- `.github/workflows/ecosystem-smoke.yml` — `quartet-smoke` + `build-quartet-satellites` jobs
