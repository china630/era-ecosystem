# ADR: Nafta program quota knots (Wave B)

**Status:** Accepted  
**Date:** 2026-08-30  
**Amended:** 2026-09-07 — entitlement **blocks** with explicit SKU membership (CLI-51 editor)  
**Amended:** 2026-09-07 — **template versioning** + instance pin / entitlement snapshot  
**Amended:** 2026-09-08 — admin save **in-place** when template has zero `ProgramInstance` pins  
**Amended:** 2026-09-08 — product **validity window** (`effectiveFrom` / `effectiveTo`); delete of a pinned package closes it instead of erasing  
**Amended:** 2026-09-08 — W1 entitlement usage COUNT SoT (LabOrderItem / VisitServiceLine stamps)  
**Amended:** 2026-09-09 — block **kind** selects membership catalog + derives `fulfillment`; admin hides İcra

## Decision

1. Quota SoT = `ProgramTemplateQuotaKnot` (nights × **block/entitlement code** × qty), not flat `ProgramTemplateProcedure.quotaTotal`.
2. `quotaFor` clamps to `maxNights`, refuses below `minNights`, interpolates between adjacent PDF columns (`Math.round`).
3. Stay nights come from hotel check-in/out; `endsOn` follows checkout.
4. Package/night change → `recalcProgramQuotas`; **never** cancel `CHECKED_IN`/`COMPLETED`; drop orphan `PROPOSED`. **Amended 2026-09-04** ([clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md)): when stay **shortens**, also cancel **future non-consumed** `SCHEDULED` past the new end and return unused quota (1 code/category/day sync). Do not silently delete COMPLETED; over-consumed vs new total → pay path.
5. Charging: in-quota `amountNet=0` when a balance line exists (ignore global `packageIncluded`); over-quota = **list price** (`ServiceCatalogCache.listAmount` ?? `amount`); walk-in without instance always paid. Missing list → `priceMissing` (do not invent silent zeros as truth). See `entitlement-charge.service.ts` (W3).

## Entitlement blocks (2026-09-07)

PDF “free vs paid physio” is marketing, not a second price lane. SoT is **package entitlement**:

| Concept | Storage | Runtime |
|---------|---------|---------|
| **Block** (e.g. Physio, Paraffin, Naftalan bath) | `ProgramTemplateProcedure` row — `procedureCode` is the balance / knot key (`PHYSIO_POOL`, `PARAFFIN_POOL`, `NAFTALAN_BATH`, or custom) | One `ProgramProcedureBalance` line; matrix qty is **per block**, not per SKU |
| **Membership** | `ProgramTemplateBlockMember` (`templateId` + `blockCode` + SKU code) | ProcedureType **or** diagnostic service code; assign/burn whitelist |
| **Kind** (UI) | `ProgramTemplateProcedure.kind` — `PHYSIO` \| `BATH` \| `PARAFFIN` \| `LAB` \| `EXAM` \| `CUSTOM` | Catalog cascade + grouping; **derives** `fulfillment` |

**Membership picker:** PHYSIO / BATH / PARAFFIN → `ProcedureType` filtered by family; LAB → diagnostic `lab_panel` (optional lab group); EXAM → diagnostic `visit`; CUSTOM → type-ahead across those catalogs (min 2 chars). Do not dump the unfiltered treatment catalog into a lab block.

**Fulfillment (runtime, not a second admin type):** `LAB` → `LAB_ORDER`, `EXAM` → `VISIT`, treatment/custom → `PROCEDURE_ORDER`. Nested block modal does **not** show İcra.

Rules:

6. Admin `/admin/program-templates` edit modal is **wide** (`max-w-4xl`); operator creates **dynamic blocks**, attaches member SKUs, edits **knot qty per block**.
7. Knot **columns** = PDF/rate knots only (chips 7 / 10 / 14 / 21 + optional custom nights). **Do not** require every integer night from min…max; `quotaFor` interpolates.
8. When a block has **configured members**, `eligibleSkusForPool` uses that whitelist (no broad catalog heuristic). Empty members + legacy `*_POOL` → keep heuristic fallback for dual-run.
9. Single configured member → assign may auto-resolve that SKU and burn the block balance (same idea as NAFTALAN_BATH + known sex).
10. Premium vs Standart = different membership and/or higher block qtys — **not** a “paid-inside-package” flag.
11. LAB / EXAM blocks may exist for package documentation / future checklist; package-assign treatment menu still filters non-treatment lines (`isPackageAssignTreatmentLine`).

## Template versioning + guest pin (2026-09-07)

Composition edits must **not** rewrite the contract of stays already opened.

