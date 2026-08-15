# Bank stack — Doc / API / UI gap audit

Living matrix for **era-bank-core** (headless CBS) + **era-bank** (ops satellite). Tracks doc↔API↔UI alignment and modal CRUD playbook compliance.

**Method:** classify each capability across Doc (`DELIVERY-BANK*.md`, PRD/TZ), API (engine + BFF), UI (index pages + modals).

| Tag | Meaning |
|-----|---------|
| **OK** | Doc ≈ API ≈ UI for ops scope |
| **HEADLESS** | By design — no ops UI (DBO channel, internal workers) |
| **N/A** | Documented out-of-scope for this delivery wave |
| **Partial** | Two layers OK; third incomplete |

**Last audit:** 2026-08-05 (Ops UI playbook waves W0–W7 + honesty closeout)

---

## 2026-08-05 honesty delta (playbook + domain depth)

| Area | Prior claim | Now |
|------|-------------|-----|
| Ops UI = playbook / GA | Modal wave marked as ops pilot GA | **UI 🟡** — kit chrome in progress (`BankDataGrid`, `navSections`, `CatalogField`); **not** sell/show GA |
| Edition | notes implied ops ready | `docs/editions/bank.yaml` stays **`mvp` / `pilot_ready: false`** |
| Payment staff approve | **N/A** — no engine | **Partial** — `PENDING_APPROVAL` + `POST …/approve|reject` SoD + ops queue filter |
| Loan bureau / collateral / NPL / IFRS9 | **N/A** — no engine | **Partial** — stub bureau, collateral JSON, DPD→stage, `/risk/*` scaffold |
| GL ops page | executive only | `/gl` trial balance list in Core nav |
| Risk hub | missing | `/risk` dashboard + portfolio/collateral/ecl |

**Forbidden:** UI ✅ / edition `ga` / `pilot_ready: true` without signed lab UAT.

---

## Before → After (full change picture)

### Metrics

| Metric | Before (pre-wave) | After (post-wave) | Δ |
|--------|-------------------|-------------------|---|
| Doc→API (DELIVERY scope) | ~92% (account close, inbound missing) | **100%** | +8% |
| Doc→UI (DELIVERY scope) | ~85% (many `/new`, `/[id]` pages) | **100%** | +15% |
| API→UI (ops, excl. headless/DBO) | ~70% (API-only endpoints) | **~98%** | +28% |
| Modal CRUD playbook compliance | **0%** (full pages only) | **100%** | +100% |
| GL BFF path | ❌ `/api/accounts/gl/*` (404/wrong) | ✅ `/api/gl/*` | fixed |
| Entitlement nav filter | ❌ all items always visible | ✅ `useBankEntitlements` + `/api/entitlements` | fixed |
| EOD mutation lock | ⚠️ banner only / partial | ✅ `EodLockProvider` + modal disable + confirm | fixed |
| i18n ru/az parity | ⚠️ ~30 keys (titles only) | ✅ full `en.json` structure | fixed |
| `era-bank-core` tests | 41 | **46** | +5 |
| DELIVERY checkboxes (`era-bank`) | 37 open gaps in audit | **37/37 (100%)** | closed |

### Waves (plan → delivered)

| Wave | Scope | Before | After | Key artifacts |
|------|-------|--------|-------|---------------|
| **W0** | Shared platform | No modal primitives; standalone `EodLockBanner` | ✅ | `OpsModalShell`, `useOpsModal`, `OpsDataTable`, `EodLockProvider`, `useBankEntitlements`, `useOpsMe` |
| **W1** | Engine + BFF blockers | GL wrong path; no account close API | ✅ | `app/api/gl/[[...path]]`, `POST /accounts/:id/close`, rollover comment + test, module-map |
| **W2** | P1 core modals | `/new`, `/[id]` full pages | ✅ | `CifModals`, `AccountModals`, `PostingModals`, `BranchModals`, EOD confirm modal |
| **W3** | P2–P3 product modals | Separate create/detail pages | ✅ | `PaymentModals`, `DepositModals`, `LoanModals`, `ProductFactoryModals` |
| **W4** | API-only UI | Partial / `<pre>` dumps | ✅ | `/aml/rules`, FATCA edit, cards lifecycle, card-txns ops, treasury lifecycle, inbound payments |
| **W5** | Platform polish | Partial EOD/i18n/nav | ✅ | Full ru/az keys, entitlement nav, EOD lock on all submits |
| **W6** | Documentation | Ad-hoc chat matrix | ✅ | `BANK_DOC_API_UI_AUDIT.md`, DELIVERY/TZ/UAT updates, `era-bank-ui.mdc` |
| **W7** | Verification | Not re-audited | ✅ | tests 46/46, builds green, delivery scripts 100% |

