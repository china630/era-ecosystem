# ADR: Sync satellites after billing module changes

**Status:** Accepted (2026-10-28)  
**Related:** CP-BILL-OWNER-01 · `SatelliteOrgBindSyncService` · F&B `fnbOrgProfile`

## Context

Owner `POST /v1/billing/toggle-module` wrote `activeModules` on the orchestrator but did **not** push runtime-config. F&B submodule gates read local `fnbOrgProfile.activeModules`, filled only by Sync `POST …/runtime-config`. Desired-state pull updated process memory only. Result: toggle looked on in workspace; F&B showed `F&B module not active` until a manual Super-admin Sync.

Edition upgrade / kafe onboard already called `syncForOrg` — an uneven standard.

## Decision

1. **Orch:** After any successful mutation that changes entitlement modules, best-effort `syncForOrg` via `BillingSatelliteNotifyService` (toggle, bundle, connect, admin patch, payment finalize, premium activate, monthly finalize, legacy `PATCH …/modules`). Failure logs and returns `synced: false`; billing commit is not rolled back.
2. **F&B:** `requireFnbSubmodule` and `/api/auth/me` prefer live CP subscription snapshot, then local profile (air-gap). Optional heal of `fnbOrgProfile` when CP differs.
3. **Pull:** Desired-state apply may call `onSharedOrgSnapshot` (F&B boot wires `upsertFnbOrgSnapshot`) so poll also heals the local profile.

## Consequences

- Owner enable Buffet no longer requires manual Sync when endpoints are healthy.
- Ops keep Super-admin Sync as fallback when push fails (`synced: false` toast).
- Hotel/clinic industry gates already used CP snapshot; F&B submodules are aligned.
