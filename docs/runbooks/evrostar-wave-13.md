# Evrostar Wave 13 — Fitness files

**ADR:** [cp-workforce-floor-attendance.md](../adr/cp-workforce-floor-attendance.md) decision 10  
**Capability:** `CP-WF-FIT-01` (**API**, not SHIPPED)

## Goal

Three employment-scoped files (`HEALTH`, `NARCOLOGY`, `CRIMINAL_RECORD`) gate **new** place assignment for Evrostar. Punches, termination, MDM, Finance, and the employee phone cabinet are untouched.

## Org policy

Under `Organization.settings.workforce.fitness`:

| Field | Meaning |
|-------|---------|
| `requiredKinds` | Subset of the three kinds. **Empty = no gate** (other customers stay unblocked). |
| `criminalRecordFreshnessDays` | Window from `issuedOn` for `CRIMINAL_RECORD` (not a hardcoded statute). Default 90 when unset. |

Evrostar pilot: set all three kinds and choose the freshness window for both VÖEN orgs.

`CRIMINAL_RECORD` UI copy is always “employer rule”, never a legal requirement caption.

## Status

Computed only (not stored): `MISSING` / `PRESENT` / `EXPIRED` in Asia/Baku.

- `HEALTH` / `NARCOLOGY`: need `validUntil`; expired when that date is before today.
- `CRIMINAL_RECORD`: needs `issuedOn`; present while `asOf < issuedOn + freshnessDays`.

## Storage

Key `org/{organizationId}/workforce-fitness/{id}` on disk under `ERA_WORKFORCE_FITNESS_ROOT` (default `data/workforce-fitness`). PDF / JPEG / PNG by content type and file signature, max 5 MiB. `QuotaService.assertStorageQuota` before write; `addStorageUsage` after. Audit logs kind and dates only — never file bytes or diagnosis text.

## Gate

| Action | Check |
|--------|-------|
| `createAssignment` employment | `assertAssignable` on `effectiveFrom` |
| `createAssignment` brigade | every open member on `effectiveFrom` |
| `updateAssignment` place change | same |
| `upsertOverride` EXTRA/SWAP with `placeId` | person on `workDate` |
| `DAY_OFF` | no check |

Existing assignments stay; punches stay; no auto-terminate. Second VÖEN = empty fitness rows (no copy).

## Surfaces

- HR card: `/workspace/workforce/employments` — upload/download (HR permissions).
- Floor group `FITNESS_ISSUE` when a required kind is MISSING/EXPIRED.
- Not on `/workspace/me`, not in roster/absence/timesheet CSV, not mirrored to Finance.

## Evidence

Jest: `workforce-fitness.wave13.spec.ts`. COVERAGE Status=API until UAT-SMOKE.
