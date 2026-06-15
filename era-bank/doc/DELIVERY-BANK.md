# DELIVERY-BANK

PRD: [../PRD.md](../PRD.md) · TZ: [../TZ.md](../TZ.md)

Ops UX GA — teller back-office over `era-bank-core` (engine P0–P7 MVP + ops workflow UI).

**UI pattern:** all CRUD and workflow actions in modals on index routes ([UI_PLAYBOOK_SATELLITES.md](../../docs/UI_PLAYBOOK_SATELLITES.md)). Audit matrix: [BANK_DOC_API_UI_AUDIT.md](../../docs/BANK_DOC_API_UI_AUDIT.md).

## P0 — Platform shell

- [x] Next.js app boots `:3210`, Prisma `era_bank` (ops tables only)
- [x] Local ops login (`OpsUser` / `OpsRole`) + SSO callback
- [x] `@era/satellite-kit` app shell + i18n (az/en/ru)
- [x] BFF proxy routes to `ERA_BANK_CORE_URL` (no local money persistence)
- [x] Demo seed users (teller, manager, compliance, cards, treasury)
- [x] Entitlement gate `industry_banking` + nav filter per `banking_*`
- [x] CIF/account/posting maker-checker **SHIPPED** (engine + modal workflow)
- [x] EOD console **SHIPPED** (engine run + lock banner + confirm modal)
- [x] Ops platform: `OpsModalShell`, `EodLockProvider`, `useOpsModal`, `GET /api/entitlements`

## P1 — Core banking UI

- [x] `/cif` — search + create/detail **modals** (legacy `/new`, `/[id]` redirect)
- [x] `/accounts` — list + open/detail modals (statement, holds, **close account**)
- [x] `/postings/queue` — queue + create/detail modals (approve/reject/reverse)
- [x] `/admin/branches` — list + create modal
- [x] `/admin/eod` — status panel + run confirm modal
- [x] BFF `/api/gl/*` → engine GL (trial balance, chart)

## P2 — Payments

- [x] `/payments` — list + create/detail **modals**
- [x] Inbound payment register modal → `POST /api/payments/inbound`

## P3 — Deposits & loans

- [x] `/deposits` — open/close/rollover modals + **ADİF badge**
- [x] `/loans` — originate/disburse/repay/**restructure** modals
- [x] `/admin/product-factory` — template list + create modal

## P4 — AML & reg reporting

- [x] `/aml/alerts` — queue + detail modal (incl. **escalate**)
- [x] `/aml/rules` — rules table + edit modal
- [x] `/aml/screen` — manual sanction screening
- [x] `/aml/reports/fmn` — FMN generate + JSON/XML export
- [x] `/reports/cbar` — CBAR trial balance preview
- [x] `/reports/fatca-crs` — grid + **classification edit modal**

## P6 — Cards

- [x] `/cards` — issue + detail modals (block, limits, close)
- [x] `/card-txns` — list + ops modals + acquiring inbound stub
- [x] Demo user `cards-officer` / `demo1234`

## P7 — Treasury

- [x] `/treasury` dashboard + lifecycle modals (FX settle/cancel, interbank/gov mature, nostro reconcile, GAP history)
- [x] Demo user `treasury` / `demo1234`

## Ops platform (GA)

- [x] Semantic `OpsActionLog` actions + optional `metadataJson`
- [x] `/admin/audit` — last 100 ops actions
- [x] Shared ops components (`StatusBadge`, `AmountInput`, `PostingLegsTable`, `ops/*`)
- [x] i18n keys for teller screens (az/ru/en parity)
- [x] `/dashboard/executive` — read-only trial balance via `/api/gl/trial-balance`
- [x] Teller drawer documented in [TELLER-DRAWER.md](./TELLER-DRAWER.md) (vNext reconciliation)

## Post-GA (certification track)

See [CERTIFICATION-TRACK.md](./CERTIFICATION-TRACK.md) — live rails, FMN/CBAR, pentest, HA (not blocking ops pilot).

## Definition notes

- `[x]` = workflow shipped end-to-end via BFF + engine
- UAT: [UAT-SMOKE.md](./UAT-SMOKE.md) teller → manager → EOD walkthrough **via modals only**
