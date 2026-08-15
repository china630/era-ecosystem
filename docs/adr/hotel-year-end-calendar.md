# ADR: Hotel year-end close / open (calendar gate)

**Status:** Accepted (staged — posting not enabled)  
**Date:** 2026-08-07  
**Scope:** `era-hotel-pms` Night Audit year-end (`/night-audit/year-end`); Finance calendar sign-off

## Context

Elektraweb exposes “Last day of year” / “First day of year” under Night Audit. ERA MENU-IA keeps these items in the sidebar so ops can find them, but live posting must not invent a fiscal year-end without Finance ownership of the accounting calendar.

Hotel already owns **business date** roll (`HotelProfile.currentBusinessDate`, `BusinessDay`, Night Audit Step 4). That is **not** the same as calendar year close for AR/GL.

## Decision

| Layer | Owner | Behavior now |
|-------|-------|--------------|
| Menu + preview UI | Hotel | `/night-audit/year-end` shows business date, wall clock, last/first-day flags |
| API | Hotel | `GET/POST /api/night-audit/year-end` — POST returns `YEAR_END_NOT_ENABLED` |
| Live year close/open | Blocked | Requires Finance calendar sign-off + feature flag |
| Daily Night Audit EOD | Hotel | Unchanged (`HOT-NA-01`) — rolls business day only |

### Enablement checklist (all required)

1. Finance ADR / calendar policy for satellite year boundary (AZN fiscal year = calendar year unless org override).
2. Explicit org flag (env or `HotelProfile`) `yearEndPostingEnabled=true` after Finance sign-off.
3. Preconditions: no open cash shift blocking policy decided; pending settlement policy decided; no OPEN `BusinessDay` gaps for the year.
4. Audit trail for LAST_DAY / FIRST_DAY with actor + before/after business date.
5. UAT-SMOKE UI path on a non-prod calendar window.

Until then: keep `enabled: false` and `code: YEAR_END_NOT_ENABLED`. Coverage **HOT-NA-05 = STUB**.

## Consequences

- Ops can rehearse navigation and read preview without risk of false “year closed”.
- Deepen wave must not silently flip posting on.
- Clone-spec A.7 year-end remains out of phase-1 product claims.

## Related

- `era-hotel-pms/doc/MENU-IA-CANON.md`
- `era-hotel-pms/doc/MENU-IA-PRIMARY-FILL-AUDIT.md`
- `docs/adr/hotel-city-ledger-and-fo-money.md`
- Coverage: HOT-NA-05
