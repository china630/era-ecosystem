# ERA Bank — Product Requirements Document (PRD)

**App:** `era-bank` — the operational banking **satellite** (carries the `industry_banking` commercial gate).
**Role:** the UI / workflow / channel-for-staff layer that consumes the headless engine **`era-bank-core`**. See ADR [docs/adr/era-bank-core.md](../docs/adr/era-bank-core.md) D9.
**Status:** Lab-pilot / ops-mvp (`docs/editions/bank.yaml` = `mvp`). Not product ga.
**Companion docs:** [TZ.md](./TZ.md) · engine [era-bank-core/PRD.md](../era-bank-core/PRD.md) (product-line lead) · [era-bank-core/TZ.md](../era-bank-core/TZ.md) · scope [Bank-Capability-Inventory.md](../docs/acceptance/Bank-Capability-Inventory.md) · [Bank-Acceptance-System.md](../docs/acceptance/Bank-Acceptance-System.md)
**Language law:** product chat — Russian; this repo doc — English.

---

## §1. Vision

`era-bank` is the **operational front** for bank staff: tellers, back-office, risk, compliance, treasury, accounting, and management. It renders screens and orchestrates workflows over the regulated engine `era-bank-core` — it **never holds money or ledger state**. All postings, balances, EOD and product math live in the engine (ADR D6/D9); `era-bank` only calls the engine API and shows the result.

This separation lets the regulated engine be certified and deployed in isolation while the operational app evolves at product speed.

### 1.1. Hard rules (binding)

- **No ledger state in `era-bank`.** Its DB (`era_bank`) stores only operational/UI state: local operational users/roles/sessions, screen workflow drafts, teller drawer sessions, UI preferences, and an operational action audit. Customer balances/postings are **only** in `era-bank-core`.
- **No money mutation locally.** Every money action is a call to the engine posting API (with idempotency key + maker-checker). `era-bank` is a client.
- **Entitlement gating.** Screens for a module render only when the matching `banking_*` module is active (entitlement snapshot from orchestrator).
- **Branch-scoped operations.** Teller/back-office actions are bound to the operator's `Branch`; cross-branch operations produce engine-side МФР postings (ADR D5, engine TZ §7).

## §2. Personas & roles (operational)

| Persona | Login | Scope |
|---------|-------|-------|
| Teller / operations officer | Local operational login (branch-bound) | Maker of customer transactions within branch/role limits |
| Branch manager | Local login + elevated role | Checker (4-eyes); branch limits/overrides |
| Deposits/loans/cards officer | Local login | Product servicing screens |
| Risk / credit officer | Local login | Scoring, collateral, provisioning screens |
| Compliance / AML officer | Local login | Alerts, screening, FMN reporting screens |
| Treasury / ALM | Local login | Liquidity, FX, interbank, securities screens |
| Accountant / reporting | Local login | GL views, CBAR prudential reporting screens |
| Bank owner / executive | **SSO** (orchestrator launcher) | Read/management dashboards; no customer-money actions by default |

Identity follows the ecosystem two-contour model: staff use local operational auth (branch-bound, no org picker); owners/management use orchestrator SSO ([era-architecture-boundaries](../.cursor/rules/era-architecture-boundaries.mdc)). Roles + branch limits gate maker/checker.

## §3. Operational modules (UI side of each `banking_*` key)

Each module's **regulated math + API is in `era-bank-core`**; `era-bank` provides the **screens and workflow**. The commercial key gates both.

| Module key | `era-bank` screens / workflow | Engine API consumed |
|------------|-------------------------------|---------------------|
| `banking_core` | CIF search/onboarding, account open/close, account 360, statements, holds/arrests, posting maker/checker queue, branch admin, trial balance view, EOD console | `/cif/*`, `/accounts/*`, `/postings/*`, `/gl/*`, `/branches`, `/eod/*` |
| `banking_deposits` | Open/close/rollover deposit from product, schedule view, ADİF status | `/deposits/*`, `/product-templates` |
| `banking_loans` | Origination wizard (bureau pull, collateral, schedule), disburse/repay/restructure, NPL/IFRS9 views | `/loans/*` |
| `banking_cards` | Card issue/limits/block, card-txn monitor | `/cards/*`, `/card-txns/*` |
| `banking_payments` | Payment order entry/approval, rail status (AZIPS/XÖHKS/AÖS/SWIFT), inbound queue | `/payments/*` |
| `banking_aml` | Alert queue, screening, suspicious-tx workflow, FMN report builder | `/aml/*` |
| `banking_treasury` | FX deals, interbank, securities, liquidity-GAP dashboards | `/treasury/*` |
| `banking_regreporting` | CBAR prudential report builder/exports, FATCA/CRS | `/reports/*` |
| Product Factory (admin) | Author product templates (rates/terms/fees) — stored & enforced in engine | `/product-templates` |

