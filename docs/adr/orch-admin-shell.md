# ADR: Orchestrator admin shell (SP9)

## Status

Accepted — 2026-05-26

## Context

Super-admin UI lived on Finance web (`/super-admin/*`) while APIs are on Orchestrator (`v1/admin/*`, `internal/v1/mdm/*`).

## Decision

- **Canonical admin UI host (2026-11 cutover):** `era-orchestrator/apps/platform-web` on `platform.era-365.online` (short paths) — [platform-console-cutover.md](./platform-console-cutover.md). Client `apps/web` `/super-admin/*` redirects to platform.
- **BFF:** Next.js routes `/api/cp-admin/*` and `/api/cp-mdm/*` proxy to Orch API with user Bearer JWT (and service token for MDM internal reads)
- **Finance:** `/super-admin/*` redirects to platform origin (`ERA_PLATFORM_ORIGIN` / `platform.era-365.online`), not app `/super-admin`
- **Finance-specific NAS/GL reference data** remains on Finance web only (domain data plane)

## Consequences

- Super-admin operators start at `app.era-365.online` (Orch web `:3000`)
- Finance web is no longer the industry or platform admin entry
