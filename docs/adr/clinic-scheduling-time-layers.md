# ADR: Clinic scheduling time layers (occupancy, resource gap, patient rest)

## Status

Accepted — 2026-08-21 (product law). **Schema/engine shipped** — `ProcedureType.resourceGapMinutes` / `patientRestMinutes`; occupying-tail resource check; patient rest from preceding type. Tenant `defaultProcedureGapMinutes` is default-on-create only.

Related: [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) · [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md)

## Context

Nafta physio (WebOnly `25-Treatments.xlsx` + live Randevular 19–21.08.2026) mixed four different clocks into one “duration”:

1. How long the guest occupies the cabin (procedure + enter/exit).
2. How long the **cabin/device** must stay idle before the next guest (turnover / wipe / gel reset).
3. How long **this guest** must rest before *any* next procedure (WO `PatientGapMin`, typically 15; baths 40).
4. Pairwise medical gaps (3–4 h between specific codes).

ERA previously collapsed layers 2–3 into one tenant field. **Shipped:**

| Mechanism | Field | Used as |
|-----------|--------|---------|
| Occupancy | `ProcedureType.durationMin` + `alignDurationToSlotMinutes` | Guest in cabin; 5-min grid |
| Resource turnover | `ProcedureType.resourceGapMinutes` (default **5**; **0 allowed**) | Occupying tail on LOCATION/EQUIPMENT |
| Patient consecutive gap | `ProcedureType.patientRestMinutes` (default **15**) | `validatePatientConsecutiveGap` + planner cursor |
| Create default only | `Tenant.defaultProcedureGapMinutes` | Copied onto new types at create |
| Pair rules | `ProcedureRule` `SEQUENCE_GAP` | Unchanged |

One global gap cannot express UFF gel (cabin 17): occupancy is Excel **10** min (not the earlier 5-min override), and the next **other** guest may start immediately (**resource gap 0**). Putting 15 min of guest rest onto the apparatus idle clock still under-slots cabin 17. Putting gel resource gap 0 into the tenant field would also zero patient rest and pack massage.

Staff HARD/SOFT is a **separate calendar** (CLI-30). Soft nurses covering several cabins in parallel must not inherit the cabin turnover gap.

## Decision

### Four layers (do not collapse)

| Layer | Meaning | SoR (target) | Nafta example |
|-------|---------|----------------|---------------|
| **1. Occupancy** | Guest in cabin on the 5-min grid | `ProcedureType.durationMin` (already) | UFF gel **10**; Darsonval **10**; laser Excel 8 → grid **10**; UFB 1 → grid **5** |
| **2. Resource gap** | Cabin/device cannot take the next guest until this many minutes after `endsAt` | `ProcedureType.resourceGapMinutes` (new). Tenant `defaultProcedureGapMinutes` = **default-on-create** only | Gel / laser / darsonval **0**; paraffin cycle **20** (gap 0); typical physio **5** |
| **3. Patient rest** | This guest’s next *any* procedure starts no earlier than `endsAt + rest` | `ProcedureType.patientRestMinutes` (new; maps WO `PatientGapMin`) | Gel **15**; baths **40**; massage Excel **5** |
| **4. Pair gap** | Named code pairs | `ProcedureRule` `SEQUENCE_GAP` | Unchanged |

Occupancy **includes** enter/exit. Resource gap is **not** extra walking time for the guest; it is apparatus idle. Patient rest does **not** occupy the cabin.

Check-in grace past `endsAt` (day-ops) uses the **resource** gap of that order (tail of the occupying procedure), not patient rest.

### Per-type resource gap, not a second global

- Every procedure type has its own `resourceGapMinutes` (`Int`, default **5**, **0 allowed**).
- `0` means back-to-back occupancy on that resource (`09:00–09:05`, `09:05–09:10`).
- Tenant `defaultProcedureGapMinutes` stays: new types copy it at create. Editing gel to 0 must not change massage.
- Do **not** name the type field `defaultProcedureGapMinutes` — it is not a default.
- Do **not** put resource gap on `ProcedureTypeRequirement` unless a type truly uses two physical resources with different turnover. v1: one number on the type, applied to LOCATION/EQUIPMENT occupancy.

### Engine: tail of the occupying booking

`countResourceAllocations` today pads the **candidate** window by one gap on both sides. That is correct only while every type shares the same tenant 5.

