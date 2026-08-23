# ADR: Clinic procedure gender session windows

**Status:** Accepted — 2026-08-23  
**IDs:** CLI-48  
**Scope:** `era-clinic` sanatorium procedure planner, available slots, resource matrix. Not outpatient doctor `/appointments` (CLI-36) unless a later product wave says so.

Related: [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md) · [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md) · [clinic-procedure-matrix-replan.md](./clinic-procedure-matrix-replan.md)

## Context

Nafta physio loses cabin time when mixed-sex queues share a changing room / tub (especially **4-chamber bath**). House practice already written as ops lore in the time-layers ADR: women before lunch, men after. That is **not** implemented: the planner never reads `PatientRef.sex`.

Existing `ProcedureType.afterLunchAllowed` / `beforeLunchAllowed` mean “this **code** may never run AM/PM”. They must not be reused as gender windows: turning them off would push **all** guests (both sexes) to one half of the day.

Sex already exists as an ops cache (`PatientSex`: `MALE` | `FEMALE` | `OTHER` | `UNKNOWN`). Sanatorium walk-in already requires M/F.

## Decision

### D1 — Opt-in per procedure type (primary)

Each `ProcedureType` has `genderSessionPolicy`:

| Value | Meaning |
|-------|---------|
| `OFF` | No sex window (default). Same as today. |
| `INHERIT` | Use tenant default if tenant mode ≠ `OFF`; else off. |
| `SPLIT_BY_LUNCH` | Female: `[dayStartHour, lunchStartHour)`; Male: `[lunchEndHour, effectiveDayEnd)`. Lunch remains empty. |
| `CUSTOM` | Type-level wall-clock windows (hours), independent of lunch (bath 08–18 vs physio 09–17). |

Tenant fields are **defaults and culture**, not a global physio lock:

| Field | Meaning |
|-------|---------|
| `genderSessionMode` | `OFF` (default) / `SPLIT_BY_LUNCH` / `CUSTOM_WINDOWS` |
| `genderSessionFemaleFirst` | `true` = women AM (Nafta default); `false` = men AM |
| Custom hours | Only when mode is `CUSTOM_WINDOWS` (tenant default copied onto new types) |

Catalog controls: `CatalogField` CLOSED_SMALL / hours Select — not free-text.

**Nafta seed intent (when implemented):** 4-chamber bath `SPLIT_BY_LUNCH` (or CUSTOM 08–lunch / lunch–18). Typical electro / gel / laser stay `OFF` unless ops asks.

### D2 — One predicate everywhere

A candidate slot is legal iff:

1. Existing laws still hold (lunch non-straddle, resource gap, patient rest, pair rules, HARD/SOFT staff, peak/extended hours).
2. If the type’s resolved policy is not `OFF`, guest `sex` is `MALE` or `FEMALE` and the **entire** occupancy `[startsAt, endsAt)` lies inside that sex’s window (no straddle of the sex boundary, same as lunch).

Must apply in:

- FIFO `placeConfirmedProcedures`
- available-slots / resource day matrix
- reschedule + matrix DnD

Reception sees the other sex’s columns as **blocked**, not only a 409 after drop.

### D3 — UNKNOWN / OTHER

Tenant policy `genderSessionUnknown`: default **`BLOCK`** (do not place until card is M/F). Alternatives `ALLOW_BOTH` (warn) and `FORCE_WINDOW` are not Nafta default.

### D4 — Reception override

Manual place into the “wrong” window requires reason; set `manuallyAdjusted`; write satellite audit. Same bar as other matrix exceptions.

### D5 — Naming

Product/UI: **gender session windows** (or local “M/F sessions”). Code/docs must not use religious labels. UI copy in en/az/ru.

### D6 — Outpatient appointments

Out of this ADR. Doctor grid (CLI-36) does not inherit procedure gender windows.

## Waves

| Wave | Scope | Status |
|------|--------|--------|
| **W0** | This ADR + COVERAGE STUB | done |
| **W1** | Schema + SatAdmin type card + tenant defaults | **API** |
| **W2** | Planner + slots + DnD predicate + UNKNOWN BLOCK | **API** |
| **W3** | Matrix tint + override + UAT-SMOKE | **API** (UAT open → not SHIPPED) |

Enabling gender on a type that already has mixed-sex `SCHEDULED` rows needs [matrix replan](./clinic-procedure-matrix-replan.md) mode **Apply gender windows** (preview first) — not a silent overnight rewrite.

## Explicitly out of scope

- Duplicate male/female **resources** as the first design (same tub, split time).
- Auto-cron replan when toggling the flag.
- Holding / clinic cash / hotel folio effects.
- Claiming SHIPPED, Scaffold ✅, edition `ga`, or clinic UI SHOW from this ADR.

## COVERAGE

`CLI-48` — **API** until UAT-SMOKE UI sign-off (then SHIPPED).