> `banking_dbo` (customer mobile/internet bank) is a **separate channel app** (`era-bank-dbo`), not part of `era-bank`. It consumes the same engine API.

## §4. Representative user stories (UI flows)

- As a teller, I search a customer (engine `/cif`), open a current account (engine `/accounts`), and the success screen shows the issued IBAN — no balance is stored locally.
- As a teller in branch B, I cash out a branch-A customer; I submit the posting, my branch manager approves it (4-eyes), and the engine records the balanced МФР transaction.
- As a compliance officer, I work the AML alert queue (engine `/aml/alerts`), screen a counterparty, and generate an FMN report.
- As an owner via SSO, I open the management dashboard and see consolidated balances (read-only) across branches.

## §5. Integrations

| Integration | Mechanism |
|-------------|-----------|
| `era-bank-core` engine | Internal API + service token; JWT forwarded for user context (ADR D9) |
| Orchestrator SSO / RBAC / entitlements | JWT verify; `industry_banking` + per-module gate; owner SSO |
| Orchestrator MDM | Identity resolution happens in the engine; `era-bank` only displays |
| Notifications | Orchestrator platform notifications (statements, alerts) |
| i18n | `next-intl` + `@era/i18n-common`, locales az/ru/en, default az ([SATELLITE_DOCUMENTATION.md](../docs/SATELLITE_DOCUMENTATION.md)) |
| UI shell | `@era/satellite-kit/ui` (`EraAppRouteShell`, header/sidebar) per [UI_PLAYBOOK_SATELLITES.md](../docs/UI_PLAYBOOK_SATELLITES.md) |

## §6. Release phases

Aligned with engine phases ([era-bank-core/PRD.md](../era-bank-core/PRD.md) §7): each engine phase Pn is paired with the `era-bank` screens that expose it.

| Phase | `era-bank` scope |
|-------|------------------|
| P0–P1 | App shell, SSO, entitlement gating, local ops auth; CIF/account/posting maker-checker screens; EOD console; branch admin |
| P2 | Payment order entry/approval + rail status screens |
| P3 | Deposit & loan servicing screens; Product Factory admin |
| P4 | AML alert/queue + FMN builder; CBAR reporting screens |
| P5 | (channels handled by `era-bank-dbo`) |
| P6 | Card servicing screens |
| P7 | Treasury/ALM dashboards |

## §7. Finance & engine boundary

`era-bank` is a pure client of `era-bank-core` (regulated balance) and never touches `finance-core` (the bank's corporate books). The bank's own opex/payroll/etc. are handled in finance-core's own UI. See ADR D1/D7/D9.

## §8. Non-functional requirements

| NFR | Target |
|-----|--------|
| No money locally | Enforced: `era-bank` DB has no balance/posting tables |
| Security | SSO + local ops auth; maker-checker UX; operational action audit; no PII beyond display |
| Localization | AZN, +994, az/ru/en (default az), UTC→Asia/Baku display |
| UX | Ecosystem satellite shell + UI playbook compliance |
| Resilience | Degraded read during engine EOD window; clear posting-locked UX |

## §8.1 Scope honesty

UI modules mirror declared `banking_*` keys only (including lab L2: cash/fees, collections, trade, islamic, wealth + payments tails SO/VA/cheque/sweep, loans-deep, AML cases, card disputes/3DS). Capabilities marked **OUT** in [Bank-Capability-Inventory.md](../docs/acceptance/Bank-Capability-Inventory.md) (derivatives FO, own ATM/scheme, private banking suite, certified Basel, …) have **no** ops screens and must not be sold as included. Live rails/cards/ASAN/SWIFT remain certification-track stubs.

## §8.2 Ops UI surfaces (lab)

| Path | Module |
|------|--------|
| `/cash`, `/fees` | `banking_cash` / fees+SDB |
| `/payments`, `/payments/extras` | `banking_payments` |
| `/collections` | `banking_collections` |
| `/trade` | `banking_trade` (SWIFT stub) |
| `/islamic`, `/wealth` | `banking_islamic`, `banking_wealth` |
| `/loans`, `/loans/applications`, `/loans/credit-lines` | `banking_loans` |
| `/aml/*`, `/cards/disputes`, `/cards/3ds` | `banking_aml`, `banking_cards` |

## §9. Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial PRD: operational satellite for `industry_banking`; consumes headless `era-bank-core`; per-module screens, ops personas, phases. Split from engine per ADR D9. |
| 2026-08-06 | Status lab-pilot/mvp; §8.1 scope honesty + Capability Inventory link. |
| 2026-08-06 | UI waves: §8.2 ops surfaces for Deep L2 modules; selective DBO (SO / loan apply / 3DS). |
