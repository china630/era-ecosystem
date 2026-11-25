# Bank — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Bank-Product-Readiness-Matrix.md`](./Bank-Product-Readiness-Matrix.md)  
**Not full ABS map:** [`Bank-Capability-Inventory.md`](./Bank-Capability-Inventory.md) (OUT ≠ missing AC row)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**Civil date labels (2026-10-30, controls 2026-10-31):** Deposit maturity, loan schedule, posting date, treasury value/maturity dates, and ECL as-of dates render `дд.мм.гггг` via `bakuDateDisplay`. FMN, FATCA, government-security maturity, EOD business date, product effective-from, and account statement range use kit `DatePicker`. Values stay `YYYY-MM-DD`. No Scaffold ✅ / Pilot change.

**Closeout (2026-11-26 MFI meeting date):** `/mfi` sheet date defaults to `todayBakuYmd`. BANK-MFI-01 stays API / SCREEN (not SHOW). AC-BNK-OPS stays Scaffold ✅. No new Scaffold ✅. Pilot field stays [ ]. Gate/edition unchanged. `bank.yaml` untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-11-26 posting lock org filter):** AC-BNK-CORE stays Scaffold ✅. `FOR UPDATE` now filters `organization_id`. Negative: empty organization refused for both account and nostro locks. Opt-in DB race still `BANK_CONCURRENCY_DB_TEST=1`. No new Scaffold ✅. Pilot field stays [ ]. Gate/edition unchanged. `bank.yaml` untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-11-25 CBS-gap wave):** ADR pack `docs/adr/bank/`; Inventory honesty (SCAFFOLD); P0-1 Serializable+FOR UPDATE; P1-6 ECL collateral once; P0-2…P0-6 + P1/P2 MVP scaffolds. **No new Scaffold ✅** without dedicated PRD AC + field negatives. Existing in-scope ✅ rows keep negatives; new depth noted below / residual. Sell / Pilot field / edition unchanged (`mvp`).

**Honesty closeout (2026-11-25 audit diamond):** Per `docs/adr/BANK-AUDIT-2026-11-25.md` — treasury nostro via `nostroAdjustments` in money tx; prepay/repay atomic + stable idempotency; ASAN/CKR/rails no false live success; ADR gap restored + real § split; EOD CARD_AUTH hold expiry → `ledger.recomputeAvailable`; ops `/leasing` `/mfi` `/risk/prudential` + DBO loans/leasing SCREEN (not SHOW). `posting-concurrency.spec.ts` unit + opt-in DB (`BANK_CONCURRENCY_DB_TEST=1`). **No new Scaffold ✅.** Live rails/cards/ASAN complete partner-gated. Sell / Pilot field / edition unchanged (`mvp`).

**Second-pass closeout (2026-11-25):** `placeMoneyMarket` nostro+`sideEffectsInTx` (parity with IB open); BFF `leasing`/`mfi` mapped to `LOANS_*` (was fail-closed); module-map routes synced. **No new Scaffold ✅** / no Pilot flip. Residual: journal reverse/approve PENDING does not persist nostro adjustments.

**Audit-v2 remediations (2026-11-25):** concurrency opt-in test resolves `bankOrgId` via `BankInstitutionConfig`/`Branch` (removed bogus `bankOrganization`); ümidsiz write-off via allowance + SoD; sanctions seed labeled LAB-NOT-LIVE; Inventory `CAP-DBO-OB` IN→PARTIAL. **No new Scaffold ✅.** Live rails/cards still partner-gated.

**Wave 1 code closeout (2026-11-25):** P0-1 P2002 idempotency recovery + OPEN-TASKS concurrency recipe (diamond still needs `BANK_CONCURRENCY_DB_TEST=1` evidence); P0-2 LEASING/CREDIT_UNION gates + reg pack filter; P0-3 CBAR category on loans/portfolio UI + portfolio from prudential + ümidsiz SoD util test; P0-4 working-day due bump (DataHub) + EOD DUE/OVERDUE + repayWaterfall params; P0-5 catalog/BOKT filter + ops templates CatalogField (no official XSD); P0-6 AML T+3 via DataHub (monitor + alert/FMN) + LAB sanctions honesty; P1-7 deposit WHT tax payable + `GET /deposits/wht-registry` lab; P1-9 CollateralItem stale/revalue + `/risk/collateral-items`; P2-6 DBO full loan schedule/APR/prepay + leasing list honesty. **No new Scaffold ✅** / sell / Pilot / `mvp` / `pilot_ready` unchanged. Partner rails/cards/ASAN/XSD remain BLOCKED.

