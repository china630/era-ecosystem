# ERA Bank Core — Technical Specification (TZ)

**Scope:** `era-bank-core` — the **headless regulated banking engine** (system of record). Operational UI is the separate **`era-bank`** satellite (ADR D9, [era-bank/TZ.md](../era-bank/TZ.md)).
**Companion:** [PRD.md](./PRD.md) (product-line lead) · ADR [docs/adr/era-bank-core.md](../docs/adr/era-bank-core.md)
**Stack (canonical with ecosystem):** NestJS API + Prisma + PostgreSQL + Redis; `@era/contracts` (zod) for cross-service contracts. **No web/UI in this app** — UI lives in `era-bank`.

---

## §0. Service topology

`era-bank-core` is API-only. Consumers: the `era-bank` satellite (operational UI) and future channel apps (`era-bank-dbo`), via internal API + service token.

| Component | Tech | Port (dev) | DB |
|-----------|------|------------|----|
| `bank-core` API (headless engine) | NestJS | **4300** | `era_bank_core` (PostgreSQL) |
| `era-bank` satellite (UI, consumes engine) | Next.js | **3210** | `era_bank` — see [era-bank/TZ.md](../era-bank/TZ.md) |
| Cache / locks | Redis | 6379 | — |

Env (canonical, see [ECOSYSTEM_URLS.md](../docs/ECOSYSTEM_URLS.md)):

| Variable | Meaning |
|----------|---------|
| `ERA_BANK_ORGANIZATION_ID` | The single bank org for this deployment (one deployment = one bank) |
| `BANK_CORE_DB` | `era_bank_core` |
| `ERA_DATA_HUB_URL` / `ERA_DATA_HUB_ONPREM` | Reference data source; on-prem mode for isolated banks |
| `PII_ENCRYPTION_KEY` / `PII_BLIND_INDEX_KEY` | Held by the bank (on-prem) |
| `ERA_JWT_*` | SSO verification (orchestrator issuer) |
| `SATELLITE_EVENT_SERVICE_TOKEN` | Outbound non-money events to orchestrator |

Global NestJS laws (ecosystem): `ValidationPipe` `whitelist: true, forbidNonWhitelisted: true, transform: true`; DTO + class-validator on every input; domain logic in services, thin controllers.

## §1. Architectural layering (binding)

Per ADR D2 the codebase is physically split so the thin-kernel rule is enforceable:

```
era-bank-core/                 # headless engine (no UI)
  apps/api/src/
    kernel/            # L1 — universal, no bank/product-specific logic
      ledger/          # accounts, postings, balances, holds, double-entry
      posting-engine/  # ACID transaction orchestration, idempotency
      cif/             # customer master (globalPersonId + KYC)
      branch/          # Branch dimension + inter-branch settlement (МФР)
      eod/             # EOD/EOM batch: accrual, revaluation, day-close
      product-factory/ # L3 configuration engine (product templates)
      audit/           # immutable posting + CIF change log
    modules/           # L2 engines — regulated math + API, gated by entitlement
      deposits/  loans/  cards/  payments/  aml/  treasury/  regreporting/  risk/
    integration/       # MDM, data-hub, finance bridge, CBAR rails, processors
  packages/database/   # Prisma schema (era_bank_core)
# UI for these modules lives in era-bank (satellite); banking_dbo channels in era-bank-dbo.
```

**Kernel import rule:** `kernel/*` must not import from `modules/*`. Modules depend on kernel, never the reverse. CI lint rule enforces this boundary.

**Engine/UI rule (ADR D9):** all regulated logic (ledger, posting, EOD, product math) is here and headless. `era-bank` only renders UI and orchestrates workflow over this API; it never posts to the ledger directly and stores no money/ledger state.

## §2. Data model (kernel L1)

Prisma-style; all monetary amounts are integer **minor units** (qəpik) with explicit `currency`. All tenant rows carry `bankOrgId` (= `ERA_BANK_ORGANIZATION_ID`) for defense-in-depth even in single-tenant deployment.

### 2.1. Chart of accounts (CBAR)

```prisma
model GlAccount {              // CBAR chart of accounts node
  id            String   @id @default(cuid())
  code          String              // CBAR account code
  name          String
  type          GlAccountType       // ASSET | LIABILITY | EQUITY | INCOME | EXPENSE | OFF_BALANCE
  currency      String?             // null = multi-currency control account
  isPostable    Boolean  @default(true)
  parentId      String?
  @@unique([code])
}

model SystemGlConfig {         // bank-wide control-account map (not product-scoped)
  id         String @id @default(cuid())
  bankOrgId  String
  key        String              // CASH_VAULT | NOSTRO | FX_TRANSIT | MFR_SETTLEMENT | ...
  glCode     String              // → GlAccount.code
  @@unique([bankOrgId, key])
}
```

**GL resolution (ADR [era-bank-gl-account-mapping.md](../docs/adr/era-bank-gl-account-mapping.md)):**

| Kind | Source | Resolver |
|------|--------|----------|
| Product GL | `ProductTemplate.paramsJson` | `getProductGlCode(params, key)` |
| System GL | `SystemGlConfig` | `SystemGlConfigService.resolve(key)` in `kernel/ledger` |

Inline CBAR code literals in posting builders are forbidden (except seed defaults and caller-supplied GL selectors).

