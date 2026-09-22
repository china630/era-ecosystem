# UAT smoke — era-bank

Operational satellite UI/BFF for `era-bank-core`. Engine must be running on `:4300` for money flows.

**Walkthrough uses modals only** — legacy `/new` and `/[id]` URLs redirect to index with query params.

## Prerequisites

```bash
# Terminal 1 — engine (set ERA_BANK_ORGANIZATION_ID after bind)
cd era-bank-core && npm install && npm run db:seed && npm run db:seed:demo && npm run dev

# Terminal 2 — ops UI
cd era-bank
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run db:seed:demo
npm run dev
```

Set `ERA_BANK_CORE_URL=http://localhost:4300` and a real `ERA_BANK_ORGANIZATION_ID` in `era-bank/.env` (never `demo-bank-org-001`). Compose defaults `BANK_*_RUN_SEED=false`.

## Platform

- [ ] `GET /api/health` → 200 `{ status: "ok", service: "era-bank" }`
- [ ] `/login` loads; `teller-a` / `demo1234` → `/dashboard` (appliance: no ERA ID. SHARED pool: 6-digit org code / `{orgNo}.bank.era-365.online`)
- [ ] EOD lock banner hidden when no RUNNING EOD
- [ ] **Clock (Asia/Baku):** `/admin/eod` default business date and EOD lock poll use `todayBakuYmd()` — not UTC `toISOString().slice(0,10)`. Between 00:00–04:00 Baku the picker already shows the new Baku day when Node `TZ=UTC`.
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
| 5 | `/payments` → create external rail → **Submit** → `PENDING_APPROVAL` | Maker cannot approve own order |
| 5b | `manager-b` → filter PENDING_APPROVAL → **Approve** | SETTLED (or REJECTED) |
| 6 | `/payments` → **Register inbound** modal | Inbound order created |
| 7 | `/deposits` → open modal (in-band); detail → close or rollover | ACTIVE + ADİF badge if tagged |
| 7b | `/deposits` → open with **pricing exception** → filter pending pricing → `manager-b` approve/reject | PENDING_PRICING_APPROVAL SoD |
| 8 | `/loans` → originate (bureau pull + collateral) → disburse → repay-by-schedule | Schedule paid*; restructure CatalogField |
| 8b | `/loans` → exception pricing queue + SoD approve | PENDING_PRICING_APPROVAL |
| 8c | `/risk` dashboard + `/risk/portfolio` + `/risk/capital` + **Run staging**/ECL on `/risk/ecl` | Exposures + CAR/LCR + stage (lab) |
| 9 | `/admin/eod` → **Run EOD** confirm modal | COMPLETED; steps show `fxRevaluation` (posted count), `interbranchNetting` MFR positions, depositInterestAccrual + lcr; lock banner during RUN |
| 9b | `/accounts` detail → **Holds** tab → LEGAL_ARREST + reference | Hold listed ACTIVE; available reduced |
| 9c | `/accounts` → PATCH limits (OD via API/BFF) or ops follow-up | `overdraftLimitMinor` / `dailyDebitLimitMinor` persisted in engine |
| 9d | `/fees` → packages → **Link package tariff** (PERCENT waiver) → assess with `customerId` | Waived amount on assess response |
| 10 | `/admin/audit` | Semantic actions logged |
| 11 | Account detail modal → zero balance → **Close account** | Status CLOSED |
| 12 | `compliance` → `/aml/rules` edit modal; `/reports/fatca-crs` edit | PUT succeeds |
| 13 | `cards-officer` → `/cards` issue + limits/close modals | Lifecycle OK |
| 14 | `treasury` → FX row → settle/cancel modal | Status updates |
| 15 | `/gl` + `/dashboard/executive` | Trial balance rows |
| 16 | `era_bank` schema | Only ops tables — no balances |
| 17 | `/cash` → create till/vault movement → **Post** | Movement POSTED via engine |
| 18 | `/fees` → tariff + SDB tabs create | Tariffs / boxes listed |
| 19 | `/payments/extras` → SO / VA / cheque / sweep create | Rows appear; pause SO optional |
| 20 | `/loans/applications` → create → Submit; `manager-b` Book (SoD) | DRAFT→SUBMITTED→APPROVED; maker≠checker |
| 21 | `/collections` → open case → Assign / PTP; Recover with checker ≠ maker | SoD reject if same user |
| 22 | `/trade` → LC create → **Issue**; SWIFT tab labeled stub | Contingent status; no live SWIFT claim |
| 23 | `/islamic` activate; `/wealth` safekeeping create | Contracts / accounts listed |
| 24 | `/aml/cases` open; `/cards/disputes` + `/cards/3ds` ops view | Case / dispute / challenge rows |

> Lab kit steps 1–16 were signed earlier; steps 17–24 = UI waves full envelope. Edition remains `mvp` / `pilot_ready: false`.

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
| `/payments/*` | `/api/payments/orders`, `/api/payments/inbound`, SO/VA/cheque/sweep |
| `/cash`, `/fees` | `/api/cash/*`, `/api/fees/*` |
| `/collections`, `/trade` | `/api/collections/*`, `/api/trade/*` |
| `/islamic`, `/wealth` | `/api/islamic/*`, `/api/wealth/*` |
| `/deposits/*` | `/api/deposits` |
| `/loans/*` | `/api/loans`, applications, credit-lines |
| `/admin/eod` | `/api/eod/{date}`, POST `/api/eod/run` |
| `/aml/rules`, `/aml/cases` | `/api/aml/*` |
| `/cards/disputes`, `/cards/3ds` | `/api/cards/*` |
| AML/cards/treasury | unchanged from prior UAT |

## Role smoke

| User | Password | Role |
|------|----------|------|
| `teller-a` | `demo1234` | Maker — postings, payments, accounts |
| `manager-b` | `demo1234` | Checker — approve/reject queue |
| `compliance` | `demo1234` | AML / reg reporting |
| `cards-officer` | `demo1234` | Cards |
| `treasury` | `demo1234` | Treasury |

## RBAC Variant A (BANK-RBAC-01)

Doors are grants (`api:*` / `screen:*` / `admin:`), not role names. Maker-checker SoD in the engine is separate (grant ∩ SoD).

| Step | Action | Pass |
|------|--------|------|
| R1 | Sign in `manager-b` → `/admin/access` → strip `api:payments.approve` from BRANCH_MANAGER → Save → refresh | Session refreshed |
| R2 | As manager, open payment PENDING_APPROVAL → Approve | BFF **403** (grant stripped) |
| R3 | Reset BRANCH_MANAGER defaults; sign in `compliance` → open `/cards` | Redirect forbidden / no cards nav |
| R4 | As `teller-a`, Approve on posting queue | Button hidden; API 403 if forced |
| R5 | Engine SoD: maker cannot approve own payment even with approve grant | Engine rejects maker=checker |
| R6 | As teller, `POST …/deposits/:id/pricing-approve` | BFF **403** (needs `api:deposits.approve`, not write) |

Field UAT open → COVERAGE **SCREEN** (not SHOW / not SHIPPED).

## Docker smoke

```bash
docker build -t era-bank ./era-bank
docker run -p 3210:3210 --env-file era-bank/.env era-bank
curl -s http://localhost:3210/api/health
```
