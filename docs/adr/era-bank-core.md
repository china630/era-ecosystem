# ADR: ERA Bank Core (`banking-core`) and `industry_banking` satellite

**Status:** Accepted (MVP implemented 2026-06-14)
**Decision owners:** Platform architecture.
**Related:** [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [org-operating-mode.md](./org-operating-mode.md) · [CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md) · [era-data-hub.md](./era-data-hub.md) · [satellite-finance-bridge-pattern.md](./satellite-finance-bridge-pattern.md)
**Product docs:** [era-bank-core/PRD.md](../../era-bank-core/PRD.md) · [era-bank-core/TZ.md](../../era-bank-core/TZ.md)

---

## Context

ERA is a corporate ERP/business ecosystem: `era-finance-core` (GL, documents, inventory, HR/payroll, tax), `era-orchestrator` (identity, SSO, billing, entitlements, MDM), `era-data-hub` (reference data), and industry satellites. We want to add a **Core Banking System (CBS)** as a **licensable product** for mid-size banks in Azerbaijan, regulated by the Central Bank of Azerbaijan (**CBAR / AMB**).

A CBS is a different class of software from an ERP. Its central object is **the accounts and products of the bank's thousands of customers** (deposits, loans, cards) plus **interbank payment processing** — not "one company's own bookkeeping". The bank's own bookkeeping is just *one* concern of the CBS, not its purpose.

Key forces:

1. **Money safety.** Customer-money postings need strict **ACID** consistency, not eventual consistency. The existing BullMQ event bus is async fan-out and must **not** be used to move money.
2. **Regulation.** CBAR chart of accounts, prudential reporting, AML/CFT reporting to the Financial Monitoring Service (**Maliyyə Monitorinqi Xidməti / FMN**), deposit insurance (**ADİF**), credit registry (**Mərkəzi Kredit Reyestri** + **AKB** bureau), IFRS 9 provisioning.
3. **One license = one consolidated balance.** A bank is one legal entity, one banking license, one VÖEN, one consolidated regulatory balance. Branches share that VÖEN (distinct **branch codes / MFO**), they are **not** separate legal entities.
4. **Genuine ecosystem reuse, not a bolt-on.** Identity (MDM), the bank's corporate back-office (finance-core), reference data (data-hub), security, SSO and licensing (orchestrator) are real shared assets. Only the banking domain is net-new.

## Decision

### D1 — `banking-core` is a NEW core with its own banking ledger, NOT an extension of `finance-core`

A bank has two distinct accounting worlds and they must not be merged into one database:

| Accounting world | System of record | Object of account |
|------------------|------------------|-------------------|
| **Bank as a financial intermediary** (customer accounts, deposits, loans, cards, interbank, off-balance) | **`banking-core`** (new banking GL + posting engine) | Accounts of thousands of customers |
| **Bank as an enterprise / legal entity** (procurement of ATMs, furniture, supplies inventory, fixed assets, payroll of bank staff, opex, VAT) | **`era-finance-core`** (existing) | The bank's own corporate books |

A customer deposit is a **liability** of the bank posted in `banking-core`. It is **not** a finance-core "cash receipt". Pushing customer transactions through finance-core would break both systems (different consistency, load, and regulatory profile).

### D2 — Three-layer model (universal kernel / pluggable modules / per-bank configuration)

This is the architectural heart and what makes the product **licensable to many banks**.

| Layer | Content | Customized per bank? |
|-------|---------|----------------------|
| **L1 — Universal kernel `banking-core`** | Ledger (double-entry on CBAR chart), ACID posting engine, CIF, balances/holds/limits, EOD/EOM, multi-currency, Product Factory engine, maker-checker, idempotency, immutable audit | **Never** |
| **L2 — Banking modules (products)** | Deposits, loans, cards, payments, AML, treasury, digital banking, regulatory reporting | **Toggled** on/off per bank |
| **L3 — Product configuration (Product Factory)** | Concrete rates, terms, fees, schedules, limits | **Fully**, by the bank, no code |

**Invariant (the thin-kernel rule):** L1 contains no code that is true only for one bank or one product. If logic depends on product type → it lives in an L2 module. If it depends on a specific bank's conditions → it lives in L3 configuration. This rule is non-negotiable and must be enforced in review.

### D3 — Commercial taxonomy reuses the existing satellite + module pattern (like Hotel PMS)

The product is published as the **`industry_banking`** satellite with pluggable `banking_*` module keys, exactly mirroring how `era-hotel-pms` uses 9 `hotel_*` submodule keys. (The satellite app that carries the `industry_banking` gate is **`era-bank`**; the regulated engine is **`era-bank-core`** — see D9.)

| Layer | Key(s) | `catalog_kind` |
|-------|--------|----------------|
| Satellite gate | `industry_banking` | `SATELLITE` |
| Modules | `banking_core`, `banking_deposits`, `banking_loans`, `banking_cards`, `banking_payments`, `banking_aml`, `banking_treasury`, `banking_dbo`, `banking_regreporting` | `MODULE` (`satellite_key = industry_banking`) |
| Bundles | `banking_bundle_retail`, `banking_bundle_universal` | bundle |
| Branch quota | metered `active_branches` | tier quota |

Licensing per bank = activation of the satellite + a set of modules **per deployment** (one deployment = one bank). The **number of active branches is a metered quota** (see D5).

### D4 — MDM is shared, never duplicated; `banking-core` builds CIF on top of it

- `banking-core` stores only **`globalPersonId`** (reference to orchestrator MDM `GlobalNaturalPerson`) on a customer plus bank-specific KYC attributes (risk rating, PEP flag, beneficial owners, source of funds).
- PII identity (FIN/passport/residence, encryption, foreigner→citizen merge) stays in MDM, exactly as `Guest`/`PatientRef`/`Employee` refs do today.
- This **strengthens** the ecosystem: a person who is a bank customer, hotel guest, clinic patient and finance employee resolves to **one `globalPersonId`** — a cross-product identity graph no classic CBS vendor has. Bank KYC with trust tier `GOVERNMENT_VERIFIED` (ASAN İmza / SİMA) enriches identity for all products.

### D5 — Branches are an internal `Branch` dimension, NOT separate orgs

The dividing line is **VÖEN / license**, not the name of the core:

| Case | finance-core | banking-core |
|------|--------------|--------------|
| **Branch** (same VÖEN, same license) | internal **cost-center / org-unit dimension** inside the ONE bank org — **not** a separate org | **`Branch`** dimension on accounts/postings/cash/limits/reporting |
| **Subsidiary** (own VÖEN, own license — a banking group member) | separate **`STANDALONE`** org linked by `holdingId` | separate **deployment** + group consolidation |

- **`DEPARTMENT` operating mode is the wrong tool for bank branches.** Era `DEPARTMENT` is a separate org with its own DB and async money-routing to a parent (designed for "a clinic inside a hotel"). A bank branch needs the opposite: one consolidated, strongly-consistent balance and real-time cross-branch account servicing.
- **Inter-branch settlement (МФР)** is **branch-tagged double-entry inside the single ACID ledger**, not cross-org routing. It nets to zero in EOD because the balance is physically one. See TZ §7.
- Because a branch is a dimension (not an org), **active branches can be metered as a clean quota** at the bank-org level — like users/invoices/storage today.

### D6 — Consistency model (non-negotiable kernel properties)

| Property | Requirement |
|----------|-------------|
| **ACID, not eventual** | Every money posting is one DB transaction (Serializable / repeatable-read) inside `banking-core`. No money in BullMQ. |
| **Double-entry invariant** | Σ Debit = Σ Credit per transaction (proven pattern in finance-core: internal transfer acct 231, FX conversion 662/762). |
| **Idempotency** | Every operation carries an idempotency key; replays never double-post (critical for payment rails). |
| **Maker-checker (4-eyes)** | Separation of duties on postings/limits — extends Advanced RBAC. |
| **Immutable audit** | Every CIF field change and every posting is appended to an immutable log (pattern: `AuditMutationInterceptor`). |
| **EOD as a transactional process** | Interest accrual, FX revaluation, amortization, balance close, regulatory day snapshot — strict timing. |

The BullMQ event bus remains, but only for **notifications, statements, analytics, and compensating sagas** — never for moving money.

### D7 — Boundary and seam between `banking-core` and `finance-core`

- `banking-core` owns the **regulated banking balance** reported to CBAR (customer subledgers + banking chart of accounts + EOD).
- `finance-core` owns the **bank's corporate books** (opex, payroll, fixed assets, procurement, supplies inventory, VAT) — finance-core is the bank's back-office ERP.
- Seam: `finance-core` posts summarized corporate journals; the statutory banking GL of record is `banking-core`. Connection is by **summarized postings / events**, never by sharing an operational DB (same discipline as the satellite ↔ finance bridge). See TZ §10.
- Staff identity/HR provisioning flows finance → banking-core via the existing `STAFF_PROVISIONED` contract family.

### D8 — Deployment and licensing for selling to banks

- **One deployment = one bank** (`ERA_BANK_ORGANIZATION_ID`), consistent with the satellite "one deployment = one org" law.
- **On-prem / private-cloud capable**: AZ banks frequently require data inside their perimeter. The regulated engine (`era-bank-core`) must run isolated, including an **on-prem reference data mode** (no dependency on the public `data-hub`).
- Crypto keys (`PII_ENCRYPTION_KEY`, `PII_BLIND_INDEX_KEY`) held by the bank; identical across MDM resolve paths where cross-system resolution is used.
- Licensing/activation through orchestrator (`industry_banking` gate + module set), but a bank license is a contract + activation key rather than SMB post-paid metering.

### D9 — Two-app topology: headless engine `era-bank-core` + operational satellite `era-bank`

Unlike an ops-only satellite (hotel = one app), a regulated CBS separates the **certifiable ledger engine** from the **operational/channel apps** that consume it. This mirrors how real banks run a core banking engine behind multiple front/channel systems.

| App | Role | UI | Owns | Port / DB |
|-----|------|----|------|-----------|
| **`era-bank-core`** | **Headless regulated engine** (system of record) | No | Banking ledger (CBAR), ACID posting engine, CIF, EOD/EOM, Product Factory, `Branch`/МФР, audit, and the regulated **product engines** (deposit/loan/card/payment/aml/treasury/regreporting math + API) | API `:4300`, DB `era_bank_core` |
| **`era-bank`** | **Operational satellite** (carries `industry_banking` gate) | Yes | Teller/back-office/risk/compliance screens, operational workflow, local ops users/roles/sessions, entitlement gating; **consumes `era-bank-core` API** | web+`/api` `:3210`, DB `era_bank` (operational/UI state only) |
| (future) `era-bank-dbo` | Customer channel (mobile/internet bank, Open API) | Yes | Self-service channels; consumes `era-bank-core` API | later |

Rules:
- **No money or ledger state in `era-bank` or channel apps.** They call the engine; the engine posts (ADR D6). `era-bank`'s DB holds only operational/UI state (ops users, sessions, screen workflow), never customer balances.
- A **`banking_*` module spans both apps**: the regulated math/API in `era-bank-core` + the operational UI in `era-bank`. The commercial key gates both.
- Engine ↔ satellite link is an **internal API** (service token), same discipline as satellite ↔ finance: no shared DB.
- The three-layer model (D2) is unchanged; it now maps onto: L1+L2-engines in `era-bank-core`, L2-UI in `era-bank`, L3 config authored via `era-bank` UI but stored/enforced in `era-bank-core`.

## Consequences

**Positive**

- Clean separation: finance-core untouched as the bank's corporate ERP; the regulated ledger is new and uncompromised.
- Real ecosystem reuse (MDM, data-hub, finance-core back-office, security, SSO, licensing) — ~30–40% horizontal head start; the cross-product identity graph is a differentiator.
- Branch-as-dimension yields a clean per-branch billing quota.
- Three-layer model lets one kernel serve all banks while each configures products without code.

**Negative / costs**

- Net-new banking domain (~60–70% of effort): posting engine, EOD, banking products, payment rails (AZIPS / XÖHKS / AÖS / SWIFT), AML, CBAR reporting. Multi-year scope requiring banking domain expertise.
- Card issuing/acquiring is capital-intensive; prefer integrating an existing processor (AzeriCard / MilliKart) before building issuing.
- Regulatory certification and security audits gate go-live.

**Risks**

- Kernel leakage (bank/product-specific logic into L1) — mitigated by the D2 thin-kernel rule in review.
- Using the event bus for money — explicitly forbidden by D6.
- Modeling branches as orgs/DEPARTMENTs — explicitly forbidden by D5.

## Alternatives considered

1. **Extend `finance-core` into a bank ledger.** Rejected: mixes two accounting worlds, breaks finance-core consistency/performance, and cannot satisfy CBAR banking chart and EOD.
2. **Middle-office on top of a legacy CBS.** Viable for a specific bank, but does not yield a licensable product; rejected as the primary strategy (kept as a possible delivery mode).
3. **Bank as `finance-core` back-office only (no customer ledger).** Real but partial; does not deliver a CBS. Adopted only as the finance-core role *within* this decision (D7).

## Implementation references (target)

- Engine: `era-bank-core/` (NestJS API, **headless**), DB `era_bank_core`, API `:4300`. Spec: [era-bank-core/TZ.md](../../era-bank-core/TZ.md).
- Satellite: `era-bank/` (Next.js, `industry_banking` gate), DB `era_bank`, `:3210`. Spec: [era-bank/PRD.md](../../era-bank/PRD.md) · [era-bank/TZ.md](../../era-bank/TZ.md).
- Product-line lead doc: [era-bank-core/PRD.md](../../era-bank-core/PRD.md). Ports/env: [ECOSYSTEM_URLS.md](../ECOSYSTEM_URLS.md).
- Contracts: `packages/era-contracts/src/events/banking.events.ts` (see TZ §9).
- Consumes: orchestrator SSO/RBAC/MDM/entitlements; data-hub FX/banks/IBAN/COA template/calendar.
- Phases and DoD: [era-bank-core/PRD.md](../../era-bank-core/PRD.md) §7 and [era-bank-core/TZ.md](../../era-bank-core/TZ.md) §14.
- Risk management & audit chain: [era-bank-core/TZ.md](../../era-bank-core/TZ.md) §12–§13 and ADR [era-bank-risk-and-audit.md](./era-bank-risk-and-audit.md).
- GL account mapping (product + system): ADR [era-bank-gl-account-mapping.md](./era-bank-gl-account-mapping.md); open code debt tracker [OPEN-TASKS.md](../../era-bank-core/doc/OPEN-TASKS.md).
