# UAT smoke — era-bank

Operational satellite UI/BFF for `era-bank-core`. Engine must be running on `:4300` for money flows.

**Walkthrough uses modals only** — legacy `/new` and `/[id]` URLs redirect to index with query params.

## Prerequisites

```bash
# Terminal 1 — engine
cd era-bank-core && npm install && npm run db:seed && npm run dev

# Terminal 2 — ops UI
cd era-bank
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Set `ERA_BANK_CORE_URL=http://localhost:4300` in `era-bank/.env`.

## Platform

- [ ] `GET /api/health` → 200 `{ status: "ok", service: "era-bank" }`
- [ ] `/login` loads; `teller-a` / `demo1234` → `/dashboard`
- [ ] EOD lock banner hidden when no RUNNING EOD
- [ ] Logout → `/login`
- [ ] `/api/entitlements` returns `banking_*` flags; nav hides inactive modules

## Teller day walkthrough (modal CRUD)

Sign in as **`teller-a`** then **`manager-b`** for checker steps.

| Step | UI (modal flow) | Pass |
|------|-----------------|------|
| 1 | `/cif` → **New customer** modal — onboard NATURAL | Detail modal opens |
| 2 | `/accounts` → **Open account** modal | Detail modal shows IBAN |
| 3 | `/postings/queue` → **New posting** modal — cash deposit | Posting PENDING |
| 4 | Sign out → `manager-b` → queue row → detail modal → **Approve** | POSTED; balance moves |
| 5 | `/payments` → create modal → row → detail → **Submit** | SETTLED |
| 6 | `/payments` → **Register inbound** modal | Inbound order created |
| 7 | `/deposits` → open modal; detail → close or rollover | ACTIVE + ADİF badge if tagged |
| 8 | `/loans` → originate modal → detail → disburse → repay | Schedule tab; restructure tab |
| 9 | `/admin/eod` → **Run EOD** confirm modal | COMPLETED; lock banner during RUN |
| 10 | `/admin/audit` | Semantic actions logged |
| 11 | Account detail modal → zero balance → **Close account** | Status CLOSED |
| 12 | `compliance` → `/aml/rules` edit modal; `/reports/fatca-crs` edit | PUT succeeds |
| 13 | `cards-officer` → `/cards` issue + limits/close modals | Lifecycle OK |
| 14 | `treasury` → FX row → settle/cancel modal | Status updates |
| 15 | `era_bank` schema | Only ops tables — no balances |

Engine replay (from repo root):

```bash
node era-bank-core/tools/audit/replay-day.mjs $(date +%F)
```

## BFF route map

| UI | BFF |
|----|-----|
| `/cif/*` | `/api/cif/customers` |
| `/accounts/*` | `/api/accounts` |
| GL / executive | `/api/gl/*` |
| `/postings/*` | `/api/postings` |
| `/payments/*` | `/api/payments/orders`, `/api/payments/inbound` |
| `/deposits/*` | `/api/deposits` |
| `/loans/*` | `/api/loans` |
| `/admin/eod` | `/api/eod/{date}`, POST `/api/eod/run` |
| `/aml/rules` | `/api/aml/rules` |
| AML/cards/treasury | unchanged from prior UAT |

## Role smoke

| User | Password | Role |
|------|----------|------|
| `teller-a` | `demo1234` | Maker — postings, payments, accounts |
| `manager-b` | `demo1234` | Checker — approve/reject queue |
| `compliance` | `demo1234` | AML / reg reporting |
| `cards-officer` | `demo1234` | Cards |
| `treasury` | `demo1234` | Treasury |

## Docker smoke

```bash
docker build -t era-bank ./era-bank
docker run -p 3210:3210 --env-file era-bank/.env -e RUN_SEED=true era-bank
curl -s http://localhost:3210/api/health
```
