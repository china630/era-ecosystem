# ADR: Hotel year-end close / open (calendar gate)

**Status:** Accepted (hotel boundary live; finance GL year close stays in finance)  
**Date:** 2026-08-07  
**Scope:** `era-hotel-pms` Night Audit year-end (`/night-audit/year-end`); Finance calendar sign-off

## Context

Elektraweb exposes “Last day of year” / “First day of year” under Night Audit. ERA MENU-IA keeps these items in the sidebar so ops can find them, but live posting must not invent a fiscal year-end without Finance ownership of the accounting calendar.

Hotel already owns **business date** roll (`HotelProfile.currentBusinessDate`, `BusinessDay`, Night Audit Step 4). That is **not** the same as calendar year close for AR/GL.

## Decision

| Layer | Owner | Behavior now |
|-------|-------|--------------|
| Menu + preview UI | Hotel | `/night-audit/year-end` shows business date, wall clock, last/first-day flags |
| API | Hotel | `GET/POST /api/night-audit/year-end` seals 31 Dec and opens 1 Jan on the business date |
| Live year close/open | Hotel calendar | Does not call finance `closeFiscalYear`. Buttons are live only on that business date |
| Daily Night Audit EOD | Hotel | Rolls the business date except on 31 December, when the date stays until Last Day of the Year |

Last Day of the Year writes `HotelYearBoundary` kind `CLOSED` and then advances the business date to 1 January. It is pressable only when the business date is 31 December, that business day is already `CLOSED`, the year is not sealed, and the blocks are empty: unclosed cash, an open POS shift, deferred checks when settlement policy is `BLOCK`, a checked-out folio with a balance, an open city ledger when `yearEndBlockIfOpenCityLedger` is on, and any earlier `OPEN` business day in that calendar year. Guests who stay through New Year do not block.

First Day of the Year writes kind `OPENED`. It is pressable only on 1 January, and only when the previous year is sealed or that year had no business days. Until `OPENED` exists, a charge or payment with business date 1 January is refused (`YEAR_NOT_OPEN`). Posting into a sealed year is refused (`YEAR_CLOSED`). A second press does not seal or open again.

Finance `closeFiscalYear` is not called from these buttons. Coverage **HOT-NA-05 = API** until a UAT-SMOKE path exists. This is not a sell or pilot claim.

## Consequences

- The hotel operational year has an explicit seal and open, stored with the actor and the business date.
- General-ledger year close stays a finance action.
- Night audit on 31 December closes the day and leaves the business date in place.

## Related

- `era-hotel-pms/doc/MENU-IA-CANON.md`
- `era-hotel-pms/doc/MENU-IA-PRIMARY-FILL-AUDIT.md`
- `docs/adr/hotel-city-ledger-and-fo-money.md`
- Coverage: HOT-NA-05
