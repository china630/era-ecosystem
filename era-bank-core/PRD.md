# ERA Bank Core — Product Requirements Document (PRD)

**Product line:** Core Banking System (CBS). This is the **product-line lead doc**.
**Apps:** `era-bank-core` (headless regulated engine) + `era-bank` (operational satellite, `industry_banking` gate) + future `era-bank-dbo` (customer channels). See ADR D9.
**Status:** Proposed / pre-development. This document is the development-ready product spec.
**Audience:** mid-size universal/retail bank in Azerbaijan (CBAR / AMB regulated).
**Companion docs:** [TZ.md](./TZ.md) (engine technical spec) · satellite [era-bank/PRD.md](../era-bank/PRD.md) · [era-bank/TZ.md](../era-bank/TZ.md) · ADR [docs/adr/era-bank-core.md](../docs/adr/era-bank-core.md)
**Language law:** product chat — Russian; this repo doc — English.

> **Topology (ADR D9):** `era-bank-core` is **headless** — it owns the regulated ledger, ACID posting engine, CIF, EOD, and the product engines, exposed only via API. The operational UI (teller/back-office/risk/compliance screens, workflow, local ops users) lives in the **`era-bank`** satellite, which consumes the engine. No money or ledger state exists outside `era-bank-core`. This PRD covers the whole product line; the satellite's UI scope is detailed in [era-bank/PRD.md](../era-bank/PRD.md).

---

## §1. Vision

`era-bank-core` is a **Core Banking System (CBS)** delivered as a new core inside the ERA ecosystem and licensed to banks. Its purpose is to keep the **regulated banking balance** of a bank — the accounts, deposits, loans, cards and payments of the bank's customers — with mathematically exact double-entry, ACID consistency, and full CBAR regulatory compliance.

It is **not** a corporate ERP. The bank's own enterprise bookkeeping (procurement, payroll of staff, fixed assets, supplies, VAT) is handled by `era-finance-core`. `era-bank-core` is the bank-as-intermediary; `finance-core` is the bank-as-company. See [ADR](../docs/adr/era-bank-core.md) D1/D7.

### 1.1. Product principles

- **Thin universal kernel.** One kernel serves all banks; differences live in pluggable modules and per-bank configuration (Product Factory). See ADR D2.
- **Money is ACID.** All customer-money postings are strongly consistent; the event bus never moves money. See ADR D6.
- **One license = one consolidated balance.** Branches are an internal dimension, never separate orgs. See ADR D5.
- **Reuse, don't duplicate.** Identity (MDM), reference data (data-hub), corporate back-office (finance-core), SSO/RBAC/licensing (orchestrator), security layer — all shared. See ADR D4/D7.
- **Compliance is "done".** A banking feature is incomplete until its regulatory reporting/audit obligation is covered.

### 1.2. Value proposition

| Stakeholder | Value |
|-------------|-------|
| Bank | A modern, configurable CBS with AZ regulatory coverage; per-module + per-branch commercial model; on-prem capable. |
| ERA ecosystem | New product line; a unified cross-product identity graph (one `globalPersonId`); finance-core becomes the bank's back-office ERP. |
| Bank customer | Real-time accounts, instant payments (AÖS), deposits/loans, cards, digital banking. |

## §2. Benchmark reference

Architectural reference: cloud-native CBS — **Thought Machine Vault** (ledger + smart-contract products), **Mambu** (composable core, product configuration). ERA differentiator: native identity graph (MDM) and an in-house corporate ERP (finance-core) for the bank itself.

AZ regulatory landscape: **CBAR / AMB** (regulator, banking chart of accounts, prudential reporting), **AZIPS** (RTGS, large-value), **XÖHKS** (low-value clearing), **AÖS** (Instant Payment System), **SWIFT / ISO 20022**, **FMN** (Financial Monitoring Service — AML/CFT), **ADİF** (deposit insurance), **Mərkəzi Kredit Reyestri** + **AKB** (credit registry/bureau), **ƏMDK** (real-estate/collateral registry), **ASAN İmza / SİMA** (digital signature), **FATCA / CRS**.