**Waves 2–4 lab closeout (2026-11-25):** P1-1 IFRS16 schedule/buyout/accrual + DBO schedule; P1-2 collection sheets+PAR30; P1-3 CKR pack/journal; P1-5 OB SCA; P1-6 ECL lifetime/SICR/CCF/macro; P1-8 ASAN completeChallenge fail-closed; P2-2 durable webhook outbox; P2-3 MIS assemble; P2-4 YAML version/diff/dry-run; P2-5 ADIF lab-2. **No new Scaffold ✅** / sell / Pilot / `mvp` / `pilot_ready` unchanged. Partner rails/cards/live ASAN/XSD BLOCKED.

**Audit-v3 money/SoD remediations (2026-11-25):** `collectSheet` atomic COLLECTED; lease accrue day-guard + ACTIVE-only; `mulRateRound` on lease/ECL/schedule; ümidsiz SoD bans system actors + `autoApprove:false`; DBO leasing Nest BFF verified (`nest/generated`, not Next `app/api`). See `docs/adr/BANK-AUDIT-2026-11-25-v3.md` §7. **No new Scaffold ✅** / sell / Pilot / `mvp` unchanged.

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-BNK-CORE | Posting engine + GL kernel | ✅ | [ ] | banking_core MVP; HMAC HS256 verify; EOD external post **423**; unbalanced reject; **P0-1** Serializable + account/nostro `FOR UPDATE` + P2002 idempotency recovery; post applyBalance recompute available from holds; EOD expired CARD_AUTH holds → `recomputeAvailable`; unit + opt-in DB concurrency | Negative: bad/expired JWT, EOD lock, insufficient available; unit serial ≠ DB race unless `BANK_CONCURRENCY_DB_TEST=1`; Pilot field open. **2026-11-26** lock SQL filters `organization_id`; empty org throws for accounts and nostro. Does not reopen Scaffold ✅ |
| AC-BNK-OPS | Ops teller UX (modal CRUD) | ✅ | [ ] | DELIVERY-BANK; Product Factory apply-from-template; CatalogField; no demo-auth defaults; BFF `leasing`/`mfi`→`LOANS_*`; MFI meeting date default `todayBakuYmd` | Call ops-mvp not edition ga; leasing/MFI/prudential SCREEN not SHOW. **2026-11-26** Baku default does not reopen Scaffold ✅ |
| AC-BNK-PAY | Payments / deposits / loans | ✅ | [ ] | module MVP+posting; staff approve SoD; deposit EOD accrual + **P1-7** WHT→`DEPOSIT_INTEREST_TAX_PAYABLE` + lab `wht-registry`; repay-by-schedule + configurable `repayWaterfall`; **P0-4** working-day dues + EOD DUE/OVERDUE + atomic prepay + APR; ops/DBO prepay; full DBO schedule; **P1-1/2** lease accrue ACTIVE+day-skip; MFI `collectSheet` COLLECTED iff all repay ok | Stub rails labOnly (YC-E1); live AKB flag (YC-E4); negative: overpay remainingUnallocated, pricing SoD, APR ±0.01pp, waterfall override, BOKT deposit gate; partial collect leaves sheet OPEN; leasing/MFI PARTIAL not IN |
| AC-BNK-PROD | Product Factory L3 | ✅ | [ ] | paramsJson contract; activate/retire; strict bands; day-count + FLOATING authoring UI; **P0-2** InstitutionType BOKT/LEASING/CREDIT_UNION gates + reg pack filter (`institution-product-gate.spec.ts`); YAML export util (P2-4) | Exception pricing dual-control engine+ops (YC-A3); certification separate |
| AC-BNK-REG | AML / regreporting / cards / treasury / risk hub | ✅ | [ ] | MVP modules + `/risk` + `/risk/capital` lab; **P0-5** catalog + BOKT filter + credit cats from prudential; **P0-6** CASH_THRESHOLD + T+3 DataHub working days + FMN formatter + LAB sanctions; treasury IB/MM/`nostroCorrespondent` via `nostroAdjustments` | FMN/CBAR live XSD still DECLARED; Certification track YC-E*; methodology=lab; reverse/approve nostro metadata open |
| AC-BNK-PAY-APPR | Payment staff checker queue | ✅ | [ ] | PENDING_APPROVAL + approve/reject; list SoD + reject reason; unit SoD tests | Live rails remain STUB (YC-E1) |
| AC-BNK-RISK | Loan bureau/collateral/NPL + risk hub | ✅ | [ ] | stub+live AKB flag; DPD; STAGE_FLAT/PD_LGD lab ECL + SoD (**P1-6** collateral once via links + `mulRateRound`); **P0-3** CBAR category + ümidsiz WO (human maker≠checker, ban system/`autoApprove`); **P1-9** CollateralItem stale/revalue UI; LCR/RWA/CAR MVP — **methodology=lab, not certified** | Pilot-ready blocked until YC-E4; UAT open → SCREEN not SHOW; negatives: maker≠checker; system actors rejected (`umidsiz-write-off.spec.ts`) |
| AC-BNK-FEE | Fee tariff CRUD + assess post | ✅ | [ ] | BE Lite→Deep; SystemGl FEE_*; negative unknown tariff + short idempotency | Ops `/fees` UI; `be-lite-fee.spec.ts` |
| AC-BNK-CASH | Cash vault/till + inventory + queue | ✅ | [ ] | banking_cash; posting vault↔till; EOD sdbRent | Ops `/cash` UI; UAT step 17 |
| AC-BNK-COLL | Collections cases / PTP / recovery SoD | ✅ | [ ] | banking_collections; SoD self-approve reject | Ops `/collections` UI; UAT SoD negative |
| AC-BNK-TRADE | Trade finance LC/BG/DC/SCF/SWIFT stub | ✅ | [ ] | banking_trade; contingent GL; SENT_STUB | Ops `/trade` UI; live SWIFT YC-E |
| AC-BNK-SO | Standing orders / VA / cheque / sweep | ✅ | [ ] | payments extensions; EOD SO run | Ops `/payments/extras` + DBO SO; rails stub |
| AC-BNK-LN-WF | Loan application WF + credit line + score | ✅ | [ ] | loans-deep; SoD on book | Ops apps/credit-lines + DBO apply |
| AC-BNK-ISL | Islamic window contracts | ✅ | [ ] | banking_islamic lab activate post | Ops `/islamic` + DBO read-only |
| AC-BNK-WEALTH | Custody safekeeping thin | ✅ | [ ] | banking_wealth; FOP receive; no FO | Ops `/wealth`; Derivatives FO OUT |
| AC-BNK-AML-RTF | AML case + fraud score lab | ✅ | [ ] | aml cases + `/aml/fraud/score` | Ops `/aml/cases`; live feed BLOCKED |
| AC-BNK-DBO-H2H | DBO H2H + OB consent API | ✅ | [ ] | dbo-ops; OB consent ≤90d; **P1-8** ASAN via `createAsanSimaAdapter` / `BANK_ASAN_MODE` (stub default) | ASAN live YC-E3; second-pass wired factory into DBO DI |
| AC-BNK-RBAC | Configurable role×permission matrix + custom roles (Variant A) | 🟡 | [ ] | `bank-rbac` + `entity-matrix` + page inventory + role-name grep; ADR bank-domain-permissions-and-rbac; `/admin/access` entity grid | **Out of BE rollup** until field UAT; do not flip Scaffold ✅ without Pilot evidence |
| AC-BANK-TENANT | `organizationId` + kit Prisma filter on bank / dbo / core rows | 🟡 | [ ] | CP-TENANT-01; B7 schema+migration+mergeWhere tests; fail-closed unbound | **Excluded from Scaffold BE rollup.** Ops `orgNo` login + engine `X-Organization-Id` ALS landed (code). Remaining = live SHARED pool + field isolation UAT (same as hotel/clinic TENANT). Not a bank-only ban. |