Target law: each existing LOCATION/EQUIPMENT allocation occupies `[startsAt, endsAt + resourceGapMinutes(type of that order))`. A gel slot (gap 0) must not steal a neighbour’s 5-min turnover on a shared apparatus. Cabin 17 (gel only) is unaffected either way.

### Staff gap is not resource gap

| `staffMode` | Scarce unit | Extra minutes after `endsAt` |
|-------------|-------------|------------------------------|
| **SOFT** (Nafta physio default) | Cabin/device `Resource.capacity` | **None** on the nurse. One skilled nurse may be assigned to overlapping cabins; planner load-balances. |
| **HARD** (massage 1:1) | Practitioner exclusivity on `[startsAt, endsAt)` | **None** today (`countStaffHardBusy` has no gap). A HARD nurse gap is a separate product if linen/prep must serialize the **person**. Do not copy cabin `resourceGapMinutes` onto SOFT staff. |

Availability remains AND(physical free by capacity + resource gap, staff available under HARD/SOFT).

### Nafta medical overrides (ops, 2026-08-21)

Source of catalog minutes: WO `25-Treatments.xlsx` `DurationMin` / `PatientGapMin`, except:

| Procedure | Cabin(s) | Occupancy | Resource gap | Patient rest | Capacity note |
|-----------|----------|-----------|--------------|--------------|----------------|
| Ultrafonoforez (Gellə) | **17 only** | **10** (Excel DurationMin) | **0** | 15 (Excel) | 10+0 cycle on cabin 17 |
| Darsonval | **19** | 10 | **0** | 15 | Back-to-back on device |
| Lazerterapiya | **18** | 10 (Excel 8 → grid) | **0** | 15 | Back-to-back |
| Paraffin (all sites) | Parafin 1–5 | **20** including turnover | **0** | 15 | Cycle = occupancy |
| UFB | UFB | 1 → grid **5** | 5 | 15 | Medical 1 min, ERA slot 5 |
| 4-chamber bath | shared tub | 20 | 5 | 40 | **08:00–18:00**; women before lunch, men after. Other physio **09:00–17:00** |
| Typical electro / UFF oil / magnet / vacuum | Namiq list | Excel DurationMin, aligned up to 5 | 5 | Excel PatientGapMin | Resource gap 5 stays |
| Massage | couches | Excel 15/30 | 5 | Excel 5 | STAFF **HARD** |

Namiq cabin list (physio 1–25, no cabin 9) is ops topology, not this ADR. Baths / paraffin / ozone / UFB stay on their own resources.

### Grid and lunch (unchanged)

- Slot `schedulingSlotMinutes` = 5; durations align **up**.
- Physio day **09:00–17:00**; 4-chamber bath **08:00–18:00**. Lunch 13:00–14:00 empty; procedures do not straddle lunch.
- Overflow past `dayEndHour` is reception/peak-mode, not silent slide.

## Consequences

### Product / admin

SatAdmin procedure type card shows three numbers: duration, resource gap, patient rest. i18n must not call resource gap “interval between procedures” without saying **whose** interval (cabin vs guest).

### Code (shipped 2026-08-21)

1. Prisma: `ProcedureType.resourceGapMinutes` `@default(5)`, `ProcedureType.patientRestMinutes` `@default(15)`.
2. Seed Nafta: gel `SVC-ULTRAFONOFOREZ-GEL` 10/0/15; oil 10/5/15; Darsonval/laser gap 0; UFB 1→5; paraffin cycle 20; 4-chamber 08–18 women AM / men PM.
3. Planner / available-slots / reschedule: `countResourceAllocations` uses occupying tail of each booking.
4. `validatePatientConsecutiveGap` / patient cursor: preceding type `patientRestMinutes`.
5. Unit tests: `__tests__/scheduling-time-layers.spec.ts`.

Tenant `defaultProcedureGapMinutes = 5` remains the create default for new types. Do not set it to 0 for gel.

### Honest coverage

CLI-26 / CLI-30 stay **SHIPPED**. Per-type gaps are API + SatAdmin. Do not mark product-readiness GA from canvas simulation alone.

## Out of scope

- Implementing the Prisma fields in the same change as this ADR.
- Soft-staff concurrency caps (ADR CLI-30 still “not in this wave”).
- Staff timeline board.
- Changing Namiq room ownership or adding a second darsonval in inventory (ops / master data).
