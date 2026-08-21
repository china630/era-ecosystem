# Wholesale — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Wholesale-Product-Readiness-Matrix.md`](./Wholesale-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Negative-path suites landed — `__tests__/ws-ord-negative.spec.ts`, `ws-pick-negative.spec.ts`, `ws-credit-negative.spec.ts`, `ws-plat-negative.spec.ts`. TENANT stays out of BE rollup.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-WS-ORD | B2B order + confirm shipment event | ✅ | [ ] | `__tests__/ws-ord-negative.spec.ts` + DELIVERY-WHOLESALE MVP | Negative: module gate 403; confirm unknown order 404; create validation 400 |
| AC-WS-PICK | Pick lists + line confirm | ✅ | [ ] | `__tests__/ws-pick-negative.spec.ts` + pick-lists API/UI | Negative: qtyPicked over-ordered; missing line/order 404 |
| AC-WS-CREDIT | Credit limit via Finance (live or stub) | ✅ | [ ] | `__tests__/ws-credit-negative.spec.ts` + GET /api/credit-limit | Negative: Finance-down → explicit `env_stub_fallback` / `env_stub` (not silent finance_api); missing counterpartyId 400 |
| AC-WS-PLAT | Platform add-ons on order confirm | ✅ | [ ] | `__tests__/ws-plat-negative.spec.ts` + portal/pay hooks | Negative: events/dispatch missing/wrong token → 401; notify soft-skip when token unset |
| AC-WS-TENANT | SHARED pool: `organizationId` on ops rows + composite uniques | 🟡 | [ ] | CP-TENANT-01; kit tenant extension | **Excluded from Scaffold BE rollup.** Schema + filter landed; not Scaffold ✅ (no live SHARED pool / field two-org UAT) |

**Edition / wave rollup (BE, in-scope)** = worst(ORD, PICK, CREDIT, PLAT) → **✅**.  
AC-WS-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-WS-TENANT | Live SHARED pool + field isolation UAT | Out of BE rollup | Schema+filter only |
| Pilot lab / field | UAT signoff / customer | Out of BE plan | Owned by UI/lab plan |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-wholesale/__tests__/ws-ord-negative.spec.ts` | AC-WS-ORD |
| `era-wholesale/__tests__/ws-pick-negative.spec.ts` | AC-WS-PICK |
| `era-wholesale/__tests__/ws-credit-negative.spec.ts` | AC-WS-CREDIT |
| `era-wholesale/__tests__/ws-plat-negative.spec.ts` | AC-WS-PLAT |
