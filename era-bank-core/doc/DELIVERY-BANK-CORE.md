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