### UI routing: pages → modals

| Area | Before (UI pattern) | After (UI pattern) | Legacy routes |
|------|---------------------|--------------------|---------------|
| CIF | `/cif` list + `/cif/new` + `/cif/[id]` pages | `/cif` + create/detail **modals** | redirect → `?modal=create` / `?id=` |
| Accounts | `/accounts/new`, `/accounts/[id]`, `/statement`, `/holds` pages | `/accounts` + open/detail modal (tabs: overview, statement, holds, **close**) | redirect |
| Postings | `/postings/new`, `/postings/[id]` pages | `/postings/queue` + create/detail modals (approve/reject/reverse) | redirect |
| Branches | inline form on page | create **modal** | — |
| EOD | direct Run button | status panel + **confirm modal** + EOD lock | — |
| Payments | `/payments/new`, `/payments/[id]` pages | modals + **Register inbound** modal | redirect |
| Deposits | `/deposits/new`, `/deposits/[id]` pages | modals + **ADİF badge** | redirect |
| Loans | `/loans/new`, `/loans/[id]` pages | modals + schedule + **restructure** tab | redirect |
| Product factory | raw create form only | kind forms + activate/retire + apply-on-originate | — |
| AML rules | ❌ no screen | `/aml/rules` table + edit modal | new route |
| AML alerts | PATCH-only workflow | detail modal + **POST escalate** | — |
| FATCA/CRS | read-only grid | grid + **Edit classification** modal | — |
| Cards | `/cards/issue`, `/cards/[id]` pages | issue + detail modals (block, limits, close) | redirect |
| Card-txns | monitor list only | list + ops modals + **acquiring inbound** stub | — |
| Treasury FX | JSON `<pre>` | `OpsDataTable` + settle/cancel modals | — |
| Treasury interbank | JSON `<pre>` | table + **mature** modal | — |
| Treasury gov | JSON `<pre>` | table + **mature** modal | — |
| Treasury nostro | JSON `<pre>` | table + statement/reconcile modals | — |
| Liquidity GAP | snapshot only | snapshot + **history table** | — |
| Executive dashboard | ❌ wrong GL fetch | `/api/gl/trial-balance` | fixed |

### Engine + BFF blockers

| Gap | Before | After | File(s) |
|-----|--------|-------|---------|
| GL BFF | UI → `/api/accounts/gl/*` | BFF `/api/gl/*` → engine `/gl/*` | `era-bank/app/api/gl/[[...path]]/route.ts` |
| Account close | ❌ no engine route | `POST /accounts/:id/close` (zero balance, no holds) | `ledger.service.ts`, `ledger.controller.ts` |
| Account close test | — | `account-close.spec.ts` | `era-bank-core/apps/api/__tests__/` |
| Deposit rollover | undocumented maturity-only | comment + balanced posting test | `deposits.service.ts`, `deposit-postings-balanced.spec.ts` |
| Module map | partial (no close, no GL) | full route list | `era-bank-core/.cursor/rules/era-bank-core-module-map.mdc` |
| Payments inbound | API only | UI modal → `POST /payments/inbound` | `era-bank/app/payments/page.tsx` |
| Maker-checker gating | approve visible to teller | `useOpsMe().canApprove` hides approve/reject | `useOpsMe.ts`, `PostingModals.tsx` |

### Platform primitives (new files)

| Component | Role |
|-----------|------|
| `OpsModalShell.tsx` | `ModalShell` wrapper + i18n + EOD lock on submit |
| `useOpsModal.ts` | mode/create/detail + URL sync `?modal=` / `?id=` |
| `OpsDataTable.tsx` | table + row click → detail; Add → create |
| `EodLockProvider.tsx` | poll EOD status; `mutationsDisabled`; banner |
| `useBankEntitlements.ts` | `banking_*` module flags for nav |
| `useOpsMe.ts` | session role + `canApprove` from `limitsJson` |
| `modals/*.tsx` (8 files) | domain create/detail/workflow modals |
| `GET /api/entitlements` | expose module flags to client |
| `GET /api/auth/me` | role + `canApprove` for UI gating |

### Documentation & rules

| Doc / rule | Change |
|------------|--------|
| `docs/BANK_DOC_API_UI_AUDIT.md` | **new** living matrix (this file) |
| `era-bank/doc/DELIVERY-BANK.md` | modal CRUD pattern; new routes; account close |
| `era-bank/TZ.md` | §4 `/api/gl/*`; §5 modal CRUD mandatory |
| `era-bank/doc/UAT-SMOKE.md` | modal-only walkthrough; 15 scenarios |
| `docs/READINESS_MATRIX.md` | modal CRUD compliance note |
| `docs/ECOSYSTEM_URLS.md` | GL BFF note |
| `era-bank/.cursor/rules/era-bank-ui.mdc` | **new** — no `/new` ops pages rule |

