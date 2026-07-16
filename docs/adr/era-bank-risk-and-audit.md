# ADR: ERA Bank — Risk Management (`banking_risk`) and the Audit Chain

**Status:** Proposed (pre-development; extends the accepted `era-bank-core` MVP)
**Decision owners:** Platform architecture + banking domain.
**Related:** [era-bank-core.md](./era-bank-core.md) · [org-operating-mode.md](./org-operating-mode.md) · [satellite-mutation-audit.md](./satellite-mutation-audit.md) · [workforce-dual-audit.md](./workforce-dual-audit.md) · [CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md)
**Product docs:** [era-bank-core/PRD.md](../../era-bank-core/PRD.md) · [era-bank-core/TZ.md](../../era-bank-core/TZ.md) · [era-bank/PRD.md](../../era-bank/PRD.md)
**Module map:** [era-bank-core-module-map.mdc](../../.cursor/rules/era-bank-core-module-map.mdc) · [MODULES_CATALOG.md](../MODULES_CATALOG.md)

---

## Context

The accepted ADR [era-bank-core.md](./era-bank-core.md) established a Core Banking System (CBS) as a headless regulated engine (`era-bank-core`) plus an operational satellite (`era-bank`), with a thin universal kernel (L1) and pluggable `banking_*` product modules (L2). That ADR intentionally scoped the *products* (deposits, loans, cards, payments, AML, treasury, reg-reporting) but left **enterprise risk management** implicit.

Today, "risk" exists in the codebase only as **attributes and side-effects scattered across product modules**:

| Risk concern | Where it lives today | Maturity |
|--------------|----------------------|----------|
| Financial-crime risk (AML/CFT) | `modules/aml/*` (own module) | Implemented (rules engine, alerts, screening, FMN) |
| Credit risk (staging, scoring, collateral) | `LoanContract.ifrs9Stage` / `akbScore` / `collateralRef` fields, manual `restructure()` | Field-only; no ECL/provisioning/NPL engine |
| KYC/customer risk | `BankCustomer.riskRating`, `pepFlag` | Attribute; consumed by AML |
| Liquidity risk / ALM | `modules/treasury/liquidity-gap.engine.ts`, `LiquidityGapSnapshot`, `computeLcrRatioStub` | GAP buckets real; LCR is a stub; no NSFR |
| Regulatory capital (RWA, CAR, large exposure) | — | **No owner** |
| Market risk / IRRBB | partial in treasury (FX position) | No repricing-gap / sensitivity engine |
| Operational risk controls | kernel maker-checker, holds/limits, immutable audit | Controls exist; no KRI/limit-breach register |

Two structural facts drive this ADR:

1. **Several risk domains have no natural home.** ECL provisioning spans loans + cards + off-balance; RWA/CAR and large-exposure limits span *all* exposures and are consumed by `regreporting` (which today only formats CBAR/FATCA-CRS templates, it does not compute the numbers). Putting these inside `loans` or `treasury` would leak cross-cutting logic into a single product module.
2. **The thin-kernel rule (ADR D2) forbids risk math in L1.** Risk weightings, PD/LGD, staging rules and capital ratios are bank-customized and regulation-versioned — by definition L2/L3, never L1.

Goal of this ADR: define a dedicated **`banking_risk` L2 module** with an explicit scope, function map, data model and integration seams — and formally document the **audit chain** that already underpins every money movement, since risk and audit are the two governance pillars a bank regulator (CBAR) examines first.

## Decision

### R1 — `banking_risk` is a NEW L2 module: a calculation & orchestration layer, not a ledger

`banking_risk` is added as an L2 `banking_*` module (like `banking_loans`), spanning both apps (engine math/API in `era-bank-core`, UI in `era-bank`), gated by its own commercial key.

Non-negotiable boundaries:

| Rule | Statement |
|------|-----------|
| **Not in kernel** | Risk math is bank/regulation-specific → L2, never L1 (ADR D2 thin-kernel). |
| **No parallel ledger** | Every risk-driven money movement (ECL provision, write-off, allowance release) is posted through `kernel/posting-engine` in one ACID transaction (ADR D6). `banking_risk` **orchestrates**; the kernel **posts**. Risk owns only **read-models / snapshots** (staging, ECL results, RWA, limits, breaches), never customer balances. |
| **No money over the bus** | Risk publishes only non-money events (`SATELLITE_BANK_RISK_*`) for notification/analytics (ADR D6). |
| **Consumes, does not duplicate exposures** | Exposures are read from `LoanContract`, `Card`, `Account`, treasury deals, GL — risk stores derived risk state keyed back to those records, not copies of principal/balance. |
| **AML stays separate** | Financial-crime risk remains `banking_aml` (different regulator FMN, different lifecycle). `banking_risk` covers prudential/credit/market/liquidity/operational risk. The two are siblings, not merged. |

### R2 — Domain scope: what `banking_risk` owns (and what it does not)

**Owns (new):**

1. **Credit risk & IFRS 9 ECL** — staging engine (Stage 1/2/3 from days-past-due + qualitative triggers), ECL calculation (PD × LGD × EAD), collateral valuation & haircuts, NPL classification, provision posting orchestration, forbearance/restructuring risk flags. (See deep dive B.)
2. **Regulatory capital** — RWA computation (credit/market/operational risk weights per CBAR), Capital Adequacy Ratio (CAR) / Tier-1, large-exposure & concentration ratios. Feeds `banking_regreporting` (which formats, does not compute).
3. **Market risk & IRRBB** — interest-rate repricing gap (banking book), FX open-position risk (consumes treasury positions), simple scenario/sensitivity shocks.
4. **Prudential liquidity ratios** — **LCR / NSFR** computation (today only a `computeLcrRatioStub` in treasury). The *operational* liquidity GAP stays in `treasury`; `banking_risk` reads `LiquidityGapSnapshot` and produces the *prudential ratios*.
5. **Risk-appetite limits framework** — counterparty / sector / product / large-exposure limits + breach register, distinct from kernel teller/branch operational limits.
6. **Operational-risk KRIs** (light) — a KRI / incident register that reads the kernel immutable audit log; no new control plane.

**Does NOT own (keep where they are):**

- AML/CFT monitoring, screening, FMN — stays in `banking_aml`.
- Teller/branch posting limits, holds, maker-checker, EOD locking, immutable audit — stay in **L1 kernel**.
- Operational liquidity GAP buckets and FX dealing — stay in `banking_treasury`.
- The regulatory *report formatting/submission* — stays in `banking_regreporting` (consumes risk outputs).

### R3 — Module & function map

Engine (`era-bank-core/apps/api/src/modules/risk/`):

| Service | Key functions |
|---------|---------------|
| `credit-risk.service.ts` | `classifyStage(loanId)`, `runStaging(asOfDate)` (batch), `calculateEcl(exposureRef)`, `runEclBatch(asOfDate)`, `postProvisions(runId)` (via posting-engine), `valuateCollateral(collateralRef)` |
| `ecl.engine.ts` (pure) | `pd(stage, score)`, `lgd(collateralCoverage)`, `ead(outstanding, undrawn)`, `eclAmount(pd, lgd, ead)` — pure, testable, no I/O |
| `staging.engine.ts` (pure) | `stageFromDpd(daysPastDue, qualitativeFlags)`, `isNpl(stage, dpd)`, `isSicr(...)` (significant increase in credit risk) |
| `capital.service.ts` | `computeRwa(asOfDate)`, `capitalAdequacy(asOfDate)` (CAR/Tier-1), `largeExposures(asOfDate)` |
| `rwa.engine.ts` (pure) | `riskWeight(assetClass, rating)`, `rwaForExposure(exposure)` |
| `market-risk.service.ts` | `repricingGap(asOfDate)`, `fxOpenPosition(asOfDate)`, `sensitivity(scenario)` |
| `liquidity-ratio.service.ts` | `lcr(asOfDate)`, `nsfr(asOfDate)` (reads treasury `LiquidityGapSnapshot`) |
| `risk-limits.service.ts` | `listLimits()`, `upsertLimit(input)`, `evaluateBreaches(asOfDate)`, `raiseBreach(limitId, ...)` |
| `risk.service.ts` | dashboard aggregation (portfolio staging mix, provision coverage, CAR, top limit breaches) |