### 2.2. Branch dimension (ADR D5)

```prisma
model Branch {
  id          String   @id @default(cuid())
  code        String              // internal branch code / MFO mapping
  name        String
  parentId    String?             // org-unit tree: HQ → branch → sub-office
  isHeadOffice Boolean @default(false)
  status      BranchStatus        // ACTIVE | SUSPENDED | CLOSED
  @@unique([code])
}
// Active Branch count is metered to orchestrator as `active_branches` quota.
```

### 2.3. CIF (customer master — ADR D4)

```prisma
model BankCustomer {
  id              String   @id @default(cuid())
  globalPersonId  String?            // MDM ref for natural persons (NEVER store PII here)
  voen            String?            // legal entity (10 digits)
  customerType    CustomerType       // NATURAL | LEGAL
  // KYC (bank-specific, not PII identity which lives in MDM)
  riskRating      RiskRating         // LOW | MEDIUM | HIGH
  pepFlag         Boolean  @default(false)
  kycStatus       KycStatus          // PENDING | VERIFIED | REJECTED | REVIEW
  kycTrustTier    TrustTier          // SELF_DECLARED | DOCUMENT_SCANNED | GOVERNMENT_VERIFIED
  sourceOfFunds   String?
  homeBranchId    String
  status          CustomerStatus
  @@index([globalPersonId])
  @@index([voen])
}

model BeneficialOwner {            // UBO for legal entities
  id            String @id @default(cuid())
  customerId    String
  globalPersonId String
  sharePercent  Decimal
}
```

### 2.4. Accounts, balances, holds

```prisma
model Account {
  id            String   @id @default(cuid())
  iban          String   @unique
  customerId    String
  branchId      String              // owning branch (МФР dimension)
  glAccountId   String              // CBAR control account
  productId     String?             // Product Factory instance (deposit/loan/current)
  currency      String
  status        AccountStatus       // ACTIVE | DORMANT | BLOCKED | CLOSED
  // balances are derived from postings, cached for performance:
  ledgerBalance Decimal  @default(0)
  availableBalance Decimal @default(0)
  overdraftLimit Decimal @default(0)
  @@index([customerId])
  @@index([branchId])
}

model AccountHold {            // reservations / arrests / authorizations
  id        String   @id @default(cuid())
  accountId String
  amount    Decimal
  reason    HoldReason          // CARD_AUTH | LEGAL_ARREST | MANUAL | PAYMENT_PENDING
  status    HoldStatus          // ACTIVE | RELEASED | CAPTURED
  expiresAt DateTime?
}
```

### 2.5. Ledger postings (double-entry, immutable)

```prisma
model JournalTransaction {       // one balanced business event (Σ Dr = Σ Cr)
  id            String   @id @default(cuid())
  reference     String   @unique      // human reference
  idempotencyKey String  @unique      // replay-safe (ADR D6)
  valueDate     DateTime
  bookingDate   DateTime
  branchId      String?              // initiating branch
  type          TxnType              // DEPOSIT | WITHDRAWAL | TRANSFER | INTERBRANCH | INTEREST | FEE | FX | PAYMENT | REVERSAL ...
  status        TxnStatus            // PENDING | POSTED | REVERSED
  makerUserId   String
  checkerUserId String?              // 4-eyes (set on POSTED for controlled types)
  reversesId    String?              // link for reversal
  createdAt     DateTime @default(now())
}

model JournalEntry {             // a single leg; immutable once POSTED
  id            String   @id @default(cuid())
  transactionId String
  accountId     String?            // customer account leg (nullable for pure GL legs)
  glAccountId   String             // CBAR account
  branchId      String             // posting branch (МФР netting dimension)
  debit         Decimal  @default(0)
  credit        Decimal  @default(0)
  currency      String
  // exactly one of debit/credit is non-zero
}
```

**Invariant:** within one `JournalTransaction`, `Σ debit == Σ credit` per currency. Enforced in the posting engine inside the DB transaction; rejected otherwise.

### 2.6. Product Factory (L3 config)

```prisma
model ProductTemplate {        // bank-configured, no code (deposits/loans/current/cards)
  id          String   @id @default(cuid())
  moduleKey   String              // banking_deposits | banking_loans | ...
  kind        ProductKind         // CURRENT | TERM_DEPOSIT | SAVINGS | LOAN_ANNUITY | LOAN_DIFF | CARD
  name        String
  currency    String
  paramsJson  Json                // rates, terms, fees, day-count (360/365), capitalization, schedule rules, GL mapping
  status      ProductStatus       // DRAFT | ACTIVE | RETIRED
  effectiveFrom DateTime
}
```

The kernel knows only `ProductTemplate.paramsJson` shape contracts; deposit/loan *behavior* lives in L2 modules that read these params. The kernel never hardcodes a product.

**Product GL mapping keys in `paramsJson`** (required where the product posts to that role):

| Key | Used by |
|-----|---------|
| `glAssetCode` | Loans (portfolio), other asset products |
| `glLiabilityCode` | Current accounts, term deposits |
| `glInterestIncomeCode` | Loans (interest leg on repay) |
| `glInterestExpenseCode` | Deposits (interest accrual — when implemented) |

Helpers: `apps/api/src/common/product-gl.ts` (`getProductGlCode`). Bank-wide accounts (nostro, cash vault, MFR, FX transit, …) use `SystemGlConfig` (§2.1), not product templates.

