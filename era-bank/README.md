# ERA Bank (operational satellite)

Next.js UI + BFF for **`era-bank-core`** (headless CBS engine). Port **3210**, DB **`era_bank`** (ops/UI state only — **no ledger**).

Companion: [PRD.md](./PRD.md) · [TZ.md](./TZ.md) · engine [era-bank-core/TZ.md](../era-bank-core/TZ.md)

## Architecture

| Layer | Where |
|-------|--------|
| Ledger, balances, CIF master | `era-bank-core` (`:4300`) |
| Staff UI + BFF proxy | `era-bank` (`:3210`) |
| Ops users, sessions, UI audit | PostgreSQL `era_bank` |

Every `/api/*` money route forwards to `ERA_BANK_CORE_URL` with `BANK_CORE_SERVICE_TOKEN` + user JWT. The satellite **never persists balances**.

## Quick start (local)

```bash
cd era-bank
cp .env.example .env
# Set ERA_BANK_ORGANIZATION_ID to a real orch org UUID after bind
npm install
npx prisma db push
npm run db:seed              # system role templates only
npm run db:seed:demo         # lab tellers (teller-a / demo1234, …)
npm run dev
```

Open http://localhost:3210/login

### Demo users (password `demo1234`) — after `db:seed:demo`

| Username | Role |
|----------|------|
| `teller-a` | TELLER |
| `manager-b` | BRANCH_MANAGER |
| `compliance` | AML_OFFICER |
| `cards-officer` | CARDS_OFFICER |
| `treasury` | TREASURY_OFFICER |

## Environment

See [.env.example](./.env.example). Required:

- `DATABASE_URL` → `era_bank`
- `ERA_BANK_CORE_URL` → engine base (e.g. `http://localhost:4300`)
- `BANK_CORE_SERVICE_TOKEN` → satellite→engine auth
- `ERA_BANK_ORGANIZATION_ID` → emergency / appliance process bind (not SHARED login SoT)

## BFF route map

| UI `/api` prefix | Engine `/api/v1` |
|------------------|------------------|
| `/api/cif/*` | `/cif/*` |
| `/api/accounts/*` | `/accounts/*` |
| `/api/postings/*` | `/postings/*` |
| `/api/payments/*` | `/payments/*` |
| `/api/deposits/*` | `/deposits/*` |
| `/api/loans/*` | `/loans/*` |
| `/api/aml/*` | `/aml/*` |
| `/api/reports/*` | `/reports/*` |
| `/api/cards/*` | `/cards/*` |
| `/api/card-txns/*` | `/card-txns/*` |
| `/api/treasury/*` | `/treasury/*` |
| `/api/branches/*` | `/branches/*` |
| `/api/eod/*` | `/eod/*` |
| `/api/product-templates/*` | `/product-templates/*` |

## Docker

```bash
docker build -t era-bank .
# Default BANK_RUN_SEED=false. Role templates only if RUN_SEED=true + real org.
docker run -p 3210:3210 --env-file .env era-bank
```

## Docs

- [doc/DELIVERY-BANK.md](./doc/DELIVERY-BANK.md) — delivery checklist
- [doc/UAT-SMOKE.md](./doc/UAT-SMOKE.md) — smoke test steps
