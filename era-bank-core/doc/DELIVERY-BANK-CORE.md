# DELIVERY-BANK-CORE

PRD: [../PRD.md](../PRD.md) · TZ: [../TZ.md](../TZ.md)

## P0 — Foundation

- [x] NestJS monorepo, Prisma kernel schema, CBAR COA seed
- [x] `industry_banking` orchestrator pricing seed
- [x] `@era/contracts` banking events
- [x] Service token + health endpoint
- [x] ESLint kernel/modules boundary

## P1 — Kernel

- [x] Posting engine (ACID, idempotency, approve/reverse)
- [x] CIF / accounts / IBAN generation
- [x] Branch MFR inter-branch settlement
- [x] EOD trial balance
- [x] Unit tests (posting-engine, MFR)

## P2 — Payments

- [x] Payment orders + stub rail adapter
- [x] Account statements

## P3 — Products

- [x] Product factory templates
- [x] Deposits module (open/close/rollover + EOD ACT/365 accrual; rate locked on contract)
- [x] Loans module (schedule waterfall repay: interest then principal; paid* fields; outstanding ↓ by principal only)

## P4 — Compliance

- [x] AML post-commit monitoring (5 rules) + alert workflow API
- [x] Sanction screening (embedded seed) + FMN JSON/XML export
- [x] CBAR templates (trial balance, balance sheet stub, LCR stub) + FATCA/CRS
- [x] `SATELLITE_BANK_AML_ALERT_RAISED` + `SATELLITE_BANK_REG_REPORT_EXPORTED`
- [x] `SATELLITE_BANK_GL_DAILY_SUMMARY` → finance bridge (EOD regSnapshot)

## P5 — DBO engine

- [x] Customer OTP/ASAN auth + short-lived customer JWT
- [x] Scoped accounts, statements, internal transfers
- [x] Payment orders create/sign/submit via payments module wrapper
- [x] Corporate signatory limits + Open API (`X-Api-Key`)
- [x] AML preflight screening + `SATELLITE_BANK_DBO_PAYMENT_SIGNED`

## P6 — Cards

- [x] Card lifecycle API (issue/block/unblock/close/limits) + MockAzeriCardGateway
- [x] Authorize/capture/reverse via CARD_AUTH holds + posting engine settlement
- [x] Acquiring inbound stub + `tools/card-acquiring-stub.mjs`
- [x] EOD CARD_AUTH hold expiry + cardSettlement steps
- [x] AML card rules (MCC, velocity, cross-border) + `SATELLITE_BANK_CARD_*` events
- [x] AML card velocity rule on capture

## P7 — Treasury + hardening

- [x] Nostro/Vostro + FX deals + interbank + gov securities stub + liquidity GAP engine
- [x] Posting-engine settlement for treasury money movement + EOD `steps.treasury`
- [x] `SATELLITE_BANK_TREASURY_GAP_SNAPSHOT` event publish
- [x] Load benchmark tool + PERFORMANCE doc
- [x] Audit replay tool
- [x] On-prem ref-data snapshot bundle (`ERA_DATA_HUB_ONPREM=true`)
- [x] SECURITY-CHECKLIST + EOD-HA docs

## P8 — Risk (`banking_risk`) — PARTIAL scaffold

Spec: [../TZ.md](../TZ.md) §12 · ADR [../../docs/adr/era-bank-risk-and-audit.md](../../docs/adr/era-bank-risk-and-audit.md). Lab ECL/RWA/CAR MVP landed; **certified** methodology + capital ops UI remain yellow-clear (YC-A5/B2/E4). Scaffold landed 2026-08-05.

### Data model & module scaffold

- [x] Prisma risk read-models (`EclCalculationRun`, `EclResult`, `RwaSnapshot`, `CapitalAdequacySnapshot`, `EclParameterSet`) + migrations
- [x] Loan-loss allowance/expense GL codes added to CBAR seed (`LOAN_LOSS_EXPENSE` / `LOAN_LOSS_ALLOWANCE`)
- [x] `modules/risk` routes: dashboard|exposures|collateral|staging|ecl|lcr|nsfr|rwa|capital|large-exposures
- [x] `banking_risk` orchestrator pricing seed + `banking_bundle_universal` inclusion

### Credit risk & IFRS 9 ECL

- [x] DPD → stage helper + unit tests (`loan-risk.util.ts`)
- [~] `ecl.engine.ts`: STAGE_FLAT + PD_LGD matrices — **lab MVP, not certified** ([ecl-lab-methodology-signoff.md](./reports/ecl-lab-methodology-signoff.md))
- [~] `runStaging` on loans via `/risk/staging/run`
- [~] `runEcl` → `PENDING_PROVISION_APPROVAL` + `provision-approve` SoD (not auto-post)
- [~] Collateral JSON on `collateralRef` + loan/risk list APIs (full `CollateralItem` model open)
- [~] Bureau stub + `LiveAkbAdapter` behind `BANK_BUREAU_MODE=live` (fail-closed)

### Capital, liquidity ratios & limits

- [~] `capital.service`: `computeRwa` → `RwaSnapshot`; `capitalAdequacy` → CAR/Tier-1 (MVP weights)
- [~] `largeExposures` concentration register (top N vs capital %)
- [ ] `market-risk.service`: repricing gap + FX open position + sensitivity
- [~] `liquidity-ratio.service`: LCR/NSFR (reads treasury `LiquidityGapSnapshot`; risk owns ratio)
- [ ] `risk-limits.service`: `evaluateBreaches(asOfDate)` + `RiskLimitBreach`

### Integration & events

- [~] EOD daily step `lcr` + floating rate reset recorded in `EodRun.steps`
- [~] EOM `POST /eod/eom` — ECL (pending provision) + RWA/CAR
- [ ] Post-commit hook: recompute affected exposure on posting
- [ ] `SATELLITE_BANK_RISK_STAGE_CHANGED` + `SATELLITE_BANK_RISK_LIMIT_BREACHED` (non-money) contracts + guards
- [~] CAR/LCR consumed by `banking_regreporting` stubs (`CBAR_CAR_STUB` / LCR from risk)

### API & satellite UI

- [~] Engine routes `/api/v1/risk/*` (exposures, staging, ecl, collateral, rwa, capital-adequacy, lcr, nsfr, large-exposures, dashboard) — limits open
- [~] `era-bank` BFF + screens (portfolio|ecl|collateral|dashboard); capital/ALM snippets partial
- [~] i18n en (+ az/ru partial) for risk screens

### DoD

- [~] EOM ECL + maker-checker provision path (lab) — external methodology signoff still required for certified claim
- [~] CAR snapshot feeds `CBAR_CAR_STUB` regreporting template
- [ ] UAT-SMOKE UI path (`doc/UAT-SMOKE.md`) for the risk officer flow
- [ ] Docs updated: COVERAGE_MATRIX / READINESS_MATRIX rows; MODULES_CATALOG status → MVP
