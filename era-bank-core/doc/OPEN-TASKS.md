# OPEN-TASKS — era-bank-core

Living issue tracker for open code debt in the bank engine. Priorities:

| Priority | Meaning |
|----------|---------|
| **P0** | Security — block production go-live |
| **P1** | External integrations still stubbed / mocked |
| **P2** | Risk & regulatory reporting stubs (ties to P8 `banking_risk`) |
| **P3** | Config / hardcode debt |

Related: [DELIVERY-BANK-CORE.md](./DELIVERY-BANK-CORE.md) · [TZ.md](../TZ.md) §12–§14 · ADR index [bank/README.md](../../docs/adr/bank/README.md) · [era-bank-risk-and-audit.md](../../docs/adr/bank/era-bank-risk-and-audit.md) · [era-bank-gl-account-mapping.md](../../docs/adr/bank/era-bank-gl-account-mapping.md) · [era-bank-product-params.md](../../docs/adr/bank/era-bank-product-params.md)

---

## P0 — Security

- [x] **SSO/HMAC signature must verify in production** — [`apps/api/src/auth/bank-auth.guard.ts`](../apps/api/src/auth/bank-auth.guard.ts): HS256 verified with `timingSafeEqual`. Production never skips. Optional decode-without-verify only when `NODE_ENV≠production` **and** `BANK_JWT_ALLOW_INSECURE_DEV=1` **and** secret is not a known placeholder.

## P1 — External integrations (stubs / mocks)

- [ ] **MDM person resolve** — [`apps/api/src/integration/mdm.client.ts`](../apps/api/src/integration/mdm.client.ts): when `MDM_REQUIRED=false` returns `stub-person-*`. Wire real orchestrator MDM `persons/resolve`.
- [ ] **ASAN İmza / SİMA adapter** — live `completeChallenge` remains **fail-closed** (`ConfigError` in `asan-sima.adapter.ts` when `BANK_ASAN_MODE=live`) until partner callback wiring (YC-E3). Stub/sandbox may succeed; do **not** fake live success. CAP-DBO-ASAN stays DECLARED.
- [ ] **MDM trust-tier upgrade** — [`apps/api/src/modules/dbo/dbo-auth.service.ts`](../apps/api/src/modules/dbo/dbo-auth.service.ts) (~L157): currently logs only (`MDM trust upgrade stub`). Publish real identifier trust upgrade to MDM after ASAN/SİMA success.
- [ ] **Payment rails (AZIPS / XÖHKS / AÖS / SWIFT)** — [`apps/api/src/modules/payments/stub-rail.adapter.ts`](../apps/api/src/modules/payments/stub-rail.adapter.ts): `pacs.008 stub`. Implement ISO 20022 adapters per rail.
- [ ] **Card processor gateway** — [`apps/api/src/modules/cards/gateway/mock-azericard.gateway.ts`](../apps/api/src/modules/cards/gateway/mock-azericard.gateway.ts): replace `MockAzeriCardGateway` with AzeriCard / MilliKart live gateway. **P2-8:** live processing blocked on partner — see [`gateway/README.md`](../apps/api/src/modules/cards/gateway/README.md) and [03-external-blockers.md](../../docs/adr/bank/03-external-blockers.md).
- [ ] **Staff provisioning from finance** — [`apps/api/src/integration/finance-bridge.controller.ts`](../apps/api/src/integration/finance-bridge.controller.ts) (~L55): MVP stub — wire to ops user provisioning in production.

## P2 — Risk & reg-reporting stubs

- [~] **P0-5 CBAR templates-as-data** — catalog v2 + BOKT TB pack; credit portfolio from last COMPLETED prudential run; institution filter on list/generate; lab JSON/XLSX export labeled not CBAR-submit-ready. **Follow-up:** official XSD [U], live submit (CAP-REG-CBAR DECLARED).
- [~] **AKB / credit-bureau score** — stub default; `LiveAkbAdapter` behind `BANK_BUREAU_MODE=live` + `BANK_AKB_BASE_URL` / `BANK_AKB_API_KEY` (fail-closed if misconfigured). No certified claim without partner UAT.
- [~] **IFRS 9 staging / ECL** — DPD staging + STAGE_FLAT / PD_LGD lab matrices + maker-checker provision approve. See [reports/ecl-lab-methodology-signoff.md](./reports/ecl-lab-methodology-signoff.md). **Not certified.**
- [~] **P0-3 CBAR prudential classification** — run/result + ümidsiz WO SoD; ops loans list/detail show `cbarPrudentialCategory` from last COMPLETED run; CREDIT_PORTFOLIO assembly wired. **Follow-up:** field UAT (SCREEN not SHOW).
- [~] **LCR / RWA / CAR** — risk owns LCR/NSFR read + RwaSnapshot/CapitalAdequacySnapshot; EOD `steps.lcr`; EOM endpoint; regreporting `CBAR_CAR_STUB` / LCR from risk. Treasury keeps GAP engine only.

