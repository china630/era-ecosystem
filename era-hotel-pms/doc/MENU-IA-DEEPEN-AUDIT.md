# MENU IA — deepen wave readiness audit (2026-08-07)

Follow-up to [`MENU-IA-PRIMARY-FILL-AUDIT.md`](./MENU-IA-PRIMARY-FILL-AUDIT.md).  
Coverage: `docs/COVERAGE_MATRIX.md`. UAT: [`UAT-SMOKE.md`](./UAT-SMOKE.md) §28.

## Verdict (honest)

| ID | Capability | Status | Showable? | Caveat |
|----|------------|--------|-----------|--------|
| HOT-CASH-06 | Cash journal deepen | **SHIPPED** | Yes | Not a full cash-shift Z / register close report |
| HOT-NA-03 | EOD hub + P1 grids | **SHIPPED** | Yes | Four real grids + hub; **not** Elektraweb 01–22 archive parity |
| HOT-NA-04 | Reservation updates | **SHIPPED** | Yes | Action kinds are heuristics on audit/status/notes |
| HOT-NA-05 | Year-end | **STUB** | Preview only | ADR `hotel-year-end-calendar`; POST always `YEAR_END_NOT_ENABLED` |
| HOT-NA-01/02 | Core EOD + polish | **SHIPPED** | Yes | Path `/night-audit` (unchanged product depth) |

**Overall:** MENU-IA Cash/NA stubs from cutover are now **ops-usable** for day-close packet navigation and P1 control lists. Do **not** claim full Elektraweb Night Audit / year-end / full EOD catalog parity. Pilot FO/NA daily close remains on HOT-NA-01 + folio/cash SHIPPED rows — this wave improves the **packet around** EOD, not the EOD engine itself.

## What deepen delivered

1. **Cash journal** — `listFrontCashJournal`: FolioPayment + FolioDeposit (HELD window / still HELD) + pending summary/items + open `CashShift` + totals by method. UI sections + links to pending / NA shift.
2. **EOD P1 grids** — `GET /api/night-audit/eod-reports?type=&date=` + `/night-audit/reports/{cancelled,created,folio-transactions,room-price-control}`. Hub regrouped P1 / ops / FO.
3. **Reservation updates** — `action=CANCEL|EXTEND|NOTE|OTHER` + `format=csv` download.
4. **Year-end** — ADR written; posting remains disabled by design.
5. **UAT-SMOKE §28** — UI steps for the three SHIPPED rows + STUB check for year-end.
6. **`/night-audit/logs`** — page restored (was missing after MENU-IA move; legacy path redirected into a 404).

## Explicit non-claims

- Not “year closed in production”.
- Not “all EW Night Audit reports”.
- Not “perfect cancel/extend telemetry” (no dedicated `cancelledAt` column; classification is best-effort).
- Not “cash shift Z equals fiscal register Z” (open-shift line only; close still on `/night-audit`).

## Residual backlog (optional next)

| Item | Why |
|------|-----|
| Dedicated `cancelledAt` / cancel reason columns | Cleaner cancel report than `updatedAt` |
| Shift Z totals tied to `CashShift.id` | True register close packet |
| EW reports 13–22 | Product ask / import archive |
| Enable year-end posting | Finance checklist in ADR |

## Recommendation

Treat deepen as **done for MENU-IA P1**. Next product energy should go to Nafta UAT of §28 on a seeded day, then either EW archive depth or Finance year-end enablement — not more stub shells.
