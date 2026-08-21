# ADR: Clinic procedure day-ops (reception matrix + nurse attendance)

## Status

Accepted — 2026-07-14  
Amended 2026-07-18 (check-in auto-completes short procedures) — **superseded**  
Amended 2026-07-19 (atomic check-in → `CHECKED_IN`; auto-complete by `endsAt`; NO_SHOW burns quota)  
Amended 2026-08-21 — turnover vs patient rest: [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md)

Related: [sanatorium-vnext.md](./sanatorium-vnext.md) · [clinic-product-lines-and-presets.md](./clinic-product-lines-and-presets.md) · [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) · [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md) · [satellite-mutation-audit.md](./satellite-mutation-audit.md)

## Context

Nafta sanatorium day operations mixed two concerns:

1. **Who orchestrates the day schedule** (move/cancel/fill liberated slots, walk-in).
2. **Who proves the guest attended** a procedure so disputes are not paper-only.

The 2026-07-18 amendment treated short cabin procedures as “check-in = complete”. That was wrong for longer sessions (40 min): marking `COMPLETED` at start lied about delivery time and confused nurse UX. Occupancy is already held by allocation intervals (`CANCELLED`/`NO_SHOW` only free the slot), so early complete did not free capacity — it only corrupted semantics.

## Decision

### Roles

| Actor | Owns |
|-------|------|
| **RECEPTION** | Day inventory: resource×time matrix, reschedule, cancel, assign walk-in into free slots |
| **NURSE** | Attendance: one click check-in when guest arrives → `CHECKED_IN`; mark **NO_SHOW** when guest never arrived (or leave to EOD sweep) |
| **DOCTOR / CLINIC_ADMIN** | Check-in **override** with reason (supervisor path); medical program composition unchanged |

Nurse does **not** orchestrate the matrix. Reception does **not** mark check-in (except admin tools if ever needed).

### Status machine (`ProcedureOrderStatus`)

```text
SCHEDULED
  ├─(nurse QR / MANUAL / supervised override)→ CHECKED_IN
  │     └─(auto when endsAt passed; lazy + cron)→ COMPLETED
  ├─(nurse or EOD / autoNoShowAfterMin sweep)→ NO_SHOW   ← burns quota + may charge
  └─(reception)→ CANCELLED

CHECKED_IN
  └─(reception correction / mis-check-in)→ CANCELLED   ← quota NOT burned
```

### Status accounting

| Status | Quota / payment | Nurse bonus |
|--------|-----------------|-------------|
| `CHECKED_IN` | −1 committed (decrement runs at auto-complete) | +1 |
| `COMPLETED` | −1 quota (or −1 paid procedure / folio charge) | +1 |
| `NO_SHOW` | −1 quota + penalty charge for paid / over-quota | none |
| `CANCELLED` | untouched | none |

- Planner never schedules above `quotaTotal`. Over-quota only via conscious reception add → tenant `procedureOverQuotaPolicy` default **`CHARGE_FOLIO`**.
- Nurse path has **no** over-quota branch: check-in is unconditional once the order is `SCHEDULED`.
- Nurse bonus formula: `checkedInAt != null AND status IN (CHECKED_IN, COMPLETED)` (`qualifiesForNurseBonus`).

### Happy path

1. Guest arrives → nurse check-in → `CHECKED_IN` (`checkedInAt` set). Resource stays occupied for `[scheduledAt, endsAt)`.
2. When `endsAt` passes → system auto-completes → `COMPLETED` (billing, quota decrement, stock write-off, `clinic.procedure.completed` event).
3. Never arrived by EOD (or `autoNoShowAfterMin`) → `NO_SHOW` (quota burn + folio penalty when applicable; no stock write-off).

Manual `POST …/complete` remains only as admin/fallback for stuck `CHECKED_IN` rows (e.g. `BLOCK` over-quota policy edge).

### Anti-fraud / check-in channels

