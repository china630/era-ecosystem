# UAT — Platform recovery / ownership dispute (pre-GA MVP)

**Scope:** `MOD-PLT-DSP-001` — procedure doc only; full legal SLA → v3.1.

## Preconditions

- Finance API with `PlatformRecoveryModule` loaded
- Super-admin or owner JWT

## Happy path (smoke)

1. Owner initiates ownership transfer on Orchestrator (canonical).
2. Finance `DisputeFreezeGuard` blocks mutating routes when dispute is open.
3. Admin reviews dispute snapshot in super-admin (if UI wired).

## Env

- `ERA_AUTH_MODE=control-plane`
- `ERA_CONTROL_PLANE_RBAC_PROXY=true`