| Rule | Behavior |
|------|----------|
| **Identity** | Stable product `code` (e.g. `PKG-STANDART`) + integer `version`. Unique `(organizationId, code, version)`. |
| **Current** | Exactly one row per `code` with `isCurrent=true` / `retiredAt=null` for new check-ins. |
| **Save composition** | If **any** `ProgramInstance` pins this row → insert **new version** (previous retired; stays keep pin). If **zero** pins → **in-place** mutate current row (bootstrap / fill empty quotas without v+1). |
| **One current** | Partial unique index `(organization_id, code) WHERE is_current` — at most one sellable row per code. |
| **Snapshot prefer** | Assign reads `entitlementSnapshot` whenever present (including empty `members` = frozen empty/heuristic). Null snapshot only until backfill. |
| **Backfill** | Migration / `POST ?action=backfill-snapshots` fills null snapshots from the pinned template. |
| **Seed / import** | Skip or `ensureWritableCurrentTemplate` (bump) before mutating a current row that has instances. |
| **GC** | `POST ?action=purge-retired` deletes retired versions with **zero** `ProgramInstance` pins. |
| **Support UX** | Admin: show retired toggle + version badge; package-assign shows `code · vN` pin. |
| **Pin** | `ProgramInstance.templateId` stays on the version used at instantiate (or at last explicit package **code** change). Night-only recalc must **not** re-point to latest. |
| **Lookup** | `findCurrentProgramTemplate(code)` for new instantiate / sanatorium package picker. |

Retired versions remain readable for pinned instances and audit; hard-delete forbidden while any instance references the row.

## Validity window (2026-09-08)

`retiredAt` is a **technical** supersession stamp (v+1 was created). Commercial availability is a separate,
admin-owned window so an operator can retire a product line without a code migration.

| Rule | Behavior |
|------|----------|
| **Columns** | `ProgramTemplate.effectiveFrom` / `effectiveTo` (`@db.Date`, Asia/Baku calendar day). `effectiveTo = null` → open-ended. |
| **Create** | `effectiveFrom` defaults to today; `effectiveTo` empty. |
| **Edit** | Both dates are admin metadata — editing them **never** bumps the version, even when guests pin the row. Contract/composition rules are unchanged. |
| **Range** | `effectiveTo < effectiveFrom` → `400 INVALID_VALIDITY_RANGE`. |
| **Lookup** | `sellableTemplateWhere()` (current version ∧ today ∈ window) backs both `findCurrentProgramTemplate(code)` and `GET /api/sanatorium/program-templates`, so an expired package cannot be picked and then fail at instantiate. Legacy `null` bounds stay sellable (no backfill needed for old rows). |
| **Delete (no pins)** | Hard delete, as before. |
| **Delete (pinned)** | No longer `409 HAS_INSTANCES`: `closeProgramTemplateValidity` writes `effectiveTo = today`, `isCurrent=false`, `retiredAt=now`. Open stays keep their `entitlementSnapshot`; new check-ins stop resolving the code. |
| **Version carry** | A v+1 bump copies the window to the new row; the superseded row keeps its own dates. |

Closing the window is **not** retroactive: instances already pinned keep running to their `endsOn`.

## Usage counter — single source (2026-09-08 W1)

| Rule | Behavior |
|------|----------|
| **SoT** | `ProgramProcedureBalance.quotaUsed` = COUNT of in-package fulfillments by `packageQuotaCode` (fallback: service/procedure code). |
| **Entities** | `ProcedureOrder` + `LabOrderItem` + `VisitServiceLine` (each has `inPackage` + `packageQuotaCode`). |
| **API** | `syncEntitlementUsage` / `countEntitlementUsage` in `entitlement-usage.service.ts`. Assign’s `syncQuotaUsed` is a thin wrapper. |
| **No increment** | `useProcedureQuota` is read-only (`isOverEntitlementQuota`); never `quotaUsed: { increment }`. |
| **Pool key** | Charge/over-quota resolve via `packageQuotaCode` (e.g. `PHYSIO_POOL`), not the bookable SKU alone. |
| **4th same-day** | Strips `inPackage` / `packageQuotaCode` on the order and re-syncs COUNT (no decrement). |
| **Status sets** | Procedure: SCHEDULED/CHECKED_IN/COMPLETED/NO_SHOW. Lab: ORDERED→COMPLETED (not CANCELLED). Visit: IN_PROGRESS/COMPLETED. |
| **Snapshot** | `PackageBalanceRow.assignable` — treatment lines true; intake labs/exams false (read-only in assign UI). |

## Block axes + auto-apply (2026-09-08 W2)

Each `ProgramTemplateProcedure` (entitlement block) carries four axes frozen into `entitlementSnapshot.procedures`:

