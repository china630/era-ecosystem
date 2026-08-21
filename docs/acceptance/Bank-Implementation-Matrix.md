# Bank — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Bank-Product-Readiness-Matrix.md`](./Bank-Product-Readiness-Matrix.md)  
**Not full ABS map:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md) (OUT ≠ missing AC row)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-BNK-CORE | Posting engine + GL kernel | ✅ | [ ] | banking_core MVP; HMAC HS256 verify; EOD external post **423**; unbalanced reject tests | Negative: bad/expired JWT, EOD lock; Pilot field still open |
| AC-BNK-OPS | Ops teller UX (modal CRUD) | ✅ | [ ] | DELIVERY-BANK; Product Factory apply-from-template; CatalogField; no demo-auth defaults | Call ops-mvp not edition ga |
| AC-BNK-PAY | Payments / deposits / loans | ✅ | [ ] | module MVP+posting; staff approve SoD; deposit EOD accrual; repay-by-schedule; ACTIVE product params; exception pricing ops UI | Stub rails (YC-E1); live AKB = flag (YC-E4); negative: overpay remainingUnallocated, pricing SoD |
| AC-BNK-PROD | Product Factory L3 | ✅ | [ ] | paramsJson contract; activate/retire; strict bands; day-count + FLOATING authoring UI | Exception pricing dual-control engine+ops (YC-A3); certification separate |
| AC-BNK-REG | AML / regreporting / cards / treasury / risk hub | ✅ | [ ] | MVP modules + `/risk` + `/risk/capital` lab | Certification track YC-E*; methodology=lab |
| AC-BNK-PAY-APPR | Payment staff checker queue | ✅ | [ ] | PENDING_APPROVAL + approve/reject; list SoD + reject reason; unit SoD tests | Live rails remain STUB (YC-E1) |
| AC-BNK-RISK | Loan bureau/collateral/NPL + risk hub | ✅ | [ ] | stub+live AKB flag; DPD; STAGE_FLAT/PD_LGD lab ECL + SoD provision; LCR/RWA/CAR MVP — **methodology=lab, not certified**; capital UI | Pilot-ready blocked until YC-E4 |
| AC-BNK-FEE | Fee tariff CRUD + assess post | ✅ | [ ] | BE Lite→Deep; SystemGl FEE_*; negative unknown tariff + short idempotency | Ops `/fees` UI; `be-lite-fee.spec.ts` |
| AC-BNK-CASH | Cash vault/till + inventory + queue | ✅ | [ ] | banking_cash; posting vault↔till; EOD sdbRent | Ops `/cash` UI; UAT step 17 |
| AC-BNK-COLL | Collections cases / PTP / recovery SoD | ✅ | [ ] | banking_collections; SoD self-approve reject | Ops `/collections` UI; UAT SoD negative |
| AC-BNK-TRADE | Trade finance LC/BG/DC/SCF/SWIFT stub | ✅ | [ ] | banking_trade; contingent GL; SENT_STUB | Ops `/trade` UI; live SWIFT YC-E |
| AC-BNK-SO | Standing orders / VA / cheque / sweep | ✅ | [ ] | payments extensions; EOD SO run | Ops `/payments/extras` + DBO SO; rails stub |
| AC-BNK-LN-WF | Loan application WF + credit line + score | ✅ | [ ] | loans-deep; SoD on book | Ops apps/credit-lines + DBO apply |
| AC-BNK-ISL | Islamic window contracts | ✅ | [ ] | banking_islamic lab activate post | Ops `/islamic` + DBO read-only |
| AC-BNK-WEALTH | Custody safekeeping thin | ✅ | [ ] | banking_wealth; FOP receive; no FO | Ops `/wealth`; Derivatives FO OUT |
| AC-BNK-AML-RTF | AML case + fraud score lab | ✅ | [ ] | aml cases + `/aml/fraud/score` | Ops `/aml/cases`; live feed BLOCKED |
| AC-BNK-DBO-H2H | DBO H2H + OB consent API | ✅ | [ ] | dbo-ops | ASAN live YC-E3 |
| AC-BANK-TENANT | `organizationId` + kit Prisma filter on bank / dbo / core rows | 🟡 | [ ] | CP-TENANT-01; B7 schema+migration+mergeWhere tests; fail-closed unbound | **Excluded from Scaffold BE rollup.** Same remaining work as hotel/clinic TENANT (live pool + field UAT). Not a bank-only ban. Bind HTTP + runtime-config + Sync `industry_banking` landed (CP-BIND-01 / CP-CFG-01) — not a pool |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-BANK-TENANT).  
AC-BANK-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT — **same bar as AC-HOT-TENANT / AC-CLI-TENANT**.  
Do not call this table «product readiness».  
Do not treat in-scope AC ✅ as coverage of Capability Inventory **OUT** rows (ATM scheme, derivatives FO, certified Basel, PEN/PSA, enterprise MIS/BPM/DMS, …).  
BE tracker: [Bank-BE-Roadmap.md](./Bank-BE-Roadmap.md).

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-BANK-TENANT | Live SHARED bank pool + field isolation UAT | Out of BE rollup | Schema+filter only; same as hotel/clinic TENANT |
| (Capability Inventory — not AC) | Live payment rails / AKB / ASAN / SWIFT / bureau | External ⏸ | Inventory DECLARED/STUB — not an AC row; does not flip AC Scaffold |
| (in-scope AC ✅ rows) | Field Pilot / certification tracks | Out of BE plan | Owned by Pilot / YC-E* |

### Negative-path proof index

| Suite | AC |
|-------|----|
| existing engine / ops SoD + UAT negatives (see Proof column) | AC-BNK-* in-scope ✅ |
| pending SHARED-pool field UAT | AC-BANK-TENANT |
