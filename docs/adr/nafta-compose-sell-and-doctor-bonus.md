# ADR: Nafta composed package sell + doctor bonus extras (Wave D)

**Status:** Accepted — 2026-08-30

## Hotel compose

`composeNaftaPackageNightlySell` / `composeNaftaPackageNightlySellBreakdown`:

- **Main** = guest with highest occupancy-1 sell of their SKU.
- **Companion Standart** = +`STANDART_COMPANION` pricing component (default **96 AZN**), not half of 239.
- **Other companion** = half of that SKU’s occupancy-2 (Dermo 321→160, Detoks 319→160).
- **Same SKU all pax** → occupancy 1/2/3 sell versions (Standart caps at occ-3).
- **3 mixed adults** = main + each other as companion (not occupancy-3 of the main SKU).
- Unresolved / EW Rate Code only → do not invent sell.
- Night audit posts when `medicalPackageCode` (reservation or any pax) resolved — not only `ratePlan.medicalFlag`.
- `syncComposedDailyRates` writes `ReservationDailyRate`; FO folio shows breakdown (`packageCompose`).

## Clinic bonus

`ProcedureOrder.bonusEligible` at COMPLETED via `resolveBonusEligible` (`amountNet > 0`, not imported). Doctor-bonus report filters `bonusEligible`, splits **IN_HOUSE / WALK_IN**, applies `Tenant.doctorBonusPercentInHouse` / `doctorBonusPercentWalkIn` (default **0** until FO sets). Package confirm lines with amountNet 0 are excluded.

## Related

HOT-PKG-03 (API until UAT), CLI-53 SCREEN; out of CASH/SAN rollups. Amends [hotel-bar-accounting-vs-package-sell.md](./hotel-bar-accounting-vs-package-sell.md).
