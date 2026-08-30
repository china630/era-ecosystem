# ADR: Clinic doctor-confirmed FIFO planning

## Status

Accepted — 2026-07-21

Related: [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) · [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md) · [sanatorium-vnext.md](./sanatorium-vnext.md)

Amended 2026-08-21 — consecutive patient gap is layer 3 (patient rest), not cabin turnover.

Amended 2026-08-30 (Wave C / Nafta): first-day confirm is a **FIFO prefix of 2–3** procedures (exam/intake sorted first). **Confirm all** removed from sanatorium UI and patient card. Soft hint only — do not hard-block >3. Nafta keeps `AFTER_CHECKUP` (exposed in `/admin/settings`). Same-day 4th in-package procedure charges list price and does not consume knot. Package-quota codes cannot be manually POSTed to SCHEDULED.

## Context

Sanatorium program instantiation used to place procedures onto resources immediately (one-shot FIFO). Doctors need to review package lines first: adjust codes/body parts, cancel and replace, and only then commit scarce cabin/equipment capacity. Placement must respect already-scheduled orders for the same patient (incremental planning), consecutive-day rotation (naftalan baths, body-part therapies), contraindication-driven substitution, peak/extended hours, and lab intake rules for external results and fasting panels.

## Decision

### PROPOSED status

1. Program / package expansion creates `ProcedureOrder` rows with status **`PROPOSED`**.
2. Proposed orders appear on the patient card and plan UI; they do **not** create `ResourceBooking` / `ProcedureAllocation` and do not occupy the reception matrix.
3. `buildProposedPlan` is idempotent for unconfirmed proposals (replaces prior `PROPOSED` for the reservation/patient run).

### Doctor confirm → placement

1. Doctor (or authorized ops) confirms a **selected FIFO prefix** of proposed IDs via `POST /api/procedures/confirm` (no Confirm-all in UI). Batches >3 return `softWarn` but still place.
2. Confirm calls **`placeConfirmedProcedures`**, which runs FIFO placement onto resources (Pattern A multi-resource allocations).
3. Successful placement moves orders to **`SCHEDULED`** (with `confirmedAt` / `confirmedByUserId`).
4. Reception may **bulk-cancel** proposed/scheduled lines and optionally **replace** with another procedure code (`POST /api/procedures/bulk-cancel`). Individual edits use `PATCH /api/procedures/[id]`.

### Incremental placement

1. When placing newly confirmed orders, the planner loads existing patient orders in `SCHEDULED` / `CHECKED_IN` / `COMPLETED` as **context**.
2. Rotation, compatibility, and gap rules treat that history as fixed; the engine does **not** move already-placed orders.
3. New slots are found forward from work hours, respecting **resource** availability (occupancy + per-type resource gap tail), **staff** HARD/SOFT, and **patient** rest after the guest’s previous procedure the same day. Pairwise `ProcedureRule` `SEQUENCE_GAP` stays a fourth layer. See [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md).

### Body part on all procedures

1. Every procedure type has a default `ProcedureType.bodyPart` (seed defaults `FULL_BODY` unless mapped).
2. Orders carry `bodyPart` at proposal/placement time for rotation scope `BODY_PART` and contraindication checks.
3. Patient contraindications block or substitute by body part.

### Rotation rules

SatAdmin maintains `ProcedureRotationRule` (`/admin/procedure-rules`, `/api/admin/procedure-rotation-rules`):

| Example code | Scope | Intent |
|--------------|-------|--------|
| `NAFTALAN_BATH_ROTATION` | `GROUP` | Max consecutive naftalan bath days, then rest procedure (e.g. iod-brom) |
| `SUPERINDUCTIVE_BODY_PART` | `BODY_PART` | Same body part spaced (max consecutive days) |
| `ZERBE_DALGA_BODY_PART` | `BODY_PART` | Same for shockwave therapy |

### Substitution

1. `ProcedureSubstitutionRule` maps `originalCode` → `substituteCode` when the original is contraindicated (quota preserved).
2. Planner resolves substitution before locking a proposed/placed code.
3. SatAdmin CRUD: `/api/admin/procedure-substitution-rules`.

### Peak / extended hours

1. Tenant `peakModeEnabled` allows modalities with `ProcedureType.extendedEndHour` (and matching resources) to run past `dayEndHour`.
2. Seed sets `extendedEndHour=22` for laser / infrared / darsonval / sollyuks (salux) / ultrafonophoresis-class types.
3. When peak mode is off, effective end hour remains `dayEndHour`.

### Labs

1. **External labs:** results older than **90 days** are rejected at intake (`POST /api/lab-orders` with external source).
2. **Fasting next-morning labs:** walk-in / sanatorium flows may flag `fasting: true` so panels are scheduled for the next morning fasting window (not same-evening after meals).

## Consequences

- Package instantiate → proposed plan → doctor confirm is the happy path; one-shot auto-place is deprecated.
- Seed `prisma/seed-planning-rules.cjs` bootstraps body parts, extended hours, and example rotation/substitution rules.
- UAT: patient card confirm; bulk cancel+replace on sanatorium course; external lab >90d blocked; peak mode in `/admin/settings`.
- Coverage: CLI row for doctor-confirm planning (OpsUI doctor/reception + SatAdmin rules).