### 2.7. EOD / audit

```prisma
model EodRun {
  id          String   @id @default(cuid())
  businessDate DateTime @unique
  status      EodStatus           // RUNNING | COMPLETED | FAILED
  steps       Json                // accrual, revaluation, interbranch-netting, snapshot
  balancedAt  DateTime?
}

model AuditLogEntry {          // append-only; no updates/deletes
  id          String   @id @default(cuid())
  entity      String              // 'JournalTransaction' | 'BankCustomer' | ...
  entityId    String
  action      String
  beforeJson  Json?
  afterJson   Json?
  actorUserId String
  at          DateTime @default(now())
}
```

## §3. Posting engine (kernel — the heart)

Single entry point for all money movement. Pseudocode contract:

```ts
// kernel/posting-engine
async function post(tx: PostingRequest): Promise<JournalTransaction> {
  // 1. idempotency: if idempotencyKey seen -> return existing transaction (no double-post)
  // 2. validate legs: each leg has exactly one of debit/credit; accounts ACTIVE; currency match
  // 3. limit/hold checks: availableBalance >= debit (unless overdraftLimit); active holds respected
  // 4. open DB transaction (Serializable):
  //      - insert JournalTransaction + JournalEntry[] (immutable)
  //      - assert Σdebit == Σcredit per currency  -> else ROLLBACK
  //      - update Account.ledgerBalance / availableBalance for each customer leg
  //      - append AuditLogEntry
  //    commit (ACID — ADR D6)
  // 5. emit non-money domain event (BullMQ) AFTER commit for notifications/analytics
}
```

Rules:
- **No money outside this engine.** Modules build `PostingRequest`s; they never write `JournalEntry` directly.
- **Maker-checker:** controlled `TxnType`s are created `PENDING` by maker; a checker calls `approve` which performs the actual `post` inside the same guarantees.
- **Reversals** create a new mirrored transaction (`type=REVERSAL`, `reversesId`), never mutate the original.

## §4. Balances

`ledgerBalance` = Σ posted entries. `availableBalance` = `ledgerBalance` − Σ active holds + `overdraftLimit`. Cached columns are derived; a `balance-recompute` job validates cache against postings during EOD. Source of truth is always the immutable `JournalEntry` set.

## §5. CIF & MDM (ADR D4)

- On customer onboarding, resolve identity via orchestrator MDM `persons/resolve` (FIN/passport/residence) → store only `globalPersonId`.
- KYC attributes (`riskRating`, `pepFlag`, `kycStatus`, `kycTrustTier`, UBO) live in `bank-core`.
- `GOVERNMENT_VERIFIED` trust tier set when ASAN İmza / SİMA verification succeeds; published back to MDM as an identifier trust upgrade.
- **No PII (FIN/passport numbers) stored in `bank-core`** beyond encrypted operational need; identity master stays in MDM.

## §6. Multi-currency & FX

- Accounts are single-currency; a customer holds N accounts for N currencies.
- FX conversion posts through a transit/position GL account with FX difference legs (pattern mirrors finance-core acct 662/762; concrete CBAR codes from data-hub COA template).
- EOD revaluation marks open FX positions to the CBAR official rate (`data-hub` `GET /fx/rates?date=` — **FINAL only** for posting; `DataHubClient.getFxRate(currency, asOf)`; on-prem fallback `ref-data-snapshot.fxRates[]`).

## §7. Inter-branch settlement (МФР) — worked mechanics

Branches share one balance; a cross-branch operation is **branch-tagged double-entry inside the single ACID ledger**, using inter-branch settlement control accounts (CBAR МФР accounts). No cross-org routing, no events.

**Example — customer of Branch A withdraws cash 100 AZN at Branch B:**

| Leg | GL account | Branch | Debit | Credit |
|-----|-----------|--------|-------|--------|
| 1 | Customer current account (liability) | A | 100 | |
| 2 | Inter-branch settlement (МФР) | A | | 100 |
| 3 | Inter-branch settlement (МФР) | B | 100 | |
| 4 | Cash / vault | B | | 100 |

Σ Debit = Σ Credit = 200 (one `JournalTransaction`, `type=INTERBRANCH`). The МФР control account nets to zero across branches.

**EOD netting:** the МФР control account is reconciled per branch pair; net positions are reported but the consolidated bank balance is already correct because the ledger is physically one. `EodRun.steps.interbranchNetting` records the reconciliation.

## §8. API surface (REST, `/api/v1`)

Kernel and module endpoints — **consumed by the `era-bank` satellite UI and future channel apps** (`era-bank-dbo`), never exposed directly to end users. All mutations require idempotency key + maker-checker per `TxnType` policy. Auth: orchestrator JWT (forwarded by the satellite) + internal service token for satellite↔engine calls; entitlement gate per `banking_*` module.