## §3. Personas & roles

| Persona | Channel / login | Notes |
|---------|-----------------|-------|
| Teller / operations officer (branch) | Local operational login (branch-bound) | Posts customer transactions within branch limits; maker side of 4-eyes |
| Branch manager | Local login + elevated role | Checker side of 4-eyes; branch limits |
| Back-office (deposits/loans/cards officer) | Local login | Product servicing |
| Risk / credit officer | Local login | Scoring, collateral, provisioning |
| Compliance / AML officer | Local login | Monitoring, screening, FMN reporting |
| Treasury / ALM | Local login | Liquidity, FX, interbank, securities |
| Accountant / reporting | Local login | CBAR prudential reporting, GL |
| Bank owner / executive | **SSO** from orchestrator launcher | Cross-org view; entitlements; no customer-money actions by default |
| Platform super-admin (ERA) | Orchestrator | Licensing, module activation, support (no PII by policy) |
| End customer (retail/corporate) | Digital banking (mobile/internet) + ASAN İmza | Self-service; not an ERA platform user |

Identity: staff use local operational auth (branch-bound), owners/management use orchestrator SSO — same two-contour model as other satellites ([era-architecture-boundaries](../.cursor/rules/era-architecture-boundaries.mdc)). Customer-money actions require maker-checker per role and branch limits.

## §4. Modules

Module IDs are the commercial `banking_*` keys. **`banking_core` is mandatory**; the rest are pluggable (ADR D3). Status legend: **CORE** (kernel L1) · **MVP target** · **vNext**.

### 4.1. `banking_core` — Universal kernel (L1, mandatory)

| Capability | Summary |
|------------|---------|
| Banking General Ledger | Double-entry on **CBAR chart of accounts**; balance + off-balance; multi-currency (AZN base) |
| Posting engine | ACID, idempotent, maker-checker, holds/limits, reversals |
| CIF (Customer Information File) | Customer master keyed on `globalPersonId` (physical) / VÖEN (legal) + KYC attributes |
| Accounts | Current/demand accounts, IBAN, statuses, blocks, arrests/holds |
| Balances & limits | Available vs ledger balance, overdraft, reservations |
| Multi-currency & FX | Multi-currency accounts, position revaluation, FX differences |
| EOD / EOM | Interest accrual, revaluation, amortization, day close, regulatory snapshot |
| Product Factory | Parameterized products (rates/terms/fees) without code (L3 config engine) |
| Branch dimension | `Branch` org-unit on accounts/postings/cash/limits; inter-branch settlement (МФР) |
| Immutable audit | Append-only log of postings and CIF changes |

### 4.2. Pluggable banking modules (L2)

| Module key | Module | Core capability | AZ specifics |
|------------|--------|-----------------|--------------|
| `banking_deposits` | Deposits / savings | Term/savings products, simple & compound interest, capitalization, early termination, rollover | **ADİF** insured-deposit tagging & reporting |
| `banking_loans` | Lending / loan origination | Disbursement, annuity/differentiated schedules, accruals, overdue/NPL, restructuring, collateral | **AKB / Mərkəzi Kredit Reyestri**, **ƏMDK** collateral, **IFRS 9** ECL staging |
| `banking_cards` | Cards | Card lifecycle, limits, card transactions; issuing/acquiring via gateway | **AzeriCard / MilliKart** processing; Visa/Mastercard |
| `banking_payments` | Payments hub | Internal, then interbank routing; payment orders; statements | **AZIPS** (RTGS), **XÖHKS** (clearing), **AÖS** (instant), **SWIFT / ISO 20022** |
| `banking_aml` | AML / CFT / KYC | Transaction monitoring, sanction screening, suspicious-tx workflow | **FMN** reporting; OFAC/EU/UN lists (via data-hub shelf C) |
| `banking_treasury` | Treasury / ALM | Liquidity, FX dealing, interbank, securities (GS), GAP analysis | AZ government-securities market; Nostro/Vostro |
| `banking_dbo` | Digital banking (ДБО) | Mobile bank (retail), internet bank (corporate B2B), Open API | **AÖS** overlay, **ASAN İmza / SİMA** auth/sign |
| `banking_regreporting` | Regulatory reporting | Prudential reporting, statutory GL exports | **CBAR** templates; **FATCA / CRS** |