Engine routes (`/api/v1`, consumed by the `era-bank` BFF):

| Area | Routes |
|------|--------|
| Credit risk / ECL | `GET /risk/exposures`, `GET /risk/exposures/:id`, `POST /risk/staging/run`, `POST /risk/ecl/run`, `GET /risk/ecl/runs/:id`, `POST /risk/ecl/runs/:id/post-provisions` |
| Collateral | `GET/POST /risk/collateral`, `POST /risk/collateral/:id/valuate` |
| Capital | `GET /risk/rwa`, `GET /risk/capital-adequacy`, `GET /risk/large-exposures` |
| Market / IRRBB | `GET /risk/repricing-gap`, `GET /risk/fx-position`, `POST /risk/scenarios/run` |
| Liquidity ratios | `GET /risk/lcr`, `GET /risk/nsfr` |
| Limits | `GET/PUT /risk/limits/:code`, `GET /risk/limit-breaches` |
| Dashboard | `GET /risk/dashboard` |

Satellite UI (`era-bank/app/risk/*`, role `Risk / credit officer`, plus read views for management SSO):

- `risk/portfolio` — staging mix, NPL ratio, provision coverage
- `risk/ecl` — ECL runs, drill-down per exposure, "post provisions" (maker-checker)
- `risk/collateral` — register + valuations
- `risk/capital` — RWA, CAR/Tier-1, large exposures
- `risk/alm` — repricing gap, FX position, LCR/NSFR
- `risk/limits` — limit framework + breach register
- `risk/dashboard` — executive risk overview

### R4 — Audit is kernel-owned, immutable, and part of every money transaction

The audit chain is **not** a `banking_risk` concern to re-implement; it is a **kernel (L1) invariant** (ADR D6 "Immutable audit"). This ADR *documents and ratifies* the existing chain (deep dive C) and states the rule for risk:

- `banking_risk` provision/write-off postings flow through `kernel/posting-engine`, which **appends an immutable `AuditLogEntry` inside the same DB transaction** as the posting — so a provision can never be posted without its audit record, and vice versa.
- `banking_risk` never writes to `audit_log_entries` directly; it only reads the log (for operational-risk KRIs) and relies on the posting-engine to record its money movements.
- The `era-bank` operational `OpsActionLog` (UI-action audit) is a **separate, satellite-side** trail from the kernel ledger audit; both are required (dual audit, mirroring [workforce-dual-audit.md](./workforce-dual-audit.md)).

### R5 — Batch risk runs hook into EOD/EOM, not a new scheduler

`banking_risk` reuses the existing transactional EOD process (`kernel/eod/eod.service.ts`), which already orchestrates `liquidityGap`, FX revaluation, card settlement and trial balance:

| Cadence | Risk step | Mechanism |
|---------|-----------|-----------|
| **Daily (EOD)** | DPD refresh → `runStaging(businessDate)`; limit-breach evaluation; LCR snapshot | new step in `eod.service.run()` after treasury gap |
| **Monthly (EOM)** | `runEclBatch` → `postProvisions` (allowance/expense GL); RWA & CAR snapshot | EOM branch of EOD |
| **On-posting (event)** | recompute exposure risk for the affected loan/card | post-commit hook (same pattern AML uses — see deep dive A) |

Risk batch steps run **inside the EOD run record** so their outcome is captured in `EodRun.steps` alongside the balanced trial balance, keeping one auditable close.

### R6 — Commercial key and gating

| Layer | Key | Notes |
|-------|-----|-------|
| Module | `banking_risk` | L2, `satellite_key = industry_banking`; depends on `banking_core`; strongly complements `banking_loans` + `banking_treasury` |
| Bundle | included in `banking_bundle_universal` | not in `banking_bundle_retail` by default |

Gating identical to other `banking_*` modules: satellite checks entitlement in the `era-bank` BFF; the engine enforces per-bank config. No new gating mechanism.

### R7 — Data model additions (risk read-models only)

New models in `era-bank-core` (all `bankOrgId`-scoped, `@@index([bankOrgId, ...])`):