### 8.1. Kernel

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/cif/customers` | Create customer (resolves `globalPersonId`) |
| GET | `/api/v1/cif/customers/:id` | Customer + KYC |
| POST | `/api/v1/accounts` | Open account (issues IBAN, opening posting) |
| GET | `/api/v1/accounts/:id` | Account + balances |
| GET | `/api/v1/accounts/:id/statement?from=&to=` | Statement |
| POST | `/api/v1/accounts/:id/holds` | Place hold/arrest |
| DELETE | `/api/v1/accounts/:id/holds/:holdId` | Release hold |
| POST | `/api/v1/postings` | Submit posting (maker) — idempotency-keyed |
| POST | `/api/v1/postings/:id/approve` | Checker approves → POSTED |
| POST | `/api/v1/postings/:id/reverse` | Reversal |
| GET | `/api/v1/gl/accounts` | CBAR chart |
| GET | `/api/v1/gl/trial-balance?date=` | Trial balance |
| POST | `/api/v1/branches` | Create branch (quota-metered) |
| GET | `/api/v1/branches` | List branches |
| POST | `/api/v1/product-templates` | Configure product (Product Factory) |
| POST | `/api/v1/eod/run` | Trigger EOD (or scheduled) |
| GET | `/api/v1/eod/:date` | EOD status/snapshot |

### 8.2. Modules (representative)

| Module | Method | Path |
|--------|--------|------|
| deposits | POST | `/api/v1/deposits` (open from template), `/:id/close` (early termination), `/:id/rollover` |
| loans | POST | `/api/v1/loans` (originate), `/:id/disburse`, `/:id/repay`, `/:id/restructure`; GET `/:id/schedule` |
| cards | POST | `/api/v1/cards` (issue), `/:id/limits`, `/:id/block`; POST `/api/v1/card-txns/authorize` |
| payments | POST | `/api/v1/payments/orders` (create), `/:id/submit` (route AZIPS/XÖHKS/AÖS/SWIFT); POST `/api/v1/payments/inbound` (rail ingress) |
| aml | GET | `/api/v1/aml/alerts`; POST `/api/v1/aml/screen`, `/api/v1/aml/reports/fmn` |
| treasury | POST | `/api/v1/treasury/fx-deals`, `/api/v1/treasury/interbank`; GET `/api/v1/treasury/liquidity-gap` |
| regreporting | GET | `/api/v1/reports/cbar/:template?period=`; GET `/api/v1/reports/fatca-crs` |
| risk (§12) | POST | `/api/v1/risk/staging/run`, `/api/v1/risk/ecl/run`, `/api/v1/risk/ecl/runs/:id/post-provisions`; GET `/api/v1/risk/rwa`, `/api/v1/risk/capital-adequacy`, `/api/v1/risk/lcr` |

### 8.3. Internal (service-token, no public exposure)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/internal/v1/staff-provisioning` | Consume `STAFF_PROVISIONED` from finance |
| POST | `/internal/v1/finance-bridge/summary` | Push summarized corporate journals to finance (ADR D7) |

## §9. Contracts (`@era/contracts`)

New file `packages/era-contracts/src/events/banking.events.ts`. **These are non-money events only** (notifications, analytics, reconciliation, corporate-journal summaries). Money never flows over events (ADR D6). Zod, mirroring existing style (`satelliteEventBaseSchema.extend`, `SATELLITE_*` const, `isX` guard).

```ts
import { z } from "zod";
import { satelliteEventBaseSchema } from "./common";

export const SATELLITE_BANK_GL_DAILY_SUMMARY = "SATELLITE_BANK_GL_DAILY_SUMMARY" as const;
export const satelliteBankGlDailySummarySchema = satelliteEventBaseSchema.extend({
  type: z.literal(SATELLITE_BANK_GL_DAILY_SUMMARY),
  payload: z.object({
    businessDate: z.string(),
    lines: z.array(z.object({ glCode: z.string(), debit: z.number(), credit: z.number() })),
    currency: z.literal("AZN"),
  }),
});
export type SatelliteBankGlDailySummaryEvent = z.infer<typeof satelliteBankGlDailySummarySchema>;
export function isSatelliteBankGlDailySummary(d: unknown): d is SatelliteBankGlDailySummaryEvent {
  return satelliteBankGlDailySummarySchema.safeParse(d).success;
}

// Additional non-money events (analytics/notifications):
//   SATELLITE_BANK_ACCOUNT_OPENED, SATELLITE_BANK_LOAN_DISBURSED,
//   SATELLITE_BANK_PAYMENT_POSTED, SATELLITE_BANK_AML_ALERT_RAISED,
//   SATELLITE_BANK_RISK_STAGE_CHANGED, SATELLITE_BANK_RISK_LIMIT_BREACHED (§12)
// each follows the same schema/guard pattern.
```

Register guards in `events/satellite-event.ts` `isSatelliteEvent()` and document types in [INTEGRATION_SSO_EVENTS.md](../docs/INTEGRATION_SSO_EVENTS.md). Inbound `STAFF_PROVISIONED` / `STAFF_DEACTIVATED` reuse the existing HR contract family.

## §10. Boundary with finance-core (ADR D1/D7)

| Concern | bank-core | finance-core |
|---------|-----------|--------------|
| Customer accounts/deposits/loans/cards/interbank | ✅ owns | ❌ |
| Banking GL (CBAR), prudential balance | ✅ system of record | ❌ |
| Bank opex / payroll / fixed assets / procurement / supplies / VAT | ❌ | ✅ owns |
| Connection | emits `SATELLITE_BANK_GL_DAILY_SUMMARY`; finance emits summarized corporate journals back | consumes/produces summaries |
| Shared operational DB | ❌ never | ❌ never |
| Staff provisioning | consumes `STAFF_PROVISIONED` | emits |