### 4.3. Cross-cutting (delivered by kernel + orchestrator)

| Area | Where |
|------|-------|
| IAM / RBAC / SoD / maker-checker | orchestrator RBAC + kernel posting guards |
| Identity / digital signature | orchestrator MDM + ASAN İmza / SİMA adapter |
| Reference data (FX, banks, IBAN, COA, calendar) | `era-data-hub` (on-prem mode for isolated deployments) |
| Reconciliation | kernel (cards, Nostro, interbank, GL) |
| Multi-branch | kernel `Branch` dimension |
| Notifications / statements | orchestrator platform notifications (SMS/email/push) |
| Reporting / BI / MIS | kernel read models + exports |

## §5. User stories (representative, by module)

**Core / accounts**
- As a teller, I open a current account for an existing customer (resolved by `globalPersonId`), and the system issues an IBAN and posts the opening entry atomically.
- As a teller in branch B, I process a withdrawal for a customer whose account belongs to branch A; the system posts a balanced inter-branch settlement (МФР) in one transaction.
- As the system at EOD, I accrue interest, revalue FX positions, and produce the regulatory day snapshot with Σ Debit = Σ Credit.

**Deposits**
- As a back-office officer, I open a term deposit from a configured product (12% / 6m / monthly capitalization) without code; the system schedules accruals and flags ADİF coverage.

**Loans**
- As a credit officer, I originate a loan: pull bureau data (AKB / credit registry), register collateral (ƏMDK), generate an annuity schedule, and stage the exposure per IFRS 9.

**Payments**
- As a corporate customer, I submit a payment order via internet bank; the hub routes it (internal / XÖHKS / AZIPS / AÖS) and posts atomically with idempotency.

**AML**
- As a compliance officer, I review a flagged transaction, screen the counterparty against sanction lists, and file a report to FMN.

## §6. Integrations

| Integration | Direction | Mechanism |
|-------------|-----------|-----------|
| MDM (CIF identity) | bank-core → orchestrator | resolve/store `globalPersonId` (ADR D4); never duplicate PII |
| SSO / RBAC / entitlements | orchestrator → bank-core | JWT (RS256/HS256), `industry_banking` + module gates |
| Reference data | data-hub → bank-core | FX/ЦБА, banks/branches, IBAN, COA template, calendar; on-prem mode supported |
| HR / staff provisioning | finance-core → bank-core | `STAFF_PROVISIONED` / `STAFF_DEACTIVATED` contract family |
| Corporate back-office | bank-core ↔ finance-core | summarized corporate journals / events (ADR D7); no shared operational DB |
| AZIPS / XÖHKS / AÖS / SWIFT | bank-core ↔ CBAR rails | ISO 20022 messaging adapters (`banking_payments`) |
| Card processing | bank-core ↔ AzeriCard / MilliKart | gateway API (`banking_cards`) |
| Credit registry / collateral | bank-core ↔ AKB / Mərkəzi Kredit Reyestri / ƏMDK | `banking_loans` connectors |
| Deposit insurance | bank-core → ADİF | `banking_deposits` reporting |
| AML reporting | bank-core → FMN | `banking_aml` reporting |
| Digital signature | bank-core ↔ ASAN İmza / SİMA | `banking_dbo` auth/sign adapter |
| Notifications | bank-core → orchestrator platform | SMS/email/push, statements |

## §7. Release phases

Reference: ADR D6 (consistency), TZ §14 (DoD per phase); risk management TZ §12 + ADR [era-bank-risk-and-audit.md](../docs/adr/era-bank-risk-and-audit.md).