| Axis | Values | Role |
|------|--------|------|
| `assignMode` | `AUTO_ON_OPEN` \| `AUTO_DAY1` \| `ON_INDICATION` \| `MANUAL` | When the platform may materialize the block |
| `fulfillment` | `PROCEDURE_ORDER` \| `LAB_ORDER` \| `VISIT` | Runtime document type. **Admin derives from `kind`** (no İcra field). |
| `quotaBasis` | `PER_NIGHTS` \| `PER_STAY` | Knot math: interpolate vs single-knot flat qty |
| `requiresDoctor` | bool | VISIT/LAB wait for care-team doctor when true |

Rules:

12. Axis change is **composition** (version bump when the template has pins). Validity dates still never bump.
13. `quotaFor(..., { quotaBasis: "PER_STAY" })` picks one knot qty (prefer nights match / first knot) — **no interpolation**.
14. `applyPackageAutoBlocks(episodeId, { trigger })` materializes `LAB_ORDER` / `VISIT` for matching `assignMode`; `PROCEDURE_ORDER` is always skipped for auto.
15. Triggers: episode open → `OPEN`; day-1 assign → `DAY1`; care-team add when `PENDING_DOCTOR` or first doctor → `CARE_TEAM`; `POST …/package-apply` → `MANUAL_RETRY`.
16. `ProgramInstance.autoApplyState`: `PENDING` \| `APPLIED` \| `PARTIAL` \| `PENDING_DOCTOR`.
17. Ops list exposes `packageSignal`: `OK` \| `NO_PROGRAM_CODE` \| `NO_PROGRAM` \| `NO_PACKAGE_CONFIRMED` (`ClinicalEpisode.noPackageConfirmedAt`).
18. Intake checklist prefers snapshot blocks with `LAB_ORDER`/`VISIT` (or kind LAB/EXAM); falls back to `PKG-NAFTA-INTAKE`.

## Charging (W3)

| Rule | Behavior |
|------|----------|
| **SoT** | `resolveEntitlementCharge` — prefers `listAmount` for paid paths. |
| **Import** | Nafta import sets `listAmount` from row amount even when `packageIncluded` (commercial `amount` may stay 0). |
| **Admin** | `GET /api/admin/catalog?missingListPrice=1` surfaces package/zero rows without list. |
| **Create** | Intake visits/labs set amounts from entitlement charge (no silent hardcoded zeros for fulfillment). |
| **Bonus** | `amountNet === 0` package lines stay `bonusEligible=false` (CLI-53). |

## Post-wave audit amendments (2026-09-08)

19. **No-package signal is reversible.** `noPackageConfirmedAt` is cleared by `DELETE …/confirm-no-package` and automatically by `instantiateProgramFromTemplate` / a `recalcProgramQuotas` package switch. A stale confirmation must never keep billing a guest who does have a package.
20. **New balance rows are re-derived.** `recalcProgramQuotas` re-syncs the COUNT for codes it *creates* (package switch, nights growth), because a fresh row starts at `quotaUsed = 0` while stamped fulfillments may already exist. It deliberately does **not** resync pre-existing rows — a blanket resync would zero legacy instances whose historical fulfillments are unstamped; that remains `scripts/backfill-entitlement-usage.mjs`.
21. **`priceMissing` never silently means free.** `applyPriceMissingFallback` applies `DEFAULT_OVER_QUOTA_AZN` for every paid reason across procedures, labs and intake/auto-apply visits, keeps the `priceMissing` flag for the admin report, and leaves `in_quota` / `awaiting_package` at 0. Lab orders created without an episode price every code from the catalog instead of writing 0.
22. **`awaiting_package` work is logged.** `logProcedureCharge({ forceLog: true })` writes a `ProcedureChargeLog` row at 0 AZN for that reason, so delivered-but-unbilled services have a cashier backlog.
23. **One instance per order.** `resolveProcedureCharge` resolves the instance from the order's own `clinicalEpisodeId` (reservation lookup only as legacy fallback) so sync and pricing cannot diverge across a re-opened episode.
24. **VISIT implies a doctor.** `Visit.practitionerId` is non-null, so a `VISIT` block waits for the care team regardless of `requiresDoctor`; the axis only frees `LAB_ORDER` blocks. A `CANCELLED` lab no longer blocks auto-apply retry.
25. **Over-quota labs respect `procedureOverQuotaPolicy`.** `BLOCK` rejects creation with `LAB_OVER_QUOTA_BLOCKED` (409); other policies charge list price and warn.
26. **Extras use the paid lane.** `extras-assign` prices through `resolveEntitlementCharge` (`listAmount` first) instead of commercial `amount`, which is 0 for package-included SKUs; the extras modal shows `—` for an unpriced SKU instead of a made-up 25 AZN.

## Related

- CLI-51, AC-CLI-SAN-QUOTA (out of SAN rollup)
- Wave A dual-run SKU ADR
- CLI-57 package assign modal ([clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md))
