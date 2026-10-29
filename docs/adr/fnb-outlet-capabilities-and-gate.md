# ADR: F&B outlet capabilities + Elektra outlet gate

**Status:** Accepted — 2026-10-29  
**Scope:** `era-fnb-pos` outlets, nav, login/PIN bind  
**Related:** [era-kafe-edition.md](./era-kafe-edition.md) §4 · [hotel-revenue-code-resolution.md](./hotel-revenue-code-resolution.md) · [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md)

## Context

One org (one VÖEN) has many F&B **outlets** (Naftani, Xudmani, buffet kitchen, disco). Org-wide `enabledPresets` made one sidebar for every point. A hard-coded outlet code `RESTAURANT` was invented as a till default and could not be renamed/deleted in Settings.

## Decision

1. **Kill `RESTAURANT`.** Never invent that code. Nafta canon codes: `NAFTANI`, `XUDMANI` (+ disco later). Ops script: `era-fnb-pos/scripts/ops/kill-restaurant-outlet.ts`.
2. **Per-outlet capabilities** on `Outlet`: `capTill`, `capTables`, `capBuffetPlanner`, optional `shapeHint` (`cafe` | `restaurant` | `buffet_kitchen` | `disco`). Create wizard seeds caps from shape.
3. **Nav** = edition presets (ceiling) ∩ purchased modules ∩ **selected outlet caps**. Buffet submenu only when `capBuffetPlanner` and module `fnb_buffet_planner`; Zal/Masalar only when till/tables.
4. **Elektra gate:** after password/SSO → `/select-outlet` tiles → `POST /api/outlets/select` sets cookie `era_fb_outlet_id`. Middleware requires the cookie for ops pages (PIN sessions bind cookie on PIN login). PIN terminal pair: credentials → optional outlet tiles → bind → names → PIN.
5. **Revenue SoR** remains menu **category**; Settings demotes outlet revenue to fallback-only copy.
6. Peer hotel URL stays registry/Sync — not `.env` SoR.

## Consequences

- Settings: rename code/name, caps, DELETE (blocked if OPEN shift).
- Seeds/import/smoke must not default to `RESTAURANT`.
- Product status stays SCREEN / `mvp` until UAT — this ADR is not sell-green.

## Out of scope

- Separate org per point; `pos` capacity billing (buffet-only should not +19 later); full disco screens.