| Model | Purpose |
|-------|---------|
| `RiskExposure` | Normalized exposure record keyed to `loanId`/`cardId`/off-balance ref; `ead`, `stage`, `dpd`, `assetClass` |
| `EclCalculationRun` | One ECL batch per `asOfDate`; status; totals |
| `EclResult` | Per-exposure PD/LGD/EAD/ECL for a run |
| `CollateralItem` + `CollateralValuation` | Collateral register (extends `LoanContract.collateralRef`) with haircuts |
| `RwaSnapshot` / `CapitalAdequacySnapshot` | RWA and CAR/Tier-1 as-of snapshots |
| `LargeExposure` | Concentration/large-exposure records per counterparty/group |
| `RiskLimit` + `RiskLimitBreach` | Risk-appetite limits and their breaches |

Provision/write-off **postings** reuse existing `JournalTransaction`/`JournalEntry` (new GL codes for loan-loss allowance/expense in the CBAR chart) — no new ledger tables.

---

## Deep dive A — Full AML alert flow (as implemented)

This documents the **existing** `banking_aml` pipeline (ratified here as the reference pattern `banking_risk` follows for event-driven evaluation). It is kept a **separate module** from `banking_risk` (R1/R2).

**1. Trigger — post-commit hook (no kernel→module import).**
The posting engine emits a committed-transaction event *after* the money transaction commits, via a registry that lets modules subscribe without the kernel importing them:

```19:27:era-bank-core/apps/api/src/kernel/posting-engine/posting-hooks.registry.ts
export function registerPostingCommittedHandler(handler: Handler): void {
  handlers.push(handler);
}

export async function emitPostingCommitted(payload: PostingCommittedPayload): Promise<void> {
  for (const handler of handlers) {
    await handler(payload).catch(() => undefined);
  }
}
```

`AmlMonitoringService` registers on module init and evaluates each committed transaction:

```30:32:era-bank-core/apps/api/src/modules/aml/aml-monitoring.service.ts
  onModuleInit() {
    registerPostingCommittedHandler((payload) => this.evaluatePostedTransaction(payload));
  }
```

**2. Context assembly.** For the transaction's account it resolves `customerId` and `customerRiskRating`, computes 24h velocity from `JournalEntry` history, and counts recent below-threshold debits (structuring signal) — all scoped by `bankOrgId`.

**3. Rule evaluation (pure engine).** Enabled `AmlRule` rows (config, `paramsJson`) are evaluated by pure functions in `aml-rules.engine.ts`:

| Rule code | Logic (default) |
|-----------|-----------------|
| `THRESHOLD_SINGLE_TXN` | any leg debit ≥ `thresholdMinor` (1 500 000) |
| `VELOCITY_24H` | 24h debit sum ≥ `limitMinor` (5 000 000) |
| `STRUCTURING_PATTERN` | ≥ 3 recent below-threshold debits + a below-threshold leg |
| `HIGH_RISK_CUSTOMER` | `riskRating = HIGH` and a debit leg |
| `CROSS_BORDER` | counterparty IBAN not starting `AZ` |

**4. Alert raise + non-money event.** On a hit, `AmlService.raiseAlert` writes an `AmlAlert` (`OPEN`, severity `MEDIUM`, or `HIGH` for high-risk), then a best-effort BullMQ event is published (never money):

```132:146:era-bank-core/apps/api/src/modules/aml/aml-monitoring.service.ts
      const alert = await this.aml.raiseAlert({
        ruleCode: rule.code,
        narrative,
        severity: rule.code === "HIGH_RISK_CUSTOMER" ? AmlSeverity.HIGH : AmlSeverity.MEDIUM,
        customerId,
        transactionId: payload.transactionId,
        amountMinor,
        currency,
      });

      await this.events.publishAmlAlertRaised({
        alertId: alert.id,
        ruleCode: rule.code,
        severity: alert.severity,
      }).catch((err) => {
```

**5. Alert lifecycle (state machine).** Transitions are enforced; `CLOSED`/`ESCALATED` are terminal:

```3:12:era-bank-core/apps/api/src/modules/aml/aml-workflow.ts
const ALLOWED_TRANSITIONS: Record<AmlAlertStatus, AmlAlertStatus[]> = {
  [AmlAlertStatus.OPEN]: [
    AmlAlertStatus.UNDER_REVIEW,
    AmlAlertStatus.CLOSED,
    AmlAlertStatus.ESCALATED,
  ],
  [AmlAlertStatus.UNDER_REVIEW]: [AmlAlertStatus.CLOSED, AmlAlertStatus.ESCALATED],
  [AmlAlertStatus.CLOSED]: [],
  [AmlAlertStatus.ESCALATED]: [],
};
```

`patchAlert` validates the transition, assigns officer, stores `resolutionNote`, and stamps `closedAt` on `CLOSED`/`ESCALATED`.

**6. Sanction screening.** `AmlService.screen` scores a name against `sanctions-seed.json` (`scoreSanctionMatch`), records an `AmlScreeningHit`, and escalates the linked alert to `HIGH` when score ≥ `SCREEN_THRESHOLD` (80).

**7. FMN reporting.** `createFmnReport` gathers escalated alerts (or explicit IDs) for a period into an `FmnReport` (`DRAFT`, `schemaVersion FMN-TEST-1`, `institutionMfo` from `ERA_BANK_MFO`); `exportFmnReport` renders JSON or XML.

**8. Actors / routes / UI.** Compliance/AML officer via `GET /aml/alerts`, `GET /aml/alerts/:id`, `PATCH /aml/alerts/:id`, `POST /aml/alerts/:id/escalate`, `GET/PUT /aml/rules/:code`, `POST /aml/screen`, `POST /aml/reports/fmn`, `GET /aml/reports/fmn/:id/export`; UI under `era-bank/app/aml/*`.

**Flow summary:**

```
posting committed ──emitPostingCommitted──▶ AmlMonitoringService
   └▶ assemble context (customer, riskRating, 24h velocity, structuring count)
      └▶ evaluate enabled AmlRules (pure engine)
         └▶ hit ─▶ AmlAlert(OPEN) ─▶ publishAmlAlertRaised (BullMQ, non-money)
                     └▶ officer: OPEN→UNDER_REVIEW→CLOSED|ESCALATED
                         └▶ screen (sanctions) ─▶ AmlScreeningHit (may bump HIGH)
                             └▶ ESCALATED ─▶ FmnReport(DRAFT) ─▶ export JSON/XML → FMN
```

---

## Deep dive B — Credit risk / IFRS 9 (current state → target)

**Current state (loans module).** Credit risk is a **field + manual setter**, not an engine:

- `LoanContract.ifrs9Stage` (default `1`), `akbScore`, `collateralRef` exist on the model.
- `originate()` computes an annuity schedule and hardcodes `akbScore: 720` (a **stub** for bureau scoring), status `APPROVED`.
- `disburse()` / `repay()` post real double-entry via the kernel posting engine (loan portfolio GL `1300101`, interest income GL `4100101`).
- Staging is only ever changed **manually**:

```216:220:era-bank-core/apps/api/src/modules/loans/loans.service.ts
  restructure(id: string, ifrs9Stage: number) {
    return this.prisma.loanContract.updateMany({
      where: { id, bankOrgId: this.bankOrg.bankOrgId },
      data: { ifrs9Stage, status: LoanStatus.ACTIVE },
    });
  }
```

**Gaps:** no DPD-driven staging, no PD/LGD/EAD ECL computation, no provision postings, no collateral valuation/haircuts, no NPL classification job, bureau score is a stub.

**Target (`banking_risk`, R2/R3/R5):**

