# OPEN-TASKS — era-bank-core

Living issue tracker for open code debt in the bank engine. Priorities:

| Priority | Meaning |
|----------|---------|
| **P0** | Security — block production go-live |
| **P1** | External integrations still stubbed / mocked |
| **P2** | Risk & regulatory reporting stubs (ties to P8 `banking_risk`) |
| **P3** | Config / hardcode debt |

Related: [DELIVERY-BANK-CORE.md](./DELIVERY-BANK-CORE.md) · [TZ.md](../TZ.md) §12–§14 · ADR [era-bank-risk-and-audit.md](../../docs/adr/era-bank-risk-and-audit.md) · ADR [era-bank-gl-account-mapping.md](../../docs/adr/era-bank-gl-account-mapping.md)

---

## P0 — Security

- [ ] **SSO/HMAC signature must verify in production** — [`apps/api/src/auth/bank-auth.guard.ts`](../apps/api/src/auth/bank-auth.guard.ts) (~L83): dev-mode skips HMAC when secret matches the placeholder; ensure production never uses the skip path.

## P1 — External integrations (stubs / mocks)

- [ ] **MDM person resolve** — [`apps/api/src/integration/mdm.client.ts`](../apps/api/src/integration/mdm.client.ts): when `MDM_REQUIRED=false` returns `stub-person-*`. Wire real orchestrator MDM `persons/resolve`.
- [ ] **ASAN İmza / SİMA adapter** — [`apps/api/src/integration/asan-sima-stub.adapter.ts`](../apps/api/src/integration/asan-sima-stub.adapter.ts) used by DBO auth. Replace with live gov-signature adapter.
- [ ] **MDM trust-tier upgrade** — [`apps/api/src/modules/dbo/dbo-auth.service.ts`](../apps/api/src/modules/dbo/dbo-auth.service.ts) (~L157): currently logs only (`MDM trust upgrade stub`). Publish real identifier trust upgrade to MDM after ASAN/SİMA success.
- [ ] **Payment rails (AZIPS / XÖHKS / AÖS / SWIFT)** — [`apps/api/src/modules/payments/stub-rail.adapter.ts`](../apps/api/src/modules/payments/stub-rail.adapter.ts): `pacs.008 stub`. Implement ISO 20022 adapters per rail.
- [ ] **Card processor gateway** — [`apps/api/src/modules/cards/gateway/mock-azericard.gateway.ts`](../apps/api/src/modules/cards/gateway/mock-azericard.gateway.ts): replace `MockAzeriCardGateway` with AzeriCard / MilliKart live gateway.
- [ ] **Staff provisioning from finance** — [`apps/api/src/integration/finance-bridge.controller.ts`](../apps/api/src/integration/finance-bridge.controller.ts) (~L55): MVP stub — wire to ops user provisioning in production.

## P2 — Risk & reg-reporting stubs

- [ ] **LCR ratio** — [`apps/api/src/modules/treasury/liquidity-gap.engine.ts`](../apps/api/src/modules/treasury/liquidity-gap.engine.ts) `computeLcrRatioStub`; consumed by treasury EOD. Move ownership to `banking_risk` (TZ §12.5 / DELIVERY P8).
- [ ] **CBAR report templates** — [`apps/api/src/modules/regreporting/regreporting.service.ts`](../apps/api/src/modules/regreporting/regreporting.service.ts): `buildBalanceSheetStub` / `buildLcrStub`. Replace with real formulas; RWA/CAR from `banking_risk`.
- [ ] **AKB / credit-bureau score** — [`apps/api/src/modules/loans/loans.service.ts`](../apps/api/src/modules/loans/loans.service.ts) (~L62): `akbScore: 720` hardcoded. Wire AKB / Mərkəzi Kredit Reyestri connector.
- [ ] **IFRS 9 staging / ECL** — [`apps/api/src/modules/loans/loans.service.ts`](../apps/api/src/modules/loans/loans.service.ts) `restructure()` (~L216): manual stage only. Implement via `banking_risk` (TZ §12.4 / DELIVERY P8).

## P3 — Config / hardcode debt

- [x] **GL account hardcodes** — product GL codes were constants in loans/deposits; system GL codes were inline literals in treasury/payments/cards/teller/branch. Resolved: product GL from `ProductTemplate.paramsJson` (`getProductGlCode`); system GL from `SystemGlConfig` + `SystemGlConfigService` (`CASH_VAULT`, `NOSTRO`, `MFR_SETTLEMENT`, …). See ADR [era-bank-gl-account-mapping.md](../../docs/adr/era-bank-gl-account-mapping.md). Apply migration `20260716220000_system_gl_config` + `db:seed` before runtime.
