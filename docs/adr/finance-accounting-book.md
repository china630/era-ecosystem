# ADR: Finance AccountingBook (multi-book) + slot billing

**Status:** Accepted  
**Date:** 2026-09-08  
**Product:** ERA Finance (`era-finance-core`) + Control plane billing (`era-orchestrator`)

## Context

P0–P1.5 delivered **NAS | IFRS** via `JournalEntry.ledgerType`, per-book close, mapping integrity, and IFRS-only adjustments. That model is sellable as «параллельный учёт МСФО» after UAT, but it does not scale to:

- Management / tax / extra GAAP books  
- More than two books per org  
- Monetizing additional books as recurring add-ons  

1C-experienced users expect **several books / charts of accounts** without requiring a 1C clone (no per-line «вид учёта» tax, no parallel register zoo). Commercial intent: **first statutory book included**; each **extra book** = monthly SKU (~19 AZN), via a **slot** model (not one SKU per GAAP forever).

Related: [finance-ledger-mapping-integrity.md](./finance-ledger-mapping-integrity.md), [finance-per-book-period-close.md](./finance-per-book-period-close.md).

## Decisions

### 1. Entity `AccountingBook` (Finance DB)

| Field | Role |
|-------|------|
| `id`, `organizationId` | Tenant scope |
| `code` | Stable org-unique code (`NAS`, `IFRS`, `MGMT`, …) |
| `nameAz` / `nameRu` / `nameEn` | UI labels |
| `gaapKind` | `NAS` \| `IFRS` \| `TAX` \| `MANAGEMENT` \| `CUSTOM` |
| `isSystem` | Protected (NAS system book cannot be deleted) |
| `isDefaultOps` | Target for cash/stock/payroll posting (exactly one ACTIVE ops default) |
| `status` | `ACTIVE` \| `RETIRED` |
| `billingSlotKind` | `INCLUDED` \| `EXTRA` (audit / support; **not** price) |
| `sortOrder`, timestamps | UX ordering |

- Soft unique: `@@unique([organizationId, code])` among non-retired (or status-aware unique).  
- **No** `monthlyPrice` / currency on this table — money lives in orchestrator.

### 2. Journal provenance migration

- Add `JournalEntry.accountingBookId` (FK, required after backfill).  
- Backfill: `ledgerType=NAS` → org’s system NAS book; `IFRS` → system IFRS book (create if missing when entitled historically).  
- Keep `ledgerType` through Wave A as **deprecated mirror** of book.gaapKind for NAS/IFRS only; new code paths prefer `accountingBookId`.  
- Unique constraints that today use `ledgerType` (e.g. mirror provenance) gain `accountingBookId` equivalents in Wave A/C.  
- Period close / hard lock settings migrate from `closedPeriodsByLedger.NAS|IFRS` keys to **`closedPeriodsByBookId`** (or code-keyed map); NAS legacy flat list remains synced for the system NAS book.

### 3. Slot billing (Orchestrator)

| Concept | Rule |
|---------|------|
| Included | **1** ACTIVE book with `billingSlotKind=INCLUDED` (statutory NAS) — part of base / `nas` product |
| Extra slot SKU | `accounting_book_extra` in `pricing_modules`, **19 AZN/month**, `satelliteKey=finance_core`, stackable (**quantity N = N slots**) |
| Cap | `maxActiveBooks = 1 + entitledExtraSlots` (soft product cap e.g. 8 for UX; hard = entitlement) |
| Create book | Finance `POST` checks entitlement/quota; else **402/403** `ACCOUNTING_BOOK_SLOT_REQUIRED` + upsell hint |
| Price SSOT | Orchestrator catalog only; Finance never stores AZN |

**No double-charge with `ifrs_mapping`:**

- `ifrs_mapping` = **mirror engine + IFRS CoA templates + soft/strict policy** (feature module).  
- Creating the **system IFRS book** consumes **either** (a) one **EXTRA** slot, **or** (b) a **bundled slot** granted by `ifrs_mapping` for the first IFRS book (`includedIfrsBookSlot: true` when module on).  
- Decision for implementation: **`ifrs_mapping` grants +1 book slot for the first IFRS system book**; further books (Management, Tax, 2nd IFRS) require `accounting_book_extra` × N. Documented in billing toggle helpers + Finance entitlement DTO: `accountingBookSlots: { included: 1, extra: N, ifrsBundleSlot: 0|1 }`.

### 4. Who creates books