Anti-double-counting: corporate opex is posted once in finance-core; only **summarized** entries cross the seam for consolidated statutory reporting. VAT and expense recognition stay in finance-core.

## §11. Security & compliance

- **Encryption:** envelope DEK/KEK + blind-index (reuse finance-core security layer); keys held by the bank in on-prem mode.
- **Maker-checker / SoD:** enforced in posting engine for controlled `TxnType`s; roles from orchestrator RBAC + branch limits.
- **Immutable audit:** `AuditLogEntry` append-only; postings/CIF changes reconstructable.
- **AML:** `banking_aml` monitors postings (read side), screens against sanction lists (data-hub shelf C), files FMN reports — worked flow in §13.2.
- **Risk:** `banking_risk` (§12) computes IFRS 9 ECL/provisions, RWA/capital adequacy, IRRBB, LCR/NSFR and risk-appetite limits; provisions post through the kernel posting engine (no parallel ledger).
- **Reg reporting:** `banking_regreporting` produces CBAR prudential templates + FATCA/CRS (consumes `banking_risk` capital/ECL outputs).
- **Data residency:** on-prem deployment with on-prem reference data (no public data-hub dependency).
- **Audit chain:** every money movement appends an immutable `AuditLogEntry` inside the same DB transaction; full lifecycle worked in §13.1.

## §12. Risk management (`banking_risk`) — L2 module

New L2 module. Full rationale, boundaries and alternatives in ADR [era-bank-risk-and-audit.md](../docs/adr/era-bank-risk-and-audit.md). It is a **calculation & orchestration layer**: it computes risk read-models and **posts provisions/write-offs through the kernel posting engine (§3)** in one ACID transaction — never a parallel ledger (ADR D6). It **consumes, never duplicates**, exposures (reads `LoanContract`/`Card`/`Account`/treasury deals/GL; stores derived risk state keyed back). AML/CFT stays a **separate** module (`banking_aml`, §13.2); the immutable audit trail stays in the **kernel** (§13.1).

### 12.1 Scope & boundaries

| Owns (new) | Does NOT own (stays where it is) |
|------------|----------------------------------|
| Credit risk & IFRS 9 ECL (staging, PD/LGD/EAD, collateral haircuts, NPL, provisioning) | AML/CFT monitoring, screening, FMN → `banking_aml` |
| Regulatory capital: RWA, CAR/Tier-1, large exposures / concentration | Teller/branch limits, holds, maker-checker, immutable audit → **kernel L1** |
| Market risk / IRRBB (repricing gap, FX open position, sensitivity) | Operational liquidity GAP buckets + FX dealing → `banking_treasury` |
| Prudential liquidity ratios (LCR / NSFR) | Report formatting/submission → `banking_regreporting` (consumes risk outputs) |
| Risk-appetite limits framework + breach register; operational-risk KRIs (reads audit log) | |

**Kernel rule (ADR D2):** risk math is bank/regulation-specific → L2, never L1. The module imports `PostingEngineService` from the kernel (allowed direction); the kernel never imports `modules/risk`.

### 12.2 Data model (risk read-models)

All `bankOrgId`-scoped; provisions reuse `JournalTransaction`/`JournalEntry` (§2.5) with new loan-loss allowance/expense GL codes — **no new ledger tables**.

```prisma
model RiskExposure {              // normalized exposure, keyed to a product record
  id           String   @id @default(cuid())
  bankOrgId    String
  exposureRef  String              // loanId | cardId | off-balance ref
  assetClass   String              // RETAIL_MORTGAGE | CORPORATE | CARD | ...
  eadMinor     BigInt              // exposure at default (minor units)
  stage        Int      @default(1) // IFRS 9 stage 1|2|3
  daysPastDue  Int      @default(0)
  npl          Boolean  @default(false)
  asOfDate     DateTime
  @@index([bankOrgId, asOfDate])
  @@index([bankOrgId, exposureRef])
}

model EclCalculationRun {         // one ECL batch per as-of date
  id          String   @id @default(cuid())
  bankOrgId   String
  asOfDate    DateTime
  status      String              // RUNNING | COMPLETED | POSTED | FAILED
  totalEclMinor BigInt @default(0)
  postedTxnId String?             // link to provision JournalTransaction after post
  @@index([bankOrgId, asOfDate])
}

model EclResult {                 // per-exposure ECL for a run
  id           String  @id @default(cuid())
  bankOrgId    String
  runId        String
  exposureRef  String
  stage        Int
  pd           Decimal @db.Decimal(9, 6)
  lgd          Decimal @db.Decimal(9, 6)
  eadMinor     BigInt
  eclMinor     BigInt
  @@index([runId])
}

model CollateralItem {            // extends LoanContract.collateralRef
  id            String  @id @default(cuid())
  bankOrgId     String
  exposureRef   String
  kind          String            // REAL_ESTATE | VEHICLE | CASH | GUARANTEE
  emdkRef       String?           // ƏMDK registry reference
  status        String            // PLEDGED | RELEASED
}

model CollateralValuation {       // haircut history feeding LGD
  id            String   @id @default(cuid())
  bankOrgId     String
  collateralId  String
  marketMinor   BigInt
  haircutPct    Decimal  @db.Decimal(5, 2)
  netMinor      BigInt            // market × (1 − haircut)
  valuedAt      DateTime @default(now())
}

model RwaSnapshot {               // risk-weighted assets as-of
  id           String   @id @default(cuid())
  bankOrgId    String
  asOfDate     DateTime
  creditRwaMinor  BigInt
  marketRwaMinor  BigInt
  opRwaMinor      BigInt
  totalRwaMinor   BigInt
  @@index([bankOrgId, asOfDate])
}

model CapitalAdequacySnapshot {   // CAR / Tier-1
  id            String   @id @default(cuid())
  bankOrgId     String
  asOfDate      DateTime
  tier1Minor    BigInt
  totalCapitalMinor BigInt
  totalRwaMinor BigInt
  carPct        Decimal @db.Decimal(6, 2)
  tier1Pct      Decimal @db.Decimal(6, 2)
  @@index([bankOrgId, asOfDate])
}

model LargeExposure {             // concentration / large-exposure register
  id             String  @id @default(cuid())
  bankOrgId      String
  counterpartyRef String
  exposureMinor  BigInt
  capitalPct     Decimal @db.Decimal(6, 2)
  asOfDate       DateTime
}

model RiskLimit {                 // risk-appetite limit (distinct from teller limits)
  id         String  @id @default(cuid())
  bankOrgId  String
  code       String              // LARGE_EXPOSURE | SECTOR_CONC | FX_OPEN_POSITION | ...
  scope      String
  limitMinor BigInt?
  limitPct   Decimal? @db.Decimal(6, 2)
  enabled    Boolean @default(true)
  @@unique([bankOrgId, code])
}

model RiskLimitBreach {
  id         String   @id @default(cuid())
  bankOrgId  String
  limitId    String
  observedMinor BigInt?
  observedPct Decimal? @db.Decimal(6, 2)
  status     String              // OPEN | ACKNOWLEDGED | CLEARED
  detectedAt DateTime @default(now())
  @@index([bankOrgId, status])
}
```