1. **Staging engine** (`staging.engine.ts`, pure): `stageFromDpd(dpd, qualitativeFlags)` → Stage 1 (performing), Stage 2 (SICR, e.g. 30–89 DPD or watch flags), Stage 3 (impaired / NPL ≥ 90 DPD). Run daily in EOD: `runStaging(businessDate)` updates `RiskExposure.stage` and flips `LoanContract`/installment status where NPL.
2. **ECL engine** (`ecl.engine.ts`, pure): `ecl = pd(stage, score) × lgd(collateralCoverage) × ead(outstanding, undrawn)`. Stage 1 = 12-month ECL; Stage 2/3 = lifetime ECL.
3. **Collateral** (`valuateCollateral`): `CollateralItem` + `CollateralValuation` with haircuts feed LGD (ƏMDK registry integration per era-bank-core PRD).
4. **Provisioning (atomic, via kernel):** `runEclBatch(asOfDate)` produces `EclResult` rows; `postProvisions(runId)` posts the **allowance/expense** double-entry through `kernel/posting-engine` in one transaction (ADR D6) — with maker-checker on the provision batch. No parallel ledger.
5. **Bureau score** replaces the `720` stub via the AKB / Mərkəzi Kredit Reyestri connector (owned by `banking_loans` at origination; `banking_risk` consumes the stored score).
6. **Feeds capital:** staged/provisioned exposures feed `computeRwa` → CAR (R2 §2) and `banking_regreporting`.

**Flow summary:**

```
EOD daily:  refresh DPD ─▶ runStaging ─▶ RiskExposure.stage (+NPL flip)
EOM:        runEclBatch ─▶ EclResult(pd,lgd,ead,ecl) ─▶ postProvisions
                                                         └▶ kernel posting-engine
                                                            (allowance/expense GL, ACID + audit)
            computeRwa ─▶ RwaSnapshot ─▶ capitalAdequacy ─▶ regreporting (CBAR)
```

---

## Deep dive C — Audit chain from posting to journal (as implemented)

The kernel guarantees that **every money movement produces an immutable audit record atomically with the ledger write**. This is the backbone risk and compliance rely on.

**1. Immutable, append-only store.** `AuditService` (kernel) exposes only `append` / `appendInTx` — no update or delete — writing to `AuditLogEntry` (`entity`, `entityId`, `action`, `beforeJson`, `afterJson`, `actorUserId`, `at`, `bankOrgId`):

```36:48:era-bank-core/apps/api/src/kernel/audit/audit.service.ts
  appendInTx(tx: Prisma.TransactionClient, input: AuditAppendInput) {
    return tx.auditLogEntry.create({
      data: {
        bankOrgId: this.bankOrg.bankOrgId,
        entity: input.entity,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.beforeJson as Prisma.InputJsonValue | undefined,
        afterJson: input.afterJson as Prisma.InputJsonValue | undefined,
        actorUserId: input.actorUserId,
      },
    });
  }
```

**2. Audit is written inside the money transaction.** In `PostingEngineService.post`, the journal transaction, its balanced legs, the balance updates **and** the audit entry all happen in one `prisma.$transaction` — so a posting can never exist without its audit record:

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

**3. Full lifecycle is audited with actor + before/after.**

| Engine action | Audit `action` | Actor | Notes |
|---------------|----------------|-------|-------|
| `post()` | `POSTED` or `PENDING` | `makerUserId` | in-tx; controlled types require approval |
| `approve()` | `APPROVED` | `checkerUserId` | in-tx; enforces `checker ≠ maker` (4-eyes) |
| `reject()` | `REJECTED` | `rejectedByUserId` | records reason |
| `reverse()` | `REVERSED` | `makerUserId` | records `reversalId`; mirrored txn itself audits `POSTED` |

Maker-checker enforcement lives right next to the audit write:

```120:125:era-bank-core/apps/api/src/kernel/posting-engine/posting-engine.service.ts
      if (journalTxn.status !== TxnStatus.PENDING) {
        throw new BadRequestException("Only PENDING transactions can be approved");
      }
      if (journalTxn.makerUserId === request.checkerUserId) {
        throw new BadRequestException("Checker must differ from maker");
      }
```

**4. Integrity guarantees around the chain.**

- **Balanced legs** (`assertBalancedLegs`) and **debit-ability** (`assertAccountCanDebit`: ACTIVE, currency match, available = ledger − holds + overdraft) are checked before the audited write.
- **Idempotency:** a duplicate `idempotencyKey` returns the existing transaction — no double post, no double audit.
- **EOD lock:** postings are blocked while an `EodRun` is `RUNNING`, so the close snapshot is consistent.
- **Post-commit fan-out:** `emitPostingCommitted` runs *after* commit, so downstream consumers (AML today, `banking_risk` tomorrow) observe only committed state and never sit inside the money transaction.

