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

Occupancy drop when a companion **departs** mid-stay (adults/children from an effective date, stay remains `IN_HOUSE`) is the same pricing law — [hotel-reservation-card-and-party-ops.md](./hotel-reservation-card-and-party-ops.md) D4. It is not unused-nights refund of the whole stay.

Three FO actions:

1. **Door move** (rack DnD) — same charged type, or the hotel covers another type (`givenRoomTypeId`). Not a paid upgrade. On the reservation card, a different given type asks who pays: hotel covers (charged type unchanged), guest pays the given class (charged type becomes the given type for remaining nights), or a downgrade (hotel refund vs guest asked for cheaper). Never label a cheaper given type as an upgrade.
2. **Product change from date** — wizard (preview + apply). Recalc remaining unlocked nights; Manual Price freezes remaining amounts.
3. **Clinic remaining replan** — `SATELLITE_HOTEL_STAY_PRODUCT_CHANGED` cancels future `PROPOSED`/`SCHEDULED` procedures and updates program code. Does not cancel `COMPLETED` / `CHECKED_IN` / `NO_SHOW`.

Same-day folio: if tonight is already posted, add one `RATE_ADJ` difference line (`externalRef` `rate-adj:{resId}:{date}`). Package EOD lines **scale** so Σ = that night’s sell (`ReservationDailyRate.amount`).

A rate-plan change (card save or the wizard) appends `StayTariffChange` (from code, to code, effective time). The reservation journal shows that line next to room moves. Posted nights stay as they were.

## Stay billing

`Reservation.billingMode`:

| Mode | Room nights | Extras (restaurant, clinic, folio) |
|------|-------------|-------------------------------------|
| `NORMAL` | Tariff grid | Charged |
| `COMP` | 0, occupancy complimentary | Charged |
| `HOUSE` | 0, occupancy house use | Posted, then offset so the guest balance stays 0 |

Meal plan (BB/FB) is not this mode. A zero nightly price is legal only for `COMP` and `HOUSE`.

## Check-in and clinic

Clinic receives a guest at check-in when that guest has an explicit medical package, and again when that package changes on an in-house stay. Saving a reservation that is not yet in house does not open a clinic episode. The tariff does not fill a package the receptionist left empty. `WALKIN` hides the package column and does not send clinic.

A past arrival date moves to the business day on check-in. Nights before that day are dropped and not charged. The confirmation text names the new date only in that case.

The Walk-in Leisure agency name does not mute clinic. The Elektra bridge still treats that label as non-medical when the imported tariff is not a medical `PKG-*` SKU (Infotur does not count).

## Coverage

`HOT-FO-04` = **API** until UAT-SMOKE §35 is signed. Do not Scaffold-green `AC-HOT-AMEND`.
