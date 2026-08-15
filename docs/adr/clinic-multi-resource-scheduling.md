# ADR: Clinic multi-resource scheduling (Pattern A / Pattern B)

## Status

Accepted — 2026-07-18

Related: [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [clinic-product-lines-and-presets.md](./clinic-product-lines-and-presets.md) · [sanatorium-vnext.md](./sanatorium-vnext.md) (SV6)

## Context

Hotel inventory books a single scarce unit (room-night). Clinic procedures consume **multiple actors for one interval**: a cabin/device and a qualified practitioner. Bolting `practitionerId` onto cabin `ResourceBooking` conflates preference with capacity and blocks a staff timeline.

Industry practice (FHIR Appointment participants, ambulatory EHR, spa multi-resource holds): a **service** declares requirements; the engine finds a time where **all** required calendars are free.

## Decision

### Pattern A — Sanatorium (`sanatorium_clinical`)

Equal multi-resource search for procedures:

1. `ProcedureTypeRequirement` lists roles: `LOCATION` | `EQUIPMENT` | `STAFF` (quantity, preferred `resourceCode`/`resourceKind`, `staffMode` HARD|SOFT).
2. `PractitionerSkill` links practitioners to procedure types they may perform.
3. `ProcedureAllocation` is SoR for who/what is held (`resourceId` XOR `practitionerId` by role) on `[startsAt, endsAt)`.
4. `ProcedureOrder.resourceId` remains a **denormalized Location/Equipment projection** for the reception matrix (rows = physical resources).
5. `ResourceBooking` is write-through from the LOCATION/EQUIPMENT allocation for legacy queries.
6. **Staff modes (enforced):**
   - **HARD** — practitioner exclusivity: overlapping STAFF allocation blocks the slot.
   - **SOFT** — shared nurse pool: any skilled practitioner may be assigned; concurrency is allowed (load-balanced to least-busy). Physical `Resource.capacity` remains the scarce constraint (e.g. ozone cabin capacity=3).

Availability = AND(physical free by capacity, skilled staff available under the type's STAFF `staffMode`). No skilled practitioner configured ⇒ slot unavailable (bootstrap: any active practitioner). New types default STAFF to **SOFT**; massage-style types may keep HARD.

### Pattern B — Outpatient clinic (`outpatient` appointments)

Practitioner is the **primary** scarce calendar. Optional `Appointment.resourceId` is a **secondary** location/equipment constraint (plus legacy `roomCode` for display). Conflict checks: practitioner first; if `resourceId` set, also reject overlapping appointments on that resource. No equal multi-resource search in v1.

### Explicitly not in this wave

- Merging `Practitioner` into `Resource` kind=STAFF.
- Soft-staff concurrency enforcement.
- Staff timeline board (nurse/staff projection) — future; Location board UX is shipped.

## Consequences

- Master data: SatAdmin maintains skills and procedure requirements.
- FIFO planner, available-slots, and reschedule must assign STAFF allocations.
- **Location board UX shipped** — `/sanatorium/resources` sticky matrix with merged bars, status colors, DnD; calendar slots carry `endsAt` / `status` / `procedureCode`; nurse `GET /api/procedures?mine=1` filters STAFF allocations.
- **Tenant working hours** — `Tenant.dayStartHour` … `closedWeekdays` drive FIFO planner, resource calendar, and matrix slot grid; SatAdmin edits via `/admin/settings`.
- **Matrix filters (2026-07)** — horizon (+1h/+3h from now on today, Baku) and patient name filter on reception board.
- **Staff timeline** remains future = projection of STAFF allocations (same SoR).