# ADR: Unified settlement hub (hotel Front Cash)

**Status:** Accepted  
**Date:** 2026-06-14  
**Extends:** [org-operating-mode.md](./org-operating-mode.md), supersedes walk-in leg of [fb-mixed-settlement-routing.md](./fb-mixed-settlement-routing.md) when hub policy is active.

## Context

Nafta sanatorium runs one VÖEN with department satellites (F&B, clinic) where `fiscalRouting=PARENT` and `revenueRouting=PARENT`. Walk-in guests must pay once at **hotel Front Cash** with a single fiscal receipt (SV14). In-house guests continue to settle via **folio room-charge** with no pending queue.

Reception staff work only in `era-hotel-pms`; they do not log into fb-pos or clinic for payment.

## Decision

### Policy (orchestrator)

Organization `settings` JSON (also exposed on `/v1/subscription/me` as `settlementPolicy`):

| Key | Values | Default (Nafta parent with department children) |
|-----|--------|--------------------------------------------------|
| `settlementHub` | `HOTEL_FRONT_CASH` \| `SATELLITE_OWN` | `HOTEL_FRONT_CASH` when parent has departments with `fiscalRouting=PARENT` |
| `pendingSettlementNaPolicy` | `BLOCK` \| `WARN` | `BLOCK` |

Department orgs inherit hub mode from parent unless explicitly overridden to `SATELLITE_OWN`.

### Pending charge lifecycle

1. Department satellite (fb-pos walk-in, clinic `WALK_IN`) calls `POST /api/settlement/pending` on hotel-pms (Bearer / `x-pos-bridge-secret`: `POS_BRIDGE_SECRET`).
2. Row `SettlementPendingCharge` created with `status=PENDING`, unique `idempotencyKey`.
3. Front Cash cashier pays via `POST /api/settlement/pending/[id]/pay` — amount read-only, fiscal via `@era/fiscal` on primary open `CashShift`.
4. Hotel calls `POST /api/integration/settlement-confirmed` on source satellite to close ticket/visit.
5. Manager may void pending via `POST /api/settlement/pending/[id]/void`.

### What creates pending (and what does not)

| Source | Creates pending? |
|--------|------------------|
| FB walk-in / dine-in without reservation link | Yes, when `deferWalkInToHub` |
| Clinic `patientOrigin=WALK_IN` | Yes, when `deferWalkInToHub` |
| FB/clinic in-house → hotel folio | No |
| Entitlements / zero-post / B2B city ledger | No |
| `settlementHub=SATELLITE_OWN` | No — local cashier unchanged |

### Night audit

Before business-day close, count `SettlementPendingCharge` with `status=PENDING` for current business date.

- `pendingSettlementNaPolicy=BLOCK` (default): night audit **throws** (same as open cash/POS shifts).
- `WARN`: step note in `stepsJson`; audit continues.

### Bridge auth

Reuse `POS_BRIDGE_SECRET` / `CLINIC_BRIDGE_SECRET` for pending create and settlement-confirmed callbacks.

## Consequences

- Single fiscal point for walk-in under one VÖEN.
- Department POS/clinic UIs show “Send to reception” instead of local pay when hub active.
- Hotel `/operations` surfaces pending count badge linking to `/front-cash/pending`.
- Future retail/pharmacy can reuse the same pending model (`sourceSystem=RETAIL`).
