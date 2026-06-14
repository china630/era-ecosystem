# ADR: Orchestrator workspace launcher (post-login IA)

**Status:** Accepted  
**Date:** 2026-06-10

## Context

Orchestrator web home (`/`) rendered all nine industry tiles. When `hasIndustryModuleAccess()` was false (common for new orgs — trial grants Finance slugs only, not `industry_*`), tile click opened **Early access waitlist** instead of a clear subscription state. Satellites exist and are production-ready; the UX was a **painted door**, not missing product.

## Decision

1. **Information architecture**
   - `/` — thin redirect: guest → `/login`; authed without org → `/organizations`; authed with org → `/workspace`.
   - `/organizations` — org hub (list, switch, **+ Organization** modal → `POST /auth/register-organization`).
   - `/workspace` — systems of the **active org** (Finance + industry), with explicit statuses:
     - **Active** → Open (SSO / Finance handoff)
     - **Not in subscription** → **Add module** opens a modal with all catalog modules for that satellite (`POST /v1/billing/toggle-module`; disable shows end-of-month billing notice)
     - **Read-only (trial expired)** → Renew → `/settings/subscription`
   - `/pricing` — full catalog and purchase (unchanged).
   - `/industry/[vertical]` — SSO deep link only; no auto-redirect to waitlist.

2. **Early access**
   - Keep API and super-admin waitlist.
   - Remove waitlist triggers from post-login launcher tiles.

3. **Dev UAT (superseded by [platform-trial-hierarchy](./platform-trial-hierarchy.md))**
   - ~~`ERA_DEV_UNLOCK_ALL_MODULES`~~ — use owner **Connect satellite** + super-admin trial UI instead.

4. **Backlog (partially delivered)**
   - Owner-facing modular subscription admin UI — **workspace module modal** (per-satellite toggles); full marketplace on `/settings/subscription` remains backlog.

## Consequences

- New users: register → `/organizations` → create org → `/workspace`.
- Nafta UAT: owner **Connect** satellites on `/workspace`; ops extends trial via `/super-admin/orgs/{id}/subscription` — see [platform-trial-hierarchy](./platform-trial-hierarchy.md).
- Docs: `ECOSYSTEM_URLS.md`, `LOCAL_UAT_GAP_CHECKLIST.md`, `NAFTA_SANATORIUM_UAT.md`, `QUARTET_UAT.md`, module-map rule.

## References

- Plan: orchestrator launcher UX (2026-06)
- [`packages/satellite-kit/src/platform/workspace-system-catalog.ts`](../../packages/satellite-kit/src/platform/workspace-system-catalog.ts)
- [`era-orchestrator/apps/api/src/subscription/subscription-access.service.ts`](../../era-orchestrator/apps/api/src/subscription/subscription-access.service.ts)
