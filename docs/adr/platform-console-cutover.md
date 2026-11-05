# ADR: Platform console cutover (remove client /super-admin)

**Status:** Accepted  
**Date:** 2026-11-03  
**Related:** [orch-admin-shell.md](./orch-admin-shell.md) · [control-home-ia.md](./control-home-ia.md) · [ECOSYSTEM_URLS.md](../ECOSYSTEM_URLS.md)

## Context

Vendor SuperAdmin UI was dual-hosted: client CP `app.era-365.online/super-admin/*` and `platform.era-365.online` (`apps/platform-web`, CP-SA-CONSOLE-01). Dual shell confuses owners and ops.

## Decision

1. **Canonical vendor UI:** `apps/platform-web` on `platform.era-365.online` (short paths).
2. **Client `apps/web`:** remove SuperAdmin nav and page implementations; `/super-admin/*` **redirects** to the platform origin with path mapping (`/super-admin/orgs` -> `/orgs`, etc.).
3. **Login:** `isSuperAdmin` users prefer platform console; owners stay on app Control Home.
4. **Finance** `/super-admin/*` redirects to platform origin (update orch-admin-shell).
5. COVERAGE / UI board: SuperAdmin actor = platform only; drop dual-shell wording after cutover UAT.

## Consequences

- Bookmarks to app SA URLs keep working via redirect.
- Platform session cookies (`era_platform_*`) remain separate from client CP session.