### Explicit out-of-scope / partial (honesty)

| Area | Status | Where |
|------|--------|-------|
| Loan bureau / collateral / NPL / IFRS9 | **Partial** | Stub bureau + collateral + DPD staging; live AKB/ECL cert **N/A** |
| Payment staff approve queue | **Partial** | Engine SoD + ops Approve/Reject; threshold rules still coarse |
| DBO screens in `era-bank` | **HEADLESS** | → `era-bank-dbo` `:3211` (UX out of this wave) |
| Teller drawer reconciliation | **N/A** | `TELLER-DRAWER.md` vNext |
| Production certification | **N/A** | `CERTIFICATION-TRACK.md` |
| Live CBAR/AKB/ƏMDK connectors | **N/A** | certification track |

### Verification (Wave 7)

| Check | Result |
|-------|--------|
| `cd era-bank-core && npm test -- --ci` | **46/46 pass** |
| `cd era-bank-core && npm run build` | ✅ |
| `cd era-bank && npm run build` | ✅ |
| `node scripts/delivery-readiness.mjs` | era-bank **37/37 (100%)** |
| `node scripts/readiness-strict-delivery.mjs` | **100%** strict |

---

## Executive summary

| Metric | Target | Result |
|--------|--------|--------|
| Doc→API (DELIVERY scope) | 100% | **100%** |
| Doc→UI (DELIVERY scope) | 100% | **100%** |
| API→UI (ops, excl. headless/DBO) | ≥95% | **~98%** |
| Modal CRUD playbook | 100% create/detail/workflow in modals | **100%** |
| GL BFF (`/api/gl/*`) | Green | **OK** |

**Ops pilot GA:** **no** — playbook UI 🟡; lab UAT unsigned. Prior “ops pilot GA via modals” claim retired (2026-08-05).

**Production/regulatory:** not yet — see [CERTIFICATION-TRACK.md](../era-bank/doc/CERTIFICATION-TRACK.md).

---

## Platform

| Feature | Doc | API | UI | Status |
|---------|-----|-----|-----|--------|
| Local ops login + SSO | DELIVERY P0 | BFF auth | `/login`, SSO callback | **OK** |
| Entitlement gate `industry_banking` | DELIVERY P0 | engine-client | nav filter via `/api/entitlements` | **OK** |
| EOD lock banner | DELIVERY P0 | `GET /eod/:date` | `EodLockProvider` + modal submit disable | **OK** |
| Ops audit log | DELIVERY GA | `/api/admin/audit` | `/admin/audit` | **OK** |
| Modal CRUD pattern | TZ §5, UI playbook | — | `OpsModalShell`, index + `?modal=` | **OK** |
| GL BFF | TZ §4 | engine `GET /gl/*` | BFF `/api/gl/*` | **OK** (was broken `/api/accounts/gl/*`) |

---

## P1 — Core banking

| Feature | Doc | API | UI | Status |
|---------|-----|-----|-----|--------|
| CIF search + onboard | P1 | `GET/POST /cif/customers` | `/cif` + create/detail modals | **OK** |
| Account open/list/detail | P1 | `GET/POST /accounts` | `/accounts` modals | **OK** |
| Account statement | P1 | `GET .../statement` | detail modal tab | **OK** |
| Holds place/release | P1 | POST/DELETE holds | detail modal tab | **OK** |
| Account close | PRD | `POST /accounts/:id/close` | detail modal action | **OK** |
| Posting queue + teller ops | P1 | GET/POST postings + templates | `/postings/queue` modals | **OK** |
| Maker-checker approve/reject | P1 | approve/reject/reverse | detail modal (`canApprove`) | **OK** |
| Branch admin | P1 | branches API | `/admin/branches` create modal | **OK** |
| EOD console | P0 | run + status | `/admin/eod` + confirm modal | **OK** |

Legacy `/new`, `/[id]` routes redirect to index with query params (bookmarks preserved).

---

## P2 — Payments

| Feature | Doc | API | UI | Status |
|---------|-----|-----|-----|--------|
| Payment list/create/detail | P2 | orders CRUD + submit | `/payments` modals | **OK** |
| Inbound register | PRD | `POST /payments/inbound` | inbound modal on `/payments` | **OK** |
| Staff approve queue | PRD stretch | no engine `approve` | — | **N/A** (out of scope) |

