# ADR: Clinic → hotel capacity foresight

## Status

Accepted — 2026-07-14

Related: [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · [sanatorium-vnext.md](./sanatorium-vnext.md)

## Context

Hotel can sell more medical package stays than clinic procedure inventory can absorb (e.g. 100 in-house guests vs ~95 patient-equivalents of cabinet/device slots). Ops need **early warning** (remaining ~10–15%) and a **hard stop** when inventory is exhausted — without paper coordination.

Previously clinic exposed a crude weekly **guest-equivalent** heuristic (`ProcedureOrder` count / 8) with fixed bands 120–125; hotel pulled it only for hard booking block. No remaining-% by slot inventory, no soft warn UX in PMS.

## Decision

### Source of truth (window)

Default evaluation window: **calendar week containing `refDate`** (Mon–Sun), same as today.

| Metric | Definition |
|--------|------------|
| `totalSlots` | Sum of working slots × resource capacity across the window (same slot grid as resource day matrix; lunch/blocked hours excluded) |
| `occupiedSlots` | Distinct slot cells with a booking overlap |
| `remainingPct` | `(totalSlots − occupiedSlots) / totalSlots × 100` |
| Guest-equivalent | Retained as secondary signal (`scheduledSlots / 8`) |

### Thresholds (env / defaults)

| Level | Remaining inventory | Hotel behavior |
|-------|---------------------|----------------|
| `ok` | `remainingPct > warnPct` (default **15**) | Silent |
| `warning` | `0 < remainingPct ≤ warnPct` | Soft banner on executive + medical booking UI; **booking allowed** |
| `critical` | `remainingPct ≤ criticalPct` (default **0**) **or** guest-equiv ≥ 125 | Soft banner + **`bookingAllowed=false`** (create medical reservation blocked) |

Env: `CLINIC_CAPACITY_WARN_PCT=15`, `CLINIC_CAPACITY_CRITICAL_PCT=0`.

### Integration

1. **Pull (authoritative for gate):** hotel keeps calling `GET /api/capacity/summary?date=` with bridge secret. Response adds `remainingPct`, `totalSlots`, `occupiedSlots`, `warnPct`, `criticalPct`, `from`/`to`, `message`.
2. **Push (foresight):** clinic emits `SATELLITE_CLINIC_CAPACITY_CHANGED` when evaluated risk **changes** (debounced via tenant `lastCapacityRiskLevel`). Orchestrator accepts the event; hotel can subscribe later — **MVP consumes pull** on executive + booking assert.

### Non-goals

Per-room “95 beds” mapping; biometrics; blocking walk-in appointments on `/scheduling`.

## Consequences

- Medical package create fails only on `critical`.
- Soft warn does not block check-in of guests already booked.
- UAT: fill matrix → executive shows warning → exhaust → new medical booking rejected.