`ProcedureCheckInChannel`: `QR` | `OVERRIDE` | `MANUAL`

1. **QR** (default when `Tenant.checkInRequiresQr = true`): live guest QR must match `patientRefId`.
2. **MANUAL** (when `checkInRequiresQr = false`): nurse one-click without QR.
3. **OVERRIDE:** `overrideReason` required; `DOCTOR` / clinic admin; audited.
4. **Unified time window (all channels):** `scheduledAt − graceBefore` … `endsAt`. Optional grace to `endsAt + resourceGap` **only when the next turnover slot on the resource is free** (no active booking overlapping `(endsAt, endsAt+gap]`). `resourceGap` is the occupying procedure’s `ProcedureType.resourceGapMinutes` ([time layers](./clinic-scheduling-time-layers.md)). If the next slot is occupied, hard stop at `endsAt` — late guests are **rescheduled by reception** (never slide the rest of the day).
5. **Resource occupancy:** at most `capacity` concurrent `CHECKED_IN` orders per `resourceId`.
6. Audit: `checkedInAt/By`, `checkInChannel`, `completedAt/By`, `noShowAt/By`, `cancelledAt/By`, `cancelReason`, `manuallyAdjusted`.

Nurse board shows only **Check-in** (no manual No-show). Past-deadline `SCHEDULED` rows appear in a visual “Missed” bucket with check-in disabled; status stays `SCHEDULED` until EOD sweep.

### NO_SHOW and matrix evidence

- EOD / `autoNoShowAfterMin` sweep marks `SCHEDULED` → `NO_SHOW` for the **current Asia/Baku day only** (does not backfill history).
- `NO_SHOW` **keeps** `ResourceBooking` so the resource matrix still shows the bar (proof the guest was booked and did not attend). Availability already ignores `NO_SHOW` via status filter — relevant only for historical viewing after day close.

### Cron / lazy catch-up

| Endpoint | Action |
|----------|--------|
| `POST /api/cron/procedure-auto-complete` | `CHECKED_IN` with effective end `< now` → `COMPLETED` |
| `POST /api/cron/procedure-no-show-sweep` | stale `SCHEDULED` → `NO_SHOW` |
| `GET /api/procedures` (nurse board) | lazy `autoCompleteElapsedCheckedIn` before list |

Auth: `Authorization: Bearer PLATFORM_CRON_SECRET` (same pattern as other clinic crons).

Tenant flags: `checkInRequiresQr` (default true), `autoNoShowAfterMin` (nullable = EOD-only).

### Inventory UX (reception)

Hotel room-plan analogy (Location **projection** of multi-resource SoR — see [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md)):

- Rows = **Resource** (cabinet / device); STAFF allocation shown as payload fields, not a second matrix yet.
- Columns = time slots (`schedulingSlotMinutes`).
- Exhausted capacity (cabin **or** HARD staff) → slot **blocked** / omitted from “available” pickers.
- Compatibility / lunch / same-procedure-day rules filter availability the same way as the planner.
- **Turnover gap:** consecutive procedures on the same **resource** keep a minimum break after occupancy (`ProcedureType.resourceGapMinutes`, default **5 min**; **0** allowed). This is **not** the guest’s rest between their own procedures (`patientRestMinutes` / WO `PatientGapMin`). Enforced via occupying-tail in `countResourceAllocations` across planner, availability, and reschedule. Occupies `[startsAt, endsAt + resourceGap of that order)`. See [clinic-scheduling-time-layers.md](./clinic-scheduling-time-layers.md).
- **Slot-aligned duration:** `ProcedureType.durationMin` must be a multiple of `schedulingSlotMinutes` (admin create/update rejects otherwise). Placements always round duration **up** via `alignDurationToSlotMinutes`, so ends land on the same :00/:05/:10 grid as starts.
- **Matrix default date:** open **today** (Asia/Baku), even when closed (Sunday) — show empty matrix + closed-day hint; do not silently jump to the next weekday.
- **Time horizon filters** (`rest` / `+1h` / `+3h`): always anchor to wall-clock (now − 5 min, floored to slot grid), including when viewing another calendar day.
- **Lunch boundary:** a procedure must finish **before** lunch (`lunchStartHour`) or start **after** it (`avoidLunchOverlap`); windows never straddle 13:00–14:00. `afterLunchAllowed=false` types that would overlap are pushed to the next working morning.
- **End of day:** a small overrun past `dayEndHour` is tolerated (≤ 10 min); later placements are dropped by the demo loader and not offered by availability.
- Drag-and-drop is on the **shared matrix** (by `procedureOrderId`), not on a single-patient list. Slot picker without DnD remains supported.
- Planner remains the happy path; matrix edits are exception/fill (marked `manuallyAdjusted`).
- **Fullscreen board:** `/sanatorium/resources` may open the matrix in a viewport overlay (filters + board, Esc to exit) for reception wall / large monitors.