---

## P3 — Deposits & loans

| Feature | Doc | API | UI | Status |
|---------|-----|-----|-----|--------|
| Deposit open/close | P3 | POST deposits, close | modals | **OK** |
| Deposit rollover | P3 | POST rollover (maturity only) | detail modal | **OK** (interest cap future) |
| ADİF badge | PRD display | `adifTagged` field | list + detail badge | **OK** |
| Loan originate/disburse/repay | P3 | loans API | modals | **OK** |
| Loan restructure | P3 | `POST .../restructure` | detail modal tab | **OK** |
| Product factory | P3 | GET/PATCH/activate/retire + params contract | list + kind authoring + lifecycle | **OK** (UI 🟡 depth, not ga) |
| Bureau/collateral/NPL/IFRS9 | PRD §3 | — | — | **N/A** |

---

## P4 — AML & reg reporting

| Feature | Doc | API | UI | Status |
|---------|-----|-----|-----|--------|
| AML alert queue | P4 | alerts API | `/aml/alerts` + detail modal | **OK** |
| Alert escalate | P4 | `POST .../escalate` | detail modal | **OK** |
| AML rules admin | P4 | `PUT /aml/rules/:code` | `/aml/rules` + edit modal | **OK** |
| Manual screening | P4 | screen API | `/aml/screen` | **OK** |
| FMN export | P4 | generate + export | `/aml/reports/fmn` | **OK** |
| CBAR preview | P4 | cbar templates | `/reports/cbar` | **OK** |
| FATCA/CRS edit | P4 | `PUT .../classifications/:id` | edit modal on grid | **OK** |

---

## P6 — Cards

| Feature | Doc | API | UI | Status |
|---------|-----|-----|-----|--------|
| Issue card | P6 | cards issue | modal from `/cards` | **OK** |
| Block/limits/close | P6 | PATCH limits, POST close | detail modal | **OK** |
| Card-txns ops | P6 | authorize/capture/reverse | `/card-txns` modals | **OK** |
| Acquiring inbound stub | P6 | acquiring authorize | modal on card-txns | **OK** |

---

## P7 — Treasury

| Feature | Doc | API | UI | Status |
|---------|-----|-----|-----|--------|
| FX settle/cancel | P7 | POST settle/cancel | detail modals | **OK** |
| Interbank mature | P7 | POST mature | detail modal | **OK** |
| Gov securities mature | P7 | POST mature | detail modal | **OK** |
| Nostro statement/reconcile | P7 | GET statement, POST reconcile | detail modals | **OK** |
| Liquidity GAP history | P7 | GET history | table on page | **OK** |

---

## Explicit out-of-scope (documented, not coded)

| Area | Notes |
|------|-------|
| Loan bureau/collateral/NPL/IFRS9 wizard | PRD §3 — no engine |
| Payment staff approve queue | No engine endpoint |
| DBO screens in `era-bank` | → `era-bank-dbo` (`:3211`) |
| Teller drawer reconciliation | → [TELLER-DRAWER.md](../era-bank/doc/TELLER-DRAWER.md) vNext |
| Production certification | → [CERTIFICATION-TRACK.md](../era-bank/doc/CERTIFICATION-TRACK.md) |
| DBO/internal headless APIs | **HEADLESS** by ADR D9 |

---

## BFF route map (ops)

| UI area | BFF prefix | Engine prefix |
|---------|------------|---------------|
| CIF | `/api/cif/*` | `/api/v1/cif/*` |
| Accounts | `/api/accounts/*` | `/api/v1/accounts/*` |
| GL | `/api/gl/*` | `/api/v1/gl/*` |
| Postings | `/api/postings/*` | `/api/v1/postings/*` |
| Payments | `/api/payments/*` | `/api/v1/payments/*` |
| Deposits | `/api/deposits/*` | `/api/v1/deposits/*` |
| Loans | `/api/loans/*` | `/api/v1/loans/*` |
| EOD | `/api/eod/*` | `/api/v1/eod/*` |
| Entitlements | `/api/entitlements` | orchestrator snapshot |

---

## Re-audit checklist

- [x] All DELIVERY `[x]` items have engine route + ops UI (modal or read-only page)
- [x] No money tables in `era_bank` Prisma schema
- [x] `/api/gl/*` BFF proxies to engine GL (not `/api/accounts/gl/*`)
- [x] Modal CRUD for CIF, accounts, postings, payments, deposits, loans, branches, product factory
- [x] Wave 4 API-only gaps closed (AML rules, cards lifecycle, treasury, FATCA, inbound payments)
- [x] ru/az i18n keys aligned with en.json structure
