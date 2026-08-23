# ADR: Clinic procedure matrix replan (super-admin)

**Status:** Accepted — 2026-08-23  
**IDs:** CLI-49  
**Scope:** `era-clinic` resource×time matrix. Dangerous ops. Not hotel checkout. Not doctor `/appointments`.

Related: [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md) · [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [clinic-procedure-gender-session-windows.md](./clinic-procedure-gender-session-windows.md) · [satellite-mutation-audit.md](./satellite-mutation-audit.md)

## Context

FIFO confirm (`placeConfirmedProcedures`) **does not move** already `SCHEDULED` / `CHECKED_IN` / `COMPLETED` orders; it only places new `PROPOSED` rows. After cancellations, gender-window rollout, or a jammed cabin, ops want a **Rebuild / Replan** action.

A naive “run FIFO on the whole day” will destroy guest-facing promises (pinned times, family slots, escorts) and can strand people past `dayEndHour`. The button is useful **only** as a scoped wizard with preview, pins, and undo.

## Decision

### D1 — Who may run it

| Actor | Allowed modes |
|-------|----------------|
| **Platform super-admin** (email allowlist, same as clinic admin extra) | All modes including **Nuclear day** |
| **CLINIC_ADMIN** (SatAdmin) | **Fill holes** + **Apply gender windows** on **one type or one resource**, never Nuclear |
| Reception / nurse / doctor | **No** |

Not a cron. Not a night-audit side effect.

### D2 — Never move these rows

- `CHECKED_IN` / in-progress occupancy
- `COMPLETED` / `NO_SHOW` / `CANCELLED`
- `scheduledAt` in the past (Asia/Baku)
- `manuallyAdjusted = true` unless the operator **explicitly** unchecks **Respect pins** (super-admin only)

Candidates: future `SCHEDULED` (and optionally leftover `PROPOSED`).

### D3 — Modes (wizard, not one FIFO)

| Mode | Effect | Typical use |
|------|--------|-------------|
| **Fill holes** | Do not move placed rows; only place remaining `PROPOSED` / fill gaps | After cancel / no-show |
| **Pack this resource today** | Unplace future `SCHEDULED` on **one** resource, then FIFO back onto that resource | One jammed cabin |
| **Apply gender windows** | Only types with gender policy ≠ `OFF`; move future rows that violate the sex window | After enabling CLI-48 on 4-chamber |
| **Nuclear: rebuild day** | Unplace all candidate `SCHEDULED` for the selected **calendar day**, FIFO the whole matrix | Last resort; super-admin only |

Do not offer “balance nurse load”: SOFT staff is not the scarce unit (time-layers ADR).

Time-layer laws stay inviolable (occupancy, resource gap, patient rest, pair gap, lunch, peak). Replan must not shrink rest to “pack denser”.

### D4 — Preview is mandatory

`POST …/replan/preview` writes **nothing**. Response:

- counts: moved / unchanged / pinned-skipped / unplaced (will not fit)
- sample diffs (order id, old slot, new slot)
- gender / lunch / rotation violations that would remain

`POST …/replan/apply` requires `previewId` (short-lived, e.g. 10 min) matching the same scope+mode. Confirm string `REPLAN`. Reason required (audit).

### D5 — Transaction, snapshot, undo

Apply is one DB transaction. Persist a **snapshot** of previous `scheduledAt` / allocations for touched orders. **Undo** within 15–30 minutes (same actor or super-admin), blocked if any touched order has since become `CHECKED_IN` / completed.

Without snapshot+undo, **Nuclear** is forbidden.

### D6 — Scope defaults

Default UI: **one Baku calendar day** + **one resource or one procedure type**. “All resources, all week” is not v1.

### D7 — Placement vs reception

Replan is an **exception** to incremental FIFO (confirm still does not move placed rows). Reception remains SoT for day-ops DnD. Replan must set `manuallyAdjusted=false` on engine-moved rows (pins stay pinned).

## Waves

| Wave | Scope | Status |
|------|--------|--------|
| **W0** | This ADR + COVERAGE STUB | done |
| **W1** | Preview API: Fill holes + Pack one resource | **API** |
| **W2** | Apply + snapshot + undo; pins; status guards | **API** |
| **W3** | Apply gender windows; Nuclear + confirm phrase; SatAdmin wizard | **API** (UAT open → not SHIPPED) |

## Explicitly out of scope

- Auto-replan when saving a procedure type flag.
- Replanning checked-in guests.
- Hotel / F&B / Finance stock.
- Scaffold ✅ or SHIPPED from this document alone.
- Edition `ga`.

## Honesty

Replan optimizes **cabin occupancy**, not guest experience. Preview unplaced count is a success metric: if unplaced > 0, do not apply Nuclear without a human plan for leftovers (next day / cancel / peak hours).

## COVERAGE

`CLI-49` — **API** until UAT-SMOKE UI sign-off. SuperAdmin for Nuclear; SatAdmin for Fill/Gender on one resource.
