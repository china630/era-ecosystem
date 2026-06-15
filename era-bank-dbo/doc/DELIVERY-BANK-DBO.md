# DELIVERY — era-bank-dbo (P5 Digital Banking channel)

Sprint 3 channel app. Engine truth in `era-bank-core` `banking_dbo` module; this app is BFF + customer UI only.

## Scope

| Area | Status | Notes |
|------|--------|-------|
| Scaffold Next.js :3211 | [x] | package.json, Docker, env |
| Channel Prisma (sessions, API keys, sign requests) | [x] | No ledger tables |
| BFF `/api/*` → engine `/api/v1/dbo/*` | [x] | Service token + customer JWT forward |
| Retail PWA UI | [x] | login, dashboard, accounts, transfers, payments |
| Corporate approve queue | [x] | `/payments/approve` + `PaymentSignRequest` |
| ASAN/SİMA stub adapter | [x] | Dev mock via engine + channel redirect |
| OTP dev fallback | [x] | Fixed code `123456` |
| Open API B2B | [x] | Engine `/dbo/open/*` + channel key seed |
| AML preflight | [x] | Engine `POST /dbo/payments/orders/:id/preflight` |
| Entitlement gate `banking_dbo` | [x] | Orchestrator seed + engine guards |
| Customer cards (stretch) | [x] | `/cards` read-only + temporary block |

## Routes

| Route | Actor | Description |
|-------|-------|-------------|
| `/login` | Customer | Retail FIN / Corporate VÖEN + OTP or ASAN stub |
| `/dashboard` | Customer | Aggregated balance |
| `/accounts`, `/accounts/[id]` | Customer | Account list and detail |
| `/transfers` | Customer | Internal transfer form |
| `/payments`, `/payments/new` | Customer | Payment orders |
| `/payments/approve` | Corporate signatory | Pending sign queue |

## BFF API map

| BFF | Engine |
|-----|--------|
| `POST /api/auth/otp/*` | `/api/v1/dbo/auth/otp/*` |
| `POST /api/auth/asan/*` | `/api/v1/dbo/auth/asan/*` + channel stub |
| `GET /api/auth/me` | `/api/v1/dbo/auth/me` |
| `GET /api/accounts` | `/api/v1/dbo/accounts` |
| `POST /api/transfers/internal` | `/api/v1/dbo/transfers/internal` |
| `POST /api/payments/orders` | `/api/v1/dbo/payments/orders` |
| `POST /api/payments/orders/[id]/sign` | `/api/v1/dbo/payments/orders/:id/sign` |
| `POST /api/payments/orders/[id]/submit` | `/api/v1/dbo/payments/orders/:id/submit` |
| `GET /api/payments/sign-requests` | Channel DB only |

## Environment

See `.env.example`. Required: `DATABASE_URL`, `ERA_BANK_CORE_URL`, `BANK_CORE_SERVICE_TOKEN`, `BANK_DBO_JWT_SECRET`.

## UAT

See [UAT-SMOKE.md](./UAT-SMOKE.md).