### 12.3 Services & API (`/api/v1/risk/*`)

Engine `modules/risk/` (pure engines have no I/O and are unit-tested):

| Service / engine | Key functions |
|------------------|---------------|
| `credit-risk.service.ts` | `runStaging(asOfDate)`, `runEclBatch(asOfDate)`, `postProvisions(runId)` (via posting-engine), `valuateCollateral(collateralId)` |
| `staging.engine.ts` (pure) | `stageFromDpd(dpd, flags)`, `isSicr(...)`, `isNpl(stage, dpd)` |
| `ecl.engine.ts` (pure) | `pd(stage, score)`, `lgd(netCollateral, ead)`, `ead(outstanding, undrawn)`, `eclAmount(pd, lgd, ead)` |
| `capital.service.ts` | `computeRwa(asOfDate)`, `capitalAdequacy(asOfDate)`, `largeExposures(asOfDate)` |
| `rwa.engine.ts` (pure) | `riskWeight(assetClass, rating)`, `rwaForExposure(e)` |
| `market-risk.service.ts` | `repricingGap(asOfDate)`, `fxOpenPosition(asOfDate)`, `sensitivity(scenario)` |
| `liquidity-ratio.service.ts` | `lcr(asOfDate)`, `nsfr(asOfDate)` (reads treasury `LiquidityGapSnapshot`) |
| `risk-limits.service.ts` | `upsertLimit`, `evaluateBreaches(asOfDate)`, `raiseBreach(...)` |
| `risk.service.ts` | dashboard aggregation |

| Area | Routes |
|------|--------|
| Credit / ECL | `GET /risk/exposures`, `GET /risk/exposures/:id`, `POST /risk/staging/run`, `POST /risk/ecl/run`, `GET /risk/ecl/runs/:id`, `POST /risk/ecl/runs/:id/post-provisions` |
| Collateral | `GET/POST /risk/collateral`, `POST /risk/collateral/:id/valuate` |
| Capital | `GET /risk/rwa`, `GET /risk/capital-adequacy`, `GET /risk/large-exposures` |
| Market / IRRBB | `GET /risk/repricing-gap`, `GET /risk/fx-position`, `POST /risk/scenarios/run` |
| Liquidity ratios | `GET /risk/lcr`, `GET /risk/nsfr` |
| Limits | `GET/PUT /risk/limits/:code`, `GET /risk/limit-breaches` |
| Dashboard | `GET /risk/dashboard` |

UI (satellite `era-bank/app/risk/*`, role **Risk / credit officer**; read views for management SSO): `portfolio`, `ecl`, `collateral`, `capital`, `alm`, `limits`, `dashboard`.

### 12.4 Credit risk & IFRS 9 ECL — worked mechanics

**Current state:** credit risk is field-only — `LoanContract.ifrs9Stage`/`akbScore`/`collateralRef` and a manual setter; `originate()` hardcodes `akbScore: 720` (bureau stub).

```216:220:era-bank-core/apps/api/src/modules/loans/loans.service.ts
  restructure(id: string, ifrs9Stage: number) {
    return this.prisma.loanContract.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { ifrs9Stage, status: LoanStatus.ACTIVE },
    });
  }
```

**Target (`banking_risk`):**

1. **Staging** (`staging.engine.ts`, run daily in EOD): DPD + qualitative flags →

