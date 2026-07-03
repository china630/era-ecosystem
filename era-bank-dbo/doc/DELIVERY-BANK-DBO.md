# DELIVERY — era-bank-dbo (P5 Digital Banking channel)

Sprint 3 channel app. Engine truth in `era-bank-core` `banking_dbo` module; this app is BFF + customer UI only.

## Scaffold & channel DB

- [x] Next.js app on port **3211** — package.json, Docker, env
- [x] Channel Prisma — sessions, API keys, sign requests (no ledger tables)
- [x] BFF `/api/*` → engine `/api/v1/dbo/*` — service token + customer JWT forward
- [x] Entitlement gate `banking_dbo` — orchestrator seed + engine guards

## Retail customer UI

- [x] `/login` — Retail FIN + OTP dev fallback (`123456`) or ASAN/SİMA stub
- [x] `/dashboard` — aggregated balance from engine
- [x] `/accounts`, `/accounts/[id]` — account list and detail
- [x] `/transfers` — internal transfer form
- [x] `/payments`, `/payments/new` — payment orders create + list

## Corporate signatory

- [x] `/login` — Corporate VÖEN + OTP
- [x] `/payments/approve` — pending sign queue + ASAN sign flow
- [x] `PaymentSignRequest` in channel DB — multi-signatory workflow

## Engine integration

- [x] ASAN/SİMA stub adapter — dev mock via engine + channel redirect
- [x] Open API B2B — engine `/dbo/open/*` + channel API key seed
- [x] AML preflight — engine `POST /dbo/payments/orders/:id/preflight`
- [x] Customer cards (stretch) — `/cards` read-only + temporary block

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