## P3 — Config / hardcode debt

- [x] **GL account hardcodes** — product GL codes were constants in loans/deposits; system GL codes were inline literals in treasury/payments/cards/teller/branch. Resolved: product GL from `ProductTemplate.paramsJson` (`getProductGlCode`); system GL from `SystemGlConfig` + `SystemGlConfigService` (`CASH_VAULT`, `NOSTRO`, `MFR_SETTLEMENT`, …, `LOAN_LOSS_EXPENSE`, `LOAN_LOSS_ALLOWANCE`). See ADR [era-bank-gl-account-mapping.md](../../docs/adr/era-bank-gl-account-mapping.md). Apply migration `20260716220000_system_gl_config` (+ `20260805220000_deposit_accrual_loan_repay_ecl`) + `db:seed` before runtime.
- [x] **Deposit EOD accrual** — ACT/365 daily accrual in EOD (`DepositsService.accrueDailyInterest`); rate locked on contract; close pays accrued; rollover capitalizes. See [EOD-HA.md](./EOD-HA.md).
- [x] **P0-1 Posting isolation** — `runSerializableMoneyTx` (Serializable + P2034 retry) + `lockAccountsForUpdate` on `accounts` (`organization_id` + id order) before available check (`posting-money-tx.ts`); idempotent `post` recovers Prisma `P2002` via `findByIdempotencyKey`. Unit helpers in `posting-concurrency.spec.ts`. **Diamond concurrency proof (opt-in DB):** migrated bank DB + `DATABASE_URL` + `BANK_CONCURRENCY_DB_TEST=1` then `npm test -- posting-concurrency` (resolves `bankOrgId` via `BankInstitutionConfig`/`Branch`). Without that evidence do not claim race diamond closed.
- [~] **P0-2 InstitutionType** — Product Factory gates BOKT / `LEASING_COMPANY` / `CREDIT_UNION` (`institution-type.util.ts` + `institution-product-gate.spec.ts`); reg template list/generate filtered by type (BOKT pack). Follow-up: fuller COA seed + entitlement bundles per type.
- [~] **Treasury nostro mirror balances** — `nostroVostroAccount.ledgerBalanceMinor` still incremented/decremented beside posting engine (treasury.service.ts). Not customer CASA race; follow-up to fold into posting or lock nostro rows.
- [x] **P1-6 ECL double collateral** — PD_LGD uses full EAD + LGD haircut once (`ecl.engine.ts`); STAGE_FLAT keeps single EAD netting.
- [~] **Product Factory params + apply-on-originate** — typed `paramsJson` per kind, activate/retire, strict bands, day-count + FLOATING index/spread. Exception pricing dual-control (`PENDING_PRICING_APPROVAL` + approve/reject SoD) **engine landed**; ops UI queue + Product Factory authoring fields remain yellow-clear YC-A3/A4.
- [ ] **Yellow-clear YC-E*** — live rails / cards / ASAN / certified ECL / FMN / pentest / Pilot field — ⏸ until sandbox creds (see `era-bank/doc/CERTIFICATION-TRACK.md`).
- [~] **Capability Inventory SSOT** — OUT vs DECLARED vs IN tracked in [`docs/acceptance/Bank-Capability-Inventory.md`](../../docs/acceptance/Bank-Capability-Inventory.md); BE Lite→Deep waves landed 2026-08-06 (`Bank-BE-Roadmap.md`, signoffs `be-lite/deep1/deep2-signoff.md`). Live/cert still YC-E*.
- [x] **BE Lite→Deep domain APIs** — fee/cash/collections/trade/islamic/wealth + payments SO/VA/cheque + loans-deep + AML RTF/case + IRRBB/OpRisk + EOD steps. Migration `20260806010000_be_lite_deep_extensions`.