| Stage | Trigger | ECL horizon |
|-------|---------|-------------|
| 1 (performing) | 0–29 DPD, no SICR flag | 12-month ECL |
| 2 (SICR) | 30–89 DPD or watch/forbearance flag | lifetime ECL |
| 3 (impaired / NPL) | ≥ 90 DPD or default event | lifetime ECL |

2. **ECL**: `ecl = pd(stage, score) × lgd(netCollateral, ead) × ead(outstanding, undrawn)`; LGD reduced by net (haircut-adjusted) collateral from `CollateralValuation`.

3. **Provisioning (atomic, via kernel §3):** `runEclBatch(asOfDate)` writes `EclResult` rows; `postProvisions(runId)` posts one balanced transaction (maker-checker on the batch):

| Leg | GL | Debit | Credit |
|-----|----|-------|--------|
| 1 | Loan-loss provision expense (P&L) | ΔECL | |
| 2 | Loan-loss allowance (contra-asset) | | ΔECL |

Only the **delta** vs the prior allowance is posted; the transaction is idempotency-keyed on `runId`.

4. **Bureau score** replaces the `720` stub via the AKB / Mərkəzi Kredit Reyestri connector (owned by `banking_loans` at origination; risk consumes stored score). Staged/provisioned exposures feed §12.5 capital and `banking_regreporting`.

### 12.5 Capital, liquidity ratios & limits

- **RWA / CAR:** `computeRwa` applies CBAR risk weights per asset class/rating → `RwaSnapshot`; `capitalAdequacy` → CAR / Tier-1 → `CapitalAdequacySnapshot`. `largeExposures` flags counterparty/group concentration vs capital.
- **Liquidity ratios:** `lcr`/`nsfr` read the operational `LiquidityGapSnapshot` produced by treasury (§ treasury) and compute the **prudential ratios** (today only a `computeLcrRatioStub` exists in treasury — ownership of the ratio moves here; the GAP stays in treasury).
- **Limits:** `RiskLimit` (risk-appetite, distinct from kernel teller/branch limits); `evaluateBreaches` runs in EOD and raises `RiskLimitBreach` + a non-money `SATELLITE_BANK_RISK_LIMIT_BREACHED` event.

### 12.6 EOD / EOM integration (no new scheduler)

Risk batches hook into the existing transactional EOD (`kernel/eod/eod.service.ts`), recorded inside `EodRun.steps` next to the balanced trial balance:

| Cadence | Step |
|---------|------|
| Daily (EOD) | DPD refresh → `runStaging`; `evaluateBreaches`; LCR snapshot |
| Monthly (EOM) | `runEclBatch` → `postProvisions`; `computeRwa` + `capitalAdequacy` |
| On-posting (event) | recompute affected exposure via the post-commit hook (same mechanism as AML, §13.2) |

## §13. Governance deep-dives (worked)

### 13.1 Audit chain — from posting to journal

The kernel guarantees **every money movement produces an immutable audit record atomically with the ledger write**.

**1. Append-only store.** `AuditService` exposes only `append`/`appendInTx` (no update/delete) → `AuditLogEntry` (§2.7).

**2. Audit is written inside the money transaction** (`PostingEngineService.post`): journal transaction + balanced legs + balance updates + audit entry, one `prisma.$transaction`:

```85:94:era-bank-core/apps/api/src/kernel/posting-engine/posting-engine.service.ts
      await this.audit.appendInTx(tx, {
        entity: "JournalTransaction",
        entityId: journalTxn.id,
        action: initialStatus === TxnStatus.POSTED ? "POSTED" : "PENDING",
        afterJson: journalTxn,
        actorUserId: request.makerUserId,
      });

      return journalTxn;
    });
```

**3. Full lifecycle is audited (actor + before/after):**

| Engine action | Audit `action` | Actor | Notes |
|---------------|----------------|-------|-------|
| `post()` | `POSTED` / `PENDING` | maker | in-tx |
| `approve()` | `APPROVED` | checker | in-tx; enforces `checker ≠ maker` |
| `reject()` | `REJECTED` | checker | records reason |
| `reverse()` | `REVERSED` | maker | new mirrored txn; original never mutated |

**4. Integrity around the chain:** balanced legs + debit-ability checked before the audited write; duplicate `idempotencyKey` returns the existing txn (no double post/audit); postings blocked while `EodRun` is `RUNNING`; `emitPostingCommitted` fans out **after** commit so consumers (AML, risk) observe committed state only.

**5. Dual audit.** Kernel `AuditLogEntry` (ledger truth) + satellite `OpsActionLog` in `era-bank` (UI-action trail, `era-bank/app/api/admin/audit`) — both required, mirroring [workforce-dual-audit.md](../docs/adr/workforce-dual-audit.md) / [satellite-mutation-audit.md](../docs/adr/satellite-mutation-audit.md).

```
request ─▶ validate (balanced, can-debit, idempotency, EOD lock)
   └▶ $transaction { JournalTransaction + JournalEntry legs + balance update + audit.appendInTx }
        └▶ (commit) ─▶ emitPostingCommitted ─▶ AML / risk consumers
   approve/reject/reverse ─▶ audit APPROVED/REJECTED/REVERSED (actor, before/after)
   satellite UI actions ─▶ OpsActionLog (second, independent trail)
```

### 13.2 AML alert flow (`banking_aml`)