| Phase | Scope | Gate |
|-------|-------|------|
| **P0 — Foundation** | New core `era-bank-core` on orchestrator SSO; CBAR chart from data-hub; CIF on MDM; `Branch` dimension; Product Factory skeleton | Service boots; SSO; entitlement gate `industry_banking` |
| **P1 — Kernel MVP** | ACID posting engine + current accounts + holds/limits + EOD/EOM + multi-currency + immutable audit + МФР | Balanced EOD; idempotent postings; maker-checker |
| **P2 — RCO & payments** | Payment orders; internal transfers; then **AZIPS / XÖHKS / AÖS** adapters; statements | Live internal + ≥1 external rail (ISO 20022) |
| **P3 — Products** | `banking_deposits` (+ADİF), `banking_loans` (scoring, AKB/registry, ƏMDK, IFRS 9 ECL) | Deposit & loan lifecycle end-to-end |
| **P4 — Compliance** | `banking_aml` (monitoring + screening + FMN), `banking_regreporting` (CBAR prudential, FATCA/CRS) | Reg reports accepted in test |
| **P5 — Channels** | `banking_dbo` (mobile/internet bank, Open API, ASAN İmza/SİMA) | Customer self-service live |
| **P6 — Cards** | `banking_cards` issuing + AzeriCard/MilliKart gateway, acquiring | Card lifecycle + processing |
| **P7 — Treasury/ALM** | `banking_treasury` (liquidity, interbank, GS, GAP) | ALM dashboards |

Cards/treasury are capital-intensive; integrate external processing first where possible.

## §8. Finance boundary

`era-bank-core` (regulated banking balance) vs `era-finance-core` (bank's corporate books). The bank's own opex/payroll/fixed-assets/procurement/inventory/VAT go through finance-core; customer accounts/deposits/loans/cards/interbank stay in bank-core. The statutory banking GL of record is bank-core; finance-core contributes summarized corporate journals. Connection by summarized postings/events only — never a shared operational DB. Full rules: ADR D1/D7, TZ §10.

## §9. Commercial model

Reuses orchestrator pricing taxonomy (ADR D3, [CONTROL_PLANE_ARCHITECTURE.md](../docs/CONTROL_PLANE_ARCHITECTURE.md)):

| Axis | What is sold | Mechanism |
|------|--------------|-----------|
| License | `industry_banking` activation per bank | per-deployment license/activation key |
| Modules | `banking_deposits`, `banking_loans`, `banking_cards`, … on/off | `pricing_modules` (`catalog_kind = MODULE`) |
| Bundles | `banking_bundle_retail`, `banking_bundle_universal` | bundle discounts |
| Branch quota | number of active `Branch` records | metered `active_branches` quota |

## §10. Non-functional requirements

| NFR | Target |
|-----|--------|
| Consistency | ACID for all postings; Σ Debit = Σ Credit invariant enforced (ADR D6) |
| Availability | Core posting path HA; EOD windowed; degraded read during EOD acceptable |
| Idempotency | All mutating endpoints idempotency-keyed |
| Security | Envelope encryption (DEK/KEK), blind-index, immutable audit, maker-checker, SoD; keys held by bank in on-prem mode |
| Compliance | CBAR chart + prudential reporting; AML/FMN; ADİF; FATCA/CRS; data residency (on-prem) |
| Localization | AZN base, +994, VÖEN, FIN, UTC in DB / Asia/Baku display, locales az/ru/en |
| Auditability | Every posting and CIF change reconstructable; replay-safe |
| Performance | Posting engine sized for the bank's peak TPS; EOD within regulatory window |

## §11. Out of scope (initial product)

- In-house card scheme / switch (use external processor integration first).
- Capital markets front-office trading beyond treasury basics.
- Non-AZ regulatory regimes (parametrized later via L3/reference data).

## §12. Changelog

| Date | Change |
|------|--------|
| 2026-06-08 | Initial PRD: kernel `banking_core`, modules `banking_*`, AZ regulatory map, phases P0–P7, commercial model, finance boundary. Companion to ADR `era-bank-core.md` and `TZ.md`. |