**Edition / wave rollup (BE only)** = worst(Scaffold of in-scope ACs except AC-BANK-TENANT and AC-BNK-RBAC).  
AC-BANK-TENANT is 🟡 (schema+filter) and stays **out of Scaffold BE rollup** until a live SHARED pool + field isolation UAT — **same bar as AC-HOT-TENANT / AC-CLI-TENANT**.  
AC-BNK-RBAC is 🟡 (Variant A shipped; field UAT open) and stays **out of Scaffold BE rollup**.  
Do not call this table «product readiness».  
Do not treat in-scope AC ✅ as coverage of Capability Inventory **OUT** rows (ATM scheme, derivatives FO, certified Basel, PEN/PSA, enterprise MIS/BPM/DMS, …).  
BE tracker: [Bank-BE-Roadmap.md](./Bank-BE-Roadmap.md).

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-BANK-TENANT | Live SHARED bank pool + field isolation UAT | Out of BE rollup | Schema+filter + ops `orgNo` login in code; same remaining field bar as hotel/clinic TENANT |
| AC-BNK-RBAC | Field UAT / SHOW | Out of BE rollup | SCREEN until signoff |
| (Capability Inventory — not AC) | Live payment rails / AKB / ASAN / SWIFT / bureau | External ⏸ | Inventory DECLARED/STUB — not an AC row; does not flip AC Scaffold |
| (Capability Inventory) | CAP-LN-LEASE/MFI/INT-WEBHOOK/NFR-MIS PARTIAL; CAP-DBO-OB PARTIAL; CAP-* SCAFFOLD (MENT/BPM/DMS); ECL/AKB/ASAN DECLARED | Honesty | Waves 2–4 Inventory; do not sell as IN / CBAR OB ready |
| (in-scope AC ✅ rows) | Field Pilot / certification tracks | Out of BE plan | Owned by Pilot / YC-E* |
| AC-BNK-RISK / REG | Prudential / leasing / MFI SHOW + live FMN XSD | Medium | SCREEN + ümidsiz WO + BFF grants; UAT/SHOW + FMN XSD follow-up — keep lab |
| AC-BNK-REG (treasury) | Reverse/approve PENDING does not restore nostro cache | Low | No journal metadata for `nostroAdjustments`; mature paths invert |

