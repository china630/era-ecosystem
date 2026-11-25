# ADR: Clinic procedure load matrix

## Status

Accepted — 2026-11-24 (amended: separate nav, default 21 days)

## Context

Doctors assigning package procedures need a FO-style heat view of which **procedure SKUs** are overloaded over the next N days (not cabin matrix alone). Same signal appears inside the package assign modal.

## Decision

1. **Metric:** count of live `ProcedureOrder` rows per `procedureCode` × Asia/Baku civil day (SCHEDULED / CHECKED_IN / COMPLETED / PENDING_PAY with cabin / in-package PROPOSED). No full slot-scan.
2. **Capacity (2026-11-24):** for each SKU, estimate daily seat capacity = `floor(workMinutes / durationMin) × Σ resource.capacity` over LOCATION/EQUIPMENT codes on the type (requirements, else `ProcedureType.resourceCode`). Work minutes use tenant day/lunch hours (weekday template; short-day nuance is advisory only). Cells expose `count`, `capacity`, `pct`; colour level from **fill %** when capacity is known, else peak-normalized count (legacy).
3. **Horizon:** N days from tenant setting `procedureLoadHorizonDays` (default **21**, clamped 3–31).
4. **Display:** TOP-10 by total count; 10-step blue→red; cell label is **fill %** when capacity known (`72%`); `used/capacity` stays on hover `title`. Month headers use explicit az/en/ru names (`stayMonthTitle`) in-table with `colSpan`. Standalone load page puts the heat legend **below** the table.
5. **API:** `GET /api/sanatorium/procedure-load`. In-memory TTL ~90s; invalidate after package Saxla.
6. **Surfaces:**
   - Cabin day matrix stays at `/sanatorium/resources`.
   - Procedure load is a **sibling nav item** under Sanatorium (e.g. `/sanatorium/resources/load`), not only an in-page tab.
   - Package assign modal: heat strip **flush under** the stay grid (shared `stayWindowDays`, matching width, one H-scroll; load rows omit a second day header). Stay cells are **not** heat-tinted. Legends (heat + package/unpaid/paid/done marks) sit under the combined block. After Saxla with misses, heat is temporarily replaced by the assign **outcome panel** (see [clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md)); **Show load** restores heat.
7. **Rebuild cadence:** read-through cache; optional filters (period / procedure) on the load page. Do not recompute on every modal ±. Refresh may pass `bust` to bypass the TTL.

## Consequences

Cabin day matrix stays the operational DnD board. Procedure heat is advisory for assignment, not a hard gate (unless a later product rule adds one). Click-to-place from heat is **clinic debt** (manual assign wave), not this ADR.

## Clinic debt (parked)

| ID | Note |
|----|------|
| DEBT-ASSIGN-HEAT-CLICK | Click heat cell → pin day for selected lane → Save/Saxla; series gates via `slot-decision` |
