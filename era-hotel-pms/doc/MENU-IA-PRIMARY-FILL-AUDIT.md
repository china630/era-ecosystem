# MENU IA — primary fill readiness audit (2026-08-07)

Honest status after **primary fill** of Cash / Night Audit stubs created by the MENU-IA cutover.  
Canon: [`MENU-IA-CANON.md`](./MENU-IA-CANON.md). Coverage IDs: `docs/COVERAGE_MATRIX.md`.

## Verdict

| Area | Showable to ops? | Status | Notes |
|------|------------------|--------|-------|
| FO `/fo/*` + HK `/hk/*` route cutover | Yes | Done | Legacy redirects live |
| `/front-cash/transactions` | Yes (read journal) | **API** HOT-CASH-06 | Real `FolioPayment` rows; not a full shift Z |
| `/front-cash/pending` | Yes | SHIPPED HOT-CASH-02 | Unchanged |
| `/front-cash/agency-ledger` | Yes | SHIPPED HOT-CL-03 | Hub can pass `?from=&to=` |
| `/night-audit` core EOD | Yes | SHIPPED HOT-NA-01/02 | Path moved from `/operations` |
| `/night-audit/reports` | Yes (navigation hub) | **API** HOT-NA-03 | Dated links to 8 existing screens |
| `/night-audit/reservation-updates` | Yes (read grid) | **API** HOT-NA-04 | `updatedAt` + audit actions |
| `/night-audit/year-end` | Preview only | **STUB** HOT-NA-05 | POST always `YEAR_END_NOT_ENABLED` |
| Full Elektraweb EOD 01–22 | No | Gap | Replaced by HOT-RPT catalog spec — not implemented |

**Do not claim SHIPPED / Pilot-ready** for HOT-CASH-06, HOT-NA-03/04/05 until UAT-SMOKE UI steps and deepen criteria below.

## What primary fill delivered

### Front cash transactions
- **UI:** `/front-cash/transactions` — date range + table (time, guest, room, kind, method, amount) → folio link.
- **API:** `GET /api/front-cash/transactions?from&to` → `listFrontCashTransactions`.
- **Source of truth:** `FolioPayment` (PAYMENT / REFUND), joined guest/room via folio reservation.

### Night Audit reports hub
- **UI:** `/night-audit/reports` — business-day date picker + codes 01–08 linking to:
  in-house daily, FO reservation times / room changes / reservations, cash journal, agency ledger, EOD logs, reservation updates.
- **Not:** archived PDF store, EW report catalog depth, or separate sidebar rows per report.

### Reservation updates
- **UI:** `/night-audit/reservation-updates` — date range grid + open reservation.
- **API:** `GET /api/night-audit/reservation-updates?from&to`.
- **Logic:** reservations with `updatedAt` in window; optional latest `SatelliteAuditLog` action for `entityType=Reservation`.

### Year end
- **UI:** preview of business date / wall clock / last-or-first-day flags; buttons call staged API.
- **API:** `GET` preview; `POST { action: LAST_DAY | FIRST_DAY }` → `ok: false`, `code: YEAR_END_NOT_ENABLED`.
- **Honesty:** menu is intentional; posting waits Finance calendar sign-off.

## Deepen wave (next, after this audit)

Priority order suggested for ops value:

1. **Cash journal** — include HELD deposits, pending settlement queue summary, day totals by method; optional shift open/close.
2. **EOD reports** — add missing high-value archived reports (cancelled today, created today, folio transactions, room price control) as real grids, not only FO list redirects.
3. **Reservation updates** — filter by action type (cancel / extend / note); export CSV for NA packet.
4. **Year-end** — enable only with ADR + Finance calendar; until then keep STUB response.
5. **UAT-SMOKE** — add UI steps for HOT-CASH-06 / HOT-NA-03 / HOT-NA-04 before any SHIPPED bump.

## Anti-claims (this wave)

- Not “Elektraweb Night Audit parity”.
- Not “year-end posting live”.
- Not “full EOD report pack 01–22”.
- Core NA EOD (HOT-NA-01) remains the shipped close path; new hub screens are navigation + primary data views.
