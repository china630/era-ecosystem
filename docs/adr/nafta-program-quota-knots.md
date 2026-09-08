# ADR: Nafta program quota knots (Wave B)

**Status:** Accepted  
**Date:** 2026-08-30  
**Amended:** 2026-09-07 — entitlement **blocks** with explicit SKU membership (CLI-51 editor)  
**Amended:** 2026-09-07 — **template versioning** + instance pin / entitlement snapshot

## Decision

1. Quota SoT = `ProgramTemplateQuotaKnot` (nights × **block/entitlement code** × qty), not flat `ProgramTemplateProcedure.quotaTotal`.
2. `quotaFor` clamps to `maxNights`, refuses below `minNights`, interpolates between adjacent PDF columns (`Math.round`).
3. Stay nights come from hotel check-in/out; `endsOn` follows checkout.
4. Package/night change → `recalcProgramQuotas`; **never** cancel `CHECKED_IN`/`COMPLETED`; drop orphan `PROPOSED`. **Amended 2026-09-04** ([clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md)): when stay **shortens**, also cancel **future non-consumed** `SCHEDULED` past the new end and return unused quota (1 code/category/day sync). Do not silently delete COMPLETED; over-consumed vs new total → pay path.
5. Charging: in-quota `amountNet=0` when a balance line exists (ignore global `packageIncluded`); over-quota = list price; walk-in without instance always paid.

## Entitlement blocks (2026-09-07)

PDF “free vs paid physio” is marketing, not a second price lane. SoT is **package entitlement**:

| Concept | Storage | Runtime |
|---------|---------|---------|
| **Block** (e.g. Physio, Paraffin, Naftalan bath) | `ProgramTemplateProcedure` row — `procedureCode` is the balance / knot key (`PHYSIO_POOL`, `PARAFFIN_POOL`, `NAFTALAN_BATH`, or custom) | One `ProgramProcedureBalance` line; matrix qty is **per block**, not per SKU |
| **Membership** | `ProgramTemplateBlockMember` (`templateId` + `blockCode` + real `ProcedureType.code`) | Package-assign picker / burn eligibility |
| **Kind** (UI) | `ProgramTemplateProcedure.kind` — `PHYSIO` \| `BATH` \| `PARAFFIN` \| `LAB` \| `EXAM` \| `CUSTOM` | Admin grouping only |

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
| **Save composition** | If procedures / knots / members **or** name / duration / min-max nights change → **insert new version**, set previous `isCurrent=false`, `retiredAt=now`, `supersedesId` on the new row. **Never** mutate contract fields on a row that guests still pin. |
| **One current** | Partial unique index `(organization_id, code) WHERE is_current` — at most one sellable row per code. |
| **Snapshot prefer** | Assign reads `entitlementSnapshot` whenever present (including empty `members` = frozen empty/heuristic). Null snapshot only until backfill. |
| **Backfill** | Migration / `POST ?action=backfill-snapshots` fills null snapshots from the pinned template. |
| **Seed / import** | Skip or `ensureWritableCurrentTemplate` (bump) before mutating a current row that has instances. |
| **GC** | `POST ?action=purge-retired` deletes retired versions with **zero** `ProgramInstance` pins. |
| **Support UX** | Admin: show retired toggle + version badge; package-assign shows `code · vN` pin. |
| **Pin** | `ProgramInstance.templateId` stays on the version used at instantiate (or at last explicit package **code** change). Night-only recalc must **not** re-point to latest. |
| **Lookup** | `findCurrentProgramTemplate(code)` for new instantiate / sanatorium package picker. |

Retired versions remain readable for pinned instances and audit; hard-delete forbidden while any instance references the row.

## Related

- CLI-51, AC-CLI-SAN-QUOTA (out of SAN rollup)
- Wave A dual-run SKU ADR
- CLI-57 package assign modal ([clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md))
