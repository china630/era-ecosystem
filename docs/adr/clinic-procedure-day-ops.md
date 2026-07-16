# ADR: Clinic procedure day-ops (reception matrix + nurse attendance)

## Status

Accepted — 2026-07-14

Related: [sanatorium-vnext.md](./sanatorium-vnext.md) · [clinic-product-lines-and-presets.md](./clinic-product-lines-and-presets.md) · [satellite-mutation-audit.md](./satellite-mutation-audit.md)

## Context

Nafta sanatorium day operations mixed two concerns:

1. **Who orchestrates the day schedule** (move/cancel/fill liberated slots, walk-in).
2. **Who proves the guest attended** a short procedure (15–20 min) so disputes are not paper-only.

Previously `ProcedureOrder` used `SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED`. `IN_PROGRESS` had no timestamps/actor/channel. Reschedule API allowed **DOCTOR/NURSE** but not **RECEPTION**. Nurse could complete from `SCHEDULED` without a proven arrival. Resource calendar (`/sanatorium/resources`) was read-only.

## Decision

### Roles

| Actor | Owns |
|-------|------|
| **RECEPTION** | Day inventory: resource×time matrix, reschedule, cancel, assign walk-in into free slots |
| **NURSE** | Attendance proof: QR scan of **guest** QR → check-in → complete; must mark **NO_SHOW** when guest did not arrive |
| **DOCTOR / CLINIC_ADMIN** | Check-in **override** with reason (supervisor path); medical program composition unchanged |

Nurse does **not** orchestrate the matrix. Reception does **not** mark check-in/complete (except admin tools if ever needed).

### Status machine (`ProcedureOrderStatus`)

```text
SCHEDULED
  ├─(nurse QR or supervised override)→ CHECKED_IN → COMPLETED
  ├─(nurse)→ NO_SHOW
  └─(reception)→ CANCELLED
```

- `IN_PROGRESS` renamed semantically to **`CHECKED_IN`** (migration maps existing rows).
- Complete is allowed **only** from `CHECKED_IN`.
- `NO_SHOW` is a first-class status (not a soft cancel).

### Anti-fraud (check-in)

Quick, enforceable rules:

1. **Default:** check-in requires a **live guest QR token** that resolves to the same `patientRefId` as the order (nurse scans guest — not guest scanning the cabin).
2. **Override:** `overrideReason` required; allowed for `DOCTOR` / clinic admin; audited.
3. **Time window:** `scheduledAt − graceBefore … scheduledAt + graceAfter` (tenant defaults **5 / 15** minutes). Outside window → clear error (`NOT_IN_CHECKIN_WINDOW`).
4. **Resource occupancy:** at most one `CHECKED_IN` order per `resourceId` at a time (capacity-aware for multi-capacity resources).
5. Audit columns: `checkedInAt/By`, `checkInChannel` (`QR` \| `OVERRIDE`), `completedAt/By`, `noShowAt/By`, `cancelledAt/By`, `cancelReason`, `manuallyAdjusted`.

QR issue/TTL remains stay-bound via existing guest QR (`expiresAt`); clinic does not invent a second identity token.

### Inventory UX (reception)

Hotel room-plan analogy:

- Rows = **Resource** (cabinet / device).
- Columns = time slots (`schedulingSlotMinutes`).
- Exhausted capacity → slot **blocked** / omitted from “available” pickers.
- Compatibility / lunch / same-procedure-day rules filter availability the same way as the planner.
- Drag-and-drop is on the **shared matrix** (by `procedureOrderId`), not on a single-patient list. Slot picker without DnD remains supported.
- Planner remains the happy path; matrix edits are exception/fill (marked `manuallyAdjusted`).

### APIs (clinic)

| Method | Path | Role |
|--------|------|------|
| POST | `/api/nurse/qr-scan` | NURSE (+ DOCTOR) — resolve guest + today's orders |
| POST | `/api/procedures/[id]/check-in` | NURSE (+ override actors) |
| POST | `/api/procedures/[id]/complete` | NURSE |
| POST | `/api/procedures/[id]/no-show` | NURSE |
| PATCH | `/api/procedures/[id]/reschedule` | **RECEPTION** (+ admin) |
| POST | `/api/procedures/[id]/cancel` | **RECEPTION** (+ admin) |
| GET | `/api/sanatorium/resources/calendar` | RECEPTION/NURSE/DOCTOR — matrix incl. status |
| GET | `/api/sanatorium/resources/available-slots` | RECEPTION — free slots for assign/move |

Legacy `POST …/start` becomes an alias of check-in that **requires** QR/override body (no status-only flip).

## Consequences

- Ops UAT must cover attendance disputes via audit fields, not paper logs.
- Seeds/UI strings replace `IN_PROGRESS` procedure labels with `CHECKED_IN`.
- Outpatient `/scheduling` appointment DnD should follow the same **id-based** move pattern (separate appointment status machine unchanged).

## Out of scope

Guest self-scan of cabin QR; biometrics; wellness preset; HL7/NBC.
