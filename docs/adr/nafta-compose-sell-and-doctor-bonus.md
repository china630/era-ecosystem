# ADR: Nafta composed package sell + doctor bonus extras (Wave D)

**Status:** Accepted — 2026-08-30

## Hotel compose

`composeNaftaPackageNightlySell` / `composeNaftaPackageNightlySellBreakdown`:

- **Same package** = the grid cell for the charged room type, meal, adult count, and that night's date.
- **Standart in the mix** = Standart cell of this room type for the Standart headcount; other packages at their standard-room cell (Premium uses its own flat cell).
- **No Standart, one package has two or more guests** = that package's cell of this room type; the others at base.
- **Dermo and Detoks, one each** = Dermo at this room type; Detoks at its standard-room single.
- The +96 companion and half-of-double are not the sell rule.
- Unresolved / EW Rate Code only, or a missing cell → do not invent sell.
- Night audit posts when `medicalPackageCode` (reservation or any pax) resolved — not only `ratePlan.medicalFlag`.
- `syncComposedDailyRates` writes `ReservationDailyRate`; FO folio shows breakdown (`packageCompose`).

## Clinic bonus

`ProcedureOrder.bonusEligible` at COMPLETED via `resolveBonusEligible` (`amountNet > 0`, not imported). Doctor-bonus report filters `bonusEligible`, splits **IN_HOUSE / WALK_IN**, applies `Tenant.doctorBonusPercentInHouse` / `doctorBonusPercentWalkIn` (default **0** until FO sets). Package confirm / in-quota lines with amountNet 0 are excluded (W3 entitlement charge keeps package fulfillment at 0).

## Related

HOT-PKG-03 (API until UAT), CLI-53 SCREEN; out of CASH/SAN rollups. Amends [hotel-bar-accounting-vs-package-sell.md](./hotel-bar-accounting-vs-package-sell.md).