### Negative-path proof index

| Suite | AC |
|-------|----|
| existing engine / ops SoD + UAT negatives (see Proof column) | AC-BNK-* in-scope ✅ |
| `era-bank-core/apps/api/__tests__/posting-concurrency.spec.ts` | AC-BNK-CORE (P0-1) |
| `era-bank-core/apps/api/__tests__/ecl-engine.spec.ts` | AC-BNK-RISK (P1-6) |
| `era-bank-core/apps/api/__tests__/institution-product-gate.spec.ts` | AC-BNK-PROD (P0-2) |
| `era-bank-core/apps/api/__tests__/prudential-classification.spec.ts` | AC-BNK-RISK (P0-3) |
| `era-bank-core/apps/api/__tests__/umidsiz-write-off.spec.ts` | AC-BNK-RISK (P0-3 ümidsiz WO + system-actor ban) |
| `era-bank-core/apps/api/__tests__/money-rate.spec.ts` | AC-BNK-PAY / RISK (bigint `mulRateRound`) |
| `era-bank-core/apps/api/__tests__/lease-ifrs16.spec.ts` | AC-BNK-PAY (P1-1 lease schedule lab) |
| `era-bank-core/apps/api/__tests__/ecl-engine.spec.ts` | AC-BNK-RISK (P1-6 ECL lab) |
| `era-bank-core/apps/api/__tests__/loan-schedule.spec.ts` / `apr.util.spec.ts` / `loan-penalty-accrual.spec.ts` / `loan-repay.spec.ts` / `deposit-interest-wht.spec.ts` | AC-BNK-PAY (P0-4 / P1-7) |
| `era-bank-core/apps/api/__tests__/reg-report.engine.spec.ts` | AC-BNK-REG (P0-5) |
| `era-bank-core/apps/api/__tests__/aml-compliance.spec.ts` | AC-BNK-REG / AML-RTF (P0-6) |
| `era-bank/__tests__/bank-rbac.spec.ts` | AC-BNK-RBAC |
| `era-bank/__tests__/bank-page-route-inventory.spec.ts` | AC-BNK-RBAC |
| `era-bank/__tests__/bank-rbac-holes.spec.ts` | AC-BNK-RBAC |
| pending SHARED-pool field UAT | AC-BANK-TENANT |
