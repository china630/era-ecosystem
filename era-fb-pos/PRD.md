# PRD — ERA F&B POS (domain-local)

> Product requirements for the restaurant satellite. Global UI/UX: [`../DESIGN.md`](../DESIGN.md).

## Problem

Hotels need a dedicated F&B operations product (floor, kitchen, POS shift, fiscal) separate from PMS folio and ERP GL.

## Goals (v1 / Nafta)

- Floor map and open tickets
- Kitchen display (KDS)
- Room charge to guest folio via **era-hotel-pms** bridge
- POS shift signal for night audit block
- Standalone restaurant mode (no PMS) for walk-in

## Non-goals (v1)

- SPA / medical packages (hotel-pms)
- Local stock ledger (ERP only)
- PMS chessboard / night audit UI

## Spec

See [`doc/README.md`](./doc/README.md) and [`doc/DELIVERY-FB.md`](./doc/DELIVERY-FB.md).