**5. Two-tier audit (dual audit).** The kernel `AuditLogEntry` (ledger truth) is complemented by the satellite `OpsActionLog` in `era-bank` (UI-action trail, surfaced at `era-bank/app/api/admin/audit`). Both are required — the same dual-audit discipline as [workforce-dual-audit.md](./workforce-dual-audit.md) and [satellite-mutation-audit.md](./satellite-mutation-audit.md).

**Chain summary:**

```
request ─▶ validate (balanced, can-debit, idempotency, EOD lock)
   └▶ $transaction { JournalTransaction + JournalEntry legs + balance update + audit.appendInTx }
        └▶ (commit) ─▶ emitPostingCommitted ─▶ AML / risk consumers
   approve/reject/reverse ─▶ audit APPROVED/REJECTED/REVERSED (actor, before/after)
   satellite UI actions ─▶ OpsActionLog (second, independent trail)
```

---

## Consequences

**Positive**

- Cross-cutting risk domains (ECL provisioning, RWA/CAR, large exposures, LCR/NSFR) gain a single owner instead of leaking into product modules.
- Thin kernel and single-ledger invariants are preserved: risk computes, kernel posts, audit stays atomic.
- Reuses proven seams (post-commit hook, EOD orchestration, posting-engine, entitlement gating) — no new infrastructure.
- Closes the regulatory-minimum gap (IFRS 9 ECL + capital adequacy) that CBAR examines.

**Negative / costs**

- Significant net-new domain (staging, ECL, RWA, IRRBB, limits) requiring risk/quant expertise; multi-phase.
- ECL/RWA parameters (PD/LGD, risk weights) are regulation-versioned config — needs governance to keep current.

**Risks**

- Kernel leakage (risk math into L1) — mitigated by R1 (L2-only) and the D2 review rule.
- A parallel provisions ledger — explicitly forbidden by R1/R4 (post via kernel).
- Double-counting exposures — mitigated by R1 (consume, don't duplicate).

## Alternatives considered

1. **Extend `banking_loans` with ECL/provisioning.** Rejected: RWA/CAR/large-exposure/liquidity span all exposures, not just loans; would violate module cohesion.
2. **Put risk aggregation in `banking_regreporting`.** Rejected: reporting formats/submits; mixing computation into it conflates concerns. Reg-reporting consumes risk outputs instead.
3. **Risk calculations in the kernel.** Rejected: violates the D2 thin-kernel rule (bank/regulation-specific math).
4. **Keep risk as scattered fields (status quo).** Rejected: leaves capital adequacy and ECL with no owner — not a certifiable CBS.

## Implementation references (target)

- Engine: `era-bank-core/apps/api/src/modules/risk/*` (services + pure engines per R3), routes `/api/v1/risk/*`.
- Data model: new risk read-models per R7 in `era-bank-core/packages/database/prisma/schema.prisma`; provision GL codes added to the CBAR seed.
- EOD/EOM hooks: `era-bank-core/apps/api/src/kernel/eod/eod.service.ts` (new risk steps recorded in `EodRun.steps`).
- Satellite UI: `era-bank/app/risk/*` (BFF proxy + screens, role `Risk / credit officer`).
- Contracts: `packages/era-contracts/src/events/banking.events.ts` — add non-money `SATELLITE_BANK_RISK_*` events.
- Commercial: `banking_risk` in orchestrator `pricing_modules` (bundle `banking_bundle_universal`); gating via `era-bank` BFF.
- Docs to update on delivery: [MODULES_CATALOG.md](../MODULES_CATALOG.md) (status → MVP/SHIPPED), [READINESS_MATRIX.md](../READINESS_MATRIX.md), [COVERAGE_MATRIX.md](../COVERAGE_MATRIX.md) (add Ops/SatAdmin/OrgOwner rows), [era-bank-core-module-map.mdc](../../.cursor/rules/era-bank-core-module-map.mdc).
