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
- [x] Deposits module
- [x] Loans module

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

## P8 — Risk (`banking_risk`) — PROPOSED

Spec: [../TZ.md](../TZ.md) §12 · ADR [../../docs/adr/era-bank-risk-and-audit.md](../../docs/adr/era-bank-risk-and-audit.md). Status **PROPOSED / pre-development** — all items open. Rule: risk computes read-models; provisions post through the kernel posting engine (no parallel ledger).

### Data model & module scaffold

- [ ] Prisma risk read-models (`RiskExposure`, `EclCalculationRun`, `EclResult`, `CollateralItem`, `CollateralValuation`, `RwaSnapshot`, `CapitalAdequacySnapshot`, `LargeExposure`, `RiskLimit`, `RiskLimitBreach`) + migration
- [ ] Loan-loss allowance/expense GL codes added to CBAR seed
- [ ] `modules/risk` module wired; imports kernel `PostingEngineService` only (boundary lint green)
- [ ] `banking_risk` orchestrator pricing seed + `banking_bundle_universal` inclusion

### Credit risk & IFRS 9 ECL

- [ ] `staging.engine.ts` (pure): `stageFromDpd`, `isSicr`, `isNpl` + unit tests
- [ ] `ecl.engine.ts` (pure): `pd`/`lgd`/`ead`/`eclAmount` + unit tests
- [ ] `credit-risk.service`: `runStaging(asOfDate)` updates `RiskExposure.stage`/NPL from DPD
- [ ] `runEclBatch(asOfDate)` writes `EclResult`; `postProvisions(runId)` posts balanced allowance/expense txn via kernel (idempotent on `runId`, maker-checker)
- [ ] Collateral valuation + haircut feeding LGD (`valuateCollateral`)
- [ ] Bureau score consumed from `banking_loans` origination (replace `akbScore: 720` stub)

### Capital, liquidity ratios & limits

- [ ] `capital.service`: `computeRwa` → `RwaSnapshot`; `capitalAdequacy` → CAR/Tier-1 snapshot
- [ ] `largeExposures` concentration register
- [ ] `market-risk.service`: repricing gap + FX open position + sensitivity
- [ ] `liquidity-ratio.service`: LCR/NSFR (reads treasury `LiquidityGapSnapshot`; own the ratio, treasury keeps GAP)
- [ ] `risk-limits.service`: `evaluateBreaches(asOfDate)` + `RiskLimitBreach`

### Integration & events

- [ ] EOD daily steps (staging, breach eval, LCR) recorded in `EodRun.steps`
- [ ] EOM steps (ECL run + post-provisions, RWA + CAR snapshot)
- [ ] Post-commit hook: recompute affected exposure on posting
- [ ] `SATELLITE_BANK_RISK_STAGE_CHANGED` + `SATELLITE_BANK_RISK_LIMIT_BREACHED` (non-money) contracts + guards
- [ ] CAR/ECL outputs consumed by `banking_regreporting`

### API & satellite UI

- [ ] Engine routes `/api/v1/risk/*` (exposures, staging, ecl, collateral, rwa, capital-adequacy, lcr, nsfr, limits, dashboard)
- [ ] `era-bank` BFF proxy + screens (`risk/portfolio|ecl|collateral|capital|alm|limits|dashboard`), role `Risk / credit officer`
- [ ] i18n en/az/ru for risk screens

### DoD

- [ ] EOM ECL run posts a balanced provision transaction (Σ Dr=Σ Cr) with maker-checker + immutable audit
- [ ] CAR snapshot feeds a `banking_regreporting` template
- [ ] UAT-SMOKE UI path (`doc/UAT-SMOKE.md`) for the risk officer flow
- [ ] Docs updated: COVERAGE_MATRIX / READINESS_MATRIX rows; MODULES_CATALOG status → MVP