| Actor | May |
|-------|-----|
| OWNER, ADMIN, ACCOUNTANT | Create / retire EXTRA books within quota; run provision wizard |
| USER / ops roles | Never; post only into `isDefaultOps` (or explicit book on rare APIs) |
| System bootstrap | Always creates NAS `INCLUDED` book; creates IFRS system book only when `ifrs_mapping` (or explicit provision) entitled |

UI home: **Settings → Accounting books** (or Chart → Books). Familiar to 1C users as «несколько планов/видов учёта», without cloning 1C screens.

### 5. Mapping between books

- Generalize `LedgerMappingSet` → **`BookMappingSet`** (`fromBookId` → `toBookId`), code may remain `NAS_TO_IFRS` for the system pair.  
- Soft/strict + provenance stay as in integrity ADR.  
- MANAGEMENT / CUSTOM books: **no auto-mirror by default** (Wave B); optional mapping in Wave C.

### 6. Anti-goals (not a 1C clone)

- No per-line «вид учёта» on every document line for cashiers.  
- No parallel 1C-style accumulation register matrix as the product story.  
- Ops documents write **default statutory book**; other books via translation and/or manual adjustments.  
- Do not imply «N independent full ERPs» without mapping honesty (Audit Hub / mirrorStatus).

### 7. More than three books

Allowed. UX = searchable book selector (CatalogField), not a row of toggles. Soft UX guidance: warn above 5; entitlement enforces max.

## Consequences

- Header toggle NAS|IFRS becomes **active AccountingBook selector** (same chrome).  
- Reports / close / adjustments / CF take `accountingBookId` (Wave A accepts legacy `ledgerType` as alias).  
- Upsell: «Used 2 of 3 book slots» + CTA to buy `accounting_book_extra`.  
- COVERAGE / matrices stay PARTIAL until waves ship + UAT; first commercial story remains NAS+IFRS after FIN-GAAP UAT.

## Implementation note — 2026-09-08

Wave B and the requested Wave C comparison slice are implemented: slot entitlement calculation, 402 `ACCOUNTING_BOOK_SLOT_REQUIRED`, role-gated book creation and guarded EXTRA-book retirement, truthful `LedgerType.MANAGEMENT`, TEMPLATE / EMPTY / NAS_CLONE CoA strategies, optional statutory→new-book DRAFT mapping creation, `/accounting/books`, arbitrary ACTIVE-book pair mapping-set validation/publish, source-book-driven automatic mirroring, and `/reporting/compare-books`. The control-plane module storefront accepts and exposes `quantity: 1..7` for `accounting_book_extra`. Organization period-lock UI/API dual-write the active book UUID and legacy ledger alias. Audit Hub now shows intentional `mirrorStatus=NONE` presence counts per non-default book, while its asymmetry and debit-parity engines remain NAS↔IFRS-specific. Default operational posting resolution covers simplified-tax revenue, prepaid amortization, and satellite accounting dispatch. The feature remains product-PARTIAL until Lab RT, and full migration of every posting/reporting path remains follow-up scope.

## Residuals inventory — 2026-09-08 (updated; Lab RT deferred)

Human Lab UAT / Pilot / edition `ga` are **out of eng scope for now** (deferred). Do not claim SHIPPED/Pilot/`ga` without later signoff.

