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
      deposits/  loans/  cards/  payments/  aml/  treasury/  regreporting/
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
```

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
//   SATELLITE_BANK_PAYMENT_POSTED, SATELLITE_BANK_AML_ALERT_RAISED
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
- **AML:** `banking_aml` monitors postings (read side), screens against sanction lists (data-hub shelf C), files FMN reports.
- **Reg reporting:** `banking_regreporting` produces CBAR prudential templates + FATCA/CRS.
- **Data residency:** on-prem deployment with on-prem reference data (no public data-hub dependency).

## §12. Phases & Definition of Done

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

Each phase ships with: DELIVERY checkboxes (`doc/DELIVERY-BANK-CORE.md`), UAT smoke (`doc/UAT-SMOKE.md`), and doc updates per [documentation-upkeep](../.cursor/rules/documentation-upkeep.mdc).

## §13. Open questions (to resolve before P2/P4)

- AZIPS / XÖHKS / AÖS participant onboarding and ISO 20022 message profiles (CBAR sandbox access).
- CBAR prudential report templates & submission channel.
- Card scheme strategy: external processor vs in-house issuing.
- On-prem reference-data packaging (offline data-hub snapshot cadence).
- Crypto key custody model in bank-managed deployments.
