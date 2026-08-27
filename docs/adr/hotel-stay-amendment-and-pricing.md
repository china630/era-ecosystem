# Hotel stay amendment and pricing (Nafta FO)

**Status:** Accepted  
**Date:** 2026-08-24  
**Apps:** `era-hotel-pms`, `era-clinic` (remaining procedures), orchestrator fan-out

## Decision

Do not clone Opera (folio windows, upgrade offers, share split). Copy Opera **laws** only:

- Posted nights are not rewritten.
- New charged product (`roomTypeId` + `ratePlanId`) starts from an **effective date** (stay slices: `[from, to)` exclusive).
- Physical door type may differ from charged type (`givenRoomTypeId` / complimentary relocate).
- Manual Price is **stay-level** (nightly or stay total spread). Stay % is mutually exclusive. Per-night lock only.

Three FO actions:

1. **Door move** (rack DnD) — same charged type or **comp** other type. Not a paid upgrade.
2. **Product change from date** — wizard (preview + apply). Recalc remaining unlocked nights; Manual Price freezes remaining amounts.
3. **Clinic remaining replan** — `SATELLITE_HOTEL_STAY_PRODUCT_CHANGED` cancels future `PROPOSED`/`SCHEDULED` procedures and updates program code. Does not cancel `COMPLETED` / `CHECKED_IN` / `NO_SHOW`.

Same-day folio: if tonight is already posted, add one `RATE_ADJ` difference line (`externalRef` `rate-adj:{resId}:{date}`). Package EOD lines **scale** so Σ = that night’s sell (`ReservationDailyRate.amount`).

## Coverage

`HOT-FO-04` = **API** until UAT-SMOKE §35 is signed. Do not Scaffold-green `AC-HOT-AMEND`.