### Sanatorium courses list (`/sanatorium`)

- Label in nav/UI: **Sanatorium procedures** (not “episodes”) — domain entity remains `ClinicalEpisode`.
- Canonical list UX: `EraListFilterBar` + data table; row actions open **treatment chart** / **day procedures** / **patient card** modals (no duplicate Home / Resource calendar header buttons — sidebar owns navigation).
- Walk-in create: demographics modal — name, FIN/passport (required one of), phone, **sex M/F required (empty default)**, birth date via **`DatePicker`**, nationality, program from `ProgramTemplate` list.
- Commercial procedure names for ops/admin screens resolve via `ServiceCatalogCache.descriptionAz|Ru|En` + `localizedCatalogDescription` (Finance sync is SoR; `ProcedureType.name` is fallback only). EN names for Nafta procedures are seeded from `procedure-en-names.json` (standard physiotherapy / spa terminology). Matrix, nurse list, catalog admin, and day-summary resolve live by `procedureCode` + UI locale.

### Nurse board (`/nurse`)

Agenda window: **one procedure before now → end of clinic day** (shrinks through the day) + day-progress indicator (“Xh Ym left” / closed). Kanban: Missed (visual overdue, check-in disabled) / Upcoming / In progress / Completed. Single check-in button; QR panel only when `checkInRequiresQr`. No nurse No-show button. Completion automatic.

### APIs (clinic)

| Method | Path | Role |
|--------|------|------|
| POST | `/api/nurse/qr-scan` | NURSE (+ DOCTOR) — resolve guest + today's orders |
| POST | `/api/procedures/[id]/check-in` | NURSE (+ override actors) — atomic → `CHECKED_IN` |
| POST | `/api/procedures/[id]/complete` | NURSE — stuck-row fallback only |
| POST | `/api/procedures/[id]/no-show` | NURSE — burns quota + may charge |
| PATCH | `/api/procedures/[id]/reschedule` | **RECEPTION** (+ admin) |
| POST | `/api/procedures/[id]/cancel` | **RECEPTION** (+ admin) |
| GET | `/api/sanatorium/resources/calendar` | RECEPTION/NURSE/DOCTOR — matrix incl. status |
| GET | `/api/sanatorium/resources/available-slots` | RECEPTION — free slots for assign/move |
| POST | `/api/cron/procedure-auto-complete` | cron secret |
| POST | `/api/cron/procedure-no-show-sweep` | cron secret |

Legacy `POST …/start` remains an alias of check-in.

## Consequences

- Ops UAT covers attendance via audit fields; nurse board verifies MANUAL/QR check-in and auto-complete.
- Event `clinic.procedure.completed` fires at **auto-complete time** (`endsAt`), not at check-in.
- Seeds/UI use `CHECKED_IN` as “in progress”, not “stuck”.

## Out of scope

Guest self-scan of cabin QR; biometrics; wellness preset; HL7/NBC; separate Void-check-in product action (reception cancel from `CHECKED_IN` is the correction path).