Kept **separate** from `banking_risk` (different regulator FMN, different lifecycle).

**1. Trigger — post-commit hook** (no kernel→module import): `emitPostingCommitted` (kernel) → `AmlMonitoringService` (registered via `registerPostingCommittedHandler` in `onModuleInit`).

**2. Context** — resolves `customerId`, `customerRiskRating`, 24h velocity (from `JournalEntry`), below-threshold structuring count.

**3. Rules (pure engine `aml-rules.engine.ts`, config in `AmlRule.paramsJson`):**

| Rule code | Logic (default) |
|-----------|-----------------|
| `THRESHOLD_SINGLE_TXN` | any leg debit ≥ 1 500 000 minor |
| `VELOCITY_24H` | 24h debit sum ≥ 5 000 000 |
| `STRUCTURING_PATTERN` | ≥ 3 recent below-threshold debits + a below-threshold leg |
| `HIGH_RISK_CUSTOMER` | `riskRating = HIGH` + a debit leg |
| `CROSS_BORDER` | counterparty IBAN not starting `AZ` |

**4. Alert + non-money event** — `raiseAlert` writes `AmlAlert` (`OPEN`, `MEDIUM`/`HIGH`); best-effort `SATELLITE_BANK_AML_ALERT_RAISED` (BullMQ, never money).

**5. Lifecycle (state machine `aml-workflow.ts`):** `OPEN → UNDER_REVIEW → CLOSED | ESCALATED`; `CLOSED`/`ESCALATED` terminal; `patchAlert` validates transitions and stamps `closedAt`.

**6. Screening** — `screen()` scores a name vs `sanctions-seed.json`; records `AmlScreeningHit`; bumps alert to `HIGH` when score ≥ 80.

**7. FMN reporting** — `createFmnReport` (escalated alerts or explicit ids) → `FmnReport` (`DRAFT`, `institutionMfo` from `ERA_BANK_MFO`); `exportFmnReport` → JSON/XML.

```
posting committed ─▶ AmlMonitoringService ─▶ evaluate AmlRules
   └▶ hit ─▶ AmlAlert(OPEN) ─▶ officer OPEN→UNDER_REVIEW→CLOSED|ESCALATED
              └▶ screen (sanctions) ─▶ AmlScreeningHit (may bump HIGH)
                  └▶ ESCALATED ─▶ FmnReport(DRAFT) ─▶ export → FMN
```

## §14. Phases & Definition of Done

| Phase | DoD |
|-------|-----|
| **P0 Foundation** | `era-bank-core` boots (API 4300 / web 3110, DB `era_bank_core`); orchestrator SSO verifies JWT; `industry_banking` entitlement gate; CBAR chart seeded from data-hub COA template; `Branch` + `BankCustomer` (MDM-linked) + `ProductTemplate` schema migrated; kernel/modules import-boundary lint rule green. |
| **P1 Kernel MVP** | Posting engine: ACID, idempotent, Σ Dr=Σ Cr enforced; current accounts + holds/limits; multi-currency; EOD run produces balanced day snapshot; maker-checker on controlled types; immutable audit; МФР worked example (§7) passes a service test (Σ balanced + netting). |
| **P2 Payments** | Payment orders + internal transfers live; ≥1 external rail adapter (AZIPS or XÖHKS or AÖS) with ISO 20022 messages; statements; idempotent rail ingress. |
| **P3 Products** | `banking_deposits` (term/savings, accrual, capitalization, early close, rollover, ADİF tag); `banking_loans` (origination, annuity/diff schedule, disburse, repay, overdue, restructure, AKB/registry + ƏMDK connectors, IFRS 9 staging). |
| **P4 Compliance** | `banking_aml` (monitoring, screening, FMN report) + `banking_regreporting` (CBAR prudential templates, FATCA/CRS) accepted in a test submission. |
| **P5 Channels** | `banking_dbo` mobile/internet bank + Open API + ASAN İmza/SİMA auth/sign; customer self-service flows. |
| **P6 Cards** | `banking_cards` issue/limits/block + AzeriCard/MilliKart gateway + acquiring; card-txn authorize with holds. |
| **P7 Treasury** | `banking_treasury` FX deals, interbank, GS, liquidity GAP dashboards. |
| **P8 Risk** | `banking_risk` (§12): IFRS 9 staging + ECL batch with provisions posted via kernel; RWA + CAR/Tier-1 snapshot; LCR/NSFR; risk-appetite limits + breach register; risk dashboard. DoD: EOM ECL run posts a balanced provision transaction (Σ Dr=Σ Cr) with maker-checker + immutable audit; CAR snapshot feeds `banking_regreporting`. |

Each phase ships with: DELIVERY checkboxes (`doc/DELIVERY-BANK-CORE.md`), UAT smoke (`doc/UAT-SMOKE.md`), and doc updates per [documentation-upkeep](../.cursor/rules/documentation-upkeep.mdc).

## §15. Open questions (to resolve before P2/P4)

- AZIPS / XÖHKS / AÖS participant onboarding and ISO 20022 message profiles (CBAR sandbox access).
- CBAR prudential report templates & submission channel.
- Card scheme strategy: external processor vs in-house issuing.
- On-prem reference-data packaging (offline data-hub snapshot cadence).
- Crypto key custody model in bank-managed deployments.