| ID | Sev | Residual | Evidence / notes |
|----|-----|----------|------------------|
| FIN-BOOK-LAB-RT | P0 | Deferred (not eng) | Product-Readiness Pilot `[ ]` until human Lab RT |
| FIN-BOOK-QUERY-BOOKID | P0 | **done eng** | Reporting, MHBS statements, aging, reconciliation, holdings, executive widgets, cash flow, balance sheet, banking cards, account-card/journal exports, and subconto web callers use `ledgerQueryParam(ledgerType, accountingBookId)`; matching controllers accept the UUID |
| FIN-BOOK-CLOSE-ADJ | P0 | **done eng** | month + fiscal-year close/reopen/get are book-scoped (`FiscalYearClose.accountingBookId`, `closedYearsByBookId`, JE posted to active book) |
| FIN-BOOK-REPORTING | P1 | **done eng** | Single-org ledger reports/exports book-UUID scoped; holdings consolidate via stable `bookCode` per peer org (skip missing); TB/P&L web export + netting preview pass bookId; tax/property/payroll/statforms remain intentional ops-register (default-ops), not selectable multi-book ledgers |
| FIN-BOOK-ACCOUNT-CODE-UNIQ | P1 | **done eng** | Account uniqueness is `(organizationId, accountingBookId, code)` so NAS_CLONE / dual MANAGEMENT books may share codes under one `LedgerType`; migration `20260908200000_*` |
| FIN-GAAP-MIRROR-PAIRS | P1 | **done eng multi-target MVP** | `mirrorFromBook` runs each PUBLISHED set for the source book; per-target clear; unique `(sourceJournalEntryId, accountingBookId)` migration `20260908180000_*`. The transaction keeps preferred `NAS_TO_IFRS` as primary and records per-set outcomes in `mirrorErrorDetail.mirrorRuns`; soft mode can retain successful targets while strict mode aborts all |
| FIN-BOOK-TAX-OPS | P1 | **done eng** | default-ops on tax/prepaid/adapter/satellite dispatch |
| FIN-BOOK-RETIRE | P2 | **done eng** | PATCH retire + UI |
| FIN-BOOK-SLOTS-N | P2 | **done eng** | orch quantity 1–7 + storefront |
| FIN-BOOK-UX-SELECT | P2 | **done eng** | filter + soft warn >5 |
| FIN-BOOK-WIZARD-CLONE | P2 | **done eng** | TEMPLATE / EMPTY / NAS_CLONE + translate draft |
| FIN-BOOK-AUDIT-HUB | P2 | **done eng MVP** | ops vs each ACTIVE non-ops book asymmetry; intentionalNonOps by book; classic NAS↔IFRS labels retained as aliases |
| FIN-BOOK-SETTINGS-LOCK | P2 | **done eng** | byBookId + byLedger |
| FIN-BOOK-MAPPING-UX | P2 | **done eng** | arbitrary from/to create UI |
| FIN-BOOK-STOREFRONT-QTY | P2 | **done eng** | workspace modal quantity |

**Suggested sequencing (product):** Lab RT when ready. Eng structural tails (FY-by-book, holdings `bookCode`, account-code uniqueness, niche export callers) closed 2026-09-08.

## Roadmap (implementation plan)

### Phase 0 — UAT FIN-GAAP (now; no schema yet)

- Execute [era-finance-core/doc/UAT-SMOKE.md](../../era-finance-core/doc/UAT-SMOKE.md) § Multi-GAAP.  
- Lab RT signoff on Product-Readiness; keep edition honesty (no false GA).  
- **Exit:** Pilot-ready claim allowed for NAS↔IFRS parallel only.

### Wave A — Schema + dual system books + selector

1. Prisma `AccountingBook` + `JournalEntry.accountingBookId`; migration + backfill NAS/IFRS.  
2. Seed two system books when IFRS entitled; else NAS-only.  
3. Entitlement DTO slots + orchestrator seed row `accounting_book_extra` @ 19 AZN (catalog; enforce in Finance create later if create API not yet public).  
4. API/UI: book selector replaces toggle; `ledgerType` query still accepted as alias for system NAS/IFRS codes.  
5. Close / lock / prompt keyed by book id (compat layer for `.NAS`/`.IFRS` settings keys).  
**Exit:** Behavior parity with P1.5; no new GAAP kinds in UI yet.

### Wave B — Create book wizard + MANAGEMENT

1. `POST /accounting-books` with quota check (`ACCOUNTING_BOOK_SLOT_REQUIRED`).  
2. Wizard: gaapKind → CoA strategy (template / empty / clone NAS codes as escape hatch) → optional link «translate from statutory» **off** by default for MANAGEMENT.  
3. MANAGEMENT template CoA (MVP JSON / TemplateAccounts kind).  
4. UI list: slots used/max; retire book (block if open periods / JE — policy TBD in wave).  
**Exit:** Org can add Management book by purchasing extra slot(s).

### Wave C — Arbitrary BookMappingSet + compare reports

1. Rename/generalize mapping APIs to book-pair sets; keep NAS_TO_IFRS path.  
2. Report compare: book A vs book B (TB / P&L side-by-side or diff).  
3. Soft/strict mirror for any mapped pair; Audit Hub presence by book.  
**Exit:** N-book story complete for enterprise demos; update COVERAGE FIN-GAAP / new FIN-BOOK-* rows; Product-Readiness as warranted.

## References

- Pricing seed pattern: `era-orchestrator/.../pricing-module-seed.ts` (`ifrs_mapping`, finance modules)  
- Engine today: `ledgerType` + `LedgerMappingSet`  
- UAT: `era-finance-core/doc/UAT-SMOKE.md`  
- Roadmap index: [DEVELOPMENT_ROADMAP.md](../DEVELOPMENT_ROADMAP.md) § Finance multi-book
