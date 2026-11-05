# Platform Structure owner UX — lab signoff

**Date:** 2026-11-05  
**Scope:** CP-STRUCTURE-01 / CP-HOME-01 owner UI (org → dept → system → outlet).  
**Status:** Lab evidence only — **not** UAT-SMOKE field signoff; **not** SHOW / SHIPPED / Pilot / sell.

## Preconditions

- Owner session on orchestrator app (`/workspace`).
- Org with at least one connected satellite (ideally F&B) and optional department children.
- Existing `cp-structure-negative.spec.ts` remains the AC negative path.

## UI path (owner)

1. Open `/workspace` — Platform apps includes Structure; summary strip shows department / system / outlet counts when tree loads; **Manage structure** → `/workspace/structure`.
2. On Structure: hierarchical root org card, departments list with **Switch here** (uses `/auth/switch-organization`), systems for active org with nested outlets table (no free-text `satelliteKey`).
3. **Add outlet** — CatalogField system select + code/name; toast notes billing/allowlist registration (CP does not push ops materialize).
4. Edit outlet name; Suspend/Resume outlet; Suspend/Resume satellite (confirm); Delete outlet (confirm).
5. **Open in {system}** — SSO / Finance handoff (no outlet query bind).
6. Department banner when `activeOrganizationId !== rootOrganizationId`; **Back to root**.

## Second-pass fixes (2026-11-05)

- Structure fetch/mutations prefer `getOrchAccessToken()` after dept switch (avoid stale React JWT race).
- Satellite fallback labels use `workspace.systems.*.title` (not raw i18nKey).
- Add-outlet blocked when selected system is suspended; sat options reset on org switch.
- Module-map / Control Home ADR / `UAT-SMOKE-PLATFORM` UI table aligned.

## Honest gaps (do not claim closed)

- CP → satellite outlet materialize not implemented (sat→CP upsert only).
- Human field UAT / SHOW / SHIPPED / Pilot / edition `ga` unchanged.
- Home summary does not live-refresh after Structure edits until remount / org or entitlement-count change.
