# ADR: Orchestrator admin shell (SP9)

## Status

Accepted — 2026-05-26

## Context

Super-admin UI lived on Finance web (`/super-admin/*`) while APIs are on Orchestrator (`v1/admin/*`, `internal/v1/mdm/*`).

## Decision

- **Canonical admin UI host:** `era-365-orchestrator/apps/web` at `/super-admin/*`
- **BFF:** Next.js routes `/api/cp-admin/*` and `/api/cp-mdm/*` proxy to Orch API with user Bearer JWT (and service token for MDM internal reads)
- **Finance:** `/super-admin/*` redirects to `NEXT_PUBLIC_ORCH_WEB_URL/super-admin/*`
- **Finance-specific NAS/GL reference data** remains on Finance web only (domain data plane)

## Consequences

- Super-admin operators start at `app.era.az` (Orch web :3100)
- Finance web is no longer the industry or platform admin entry
