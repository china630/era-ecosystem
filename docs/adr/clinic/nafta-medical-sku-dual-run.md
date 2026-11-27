# ADR: Nafta medical SKU dual-run (Wave A)

**Status:** Accepted (FO list / agency SoR clauses **superseded** 2026-11-27 by [hotel-sanatorium-sellable-packages.md](../hotel-sanatorium-sellable-packages.md))  
**Date:** 2026-08-30  
**Context:** Elektraweb rate codes are not medical packages. Historical dual-run used Extra Request / agency labels. Clinic programs remain the clinical templates.

## Decision (historical Wave A)

1. **Hotel** historically resolved commercial SKU from notes + agency via `resolveMedicalSku` (never EW `Rate Code` / `medicalFlag`).
2. Priority was: `ERA-PKG` Extra Req → unstructured Extra/Res/CIn phrases → agency prefix / walk-in labels → Həmkarlar → Standart; else unresolved.
3. One agency per reservation → SKU on **all** pax unless Extra Req names contradict.
4. Mix / unresolved → omit `programCode` on lifecycle; stamp `medicalPackageUnresolved`.
5. **Clinic** opens an in-house episode on check-in event; staff Select assigns a template when hotel omitted SKU.
6. Leisure stays skip `dispatchGuestCheckedIn` (`stayKind: leisure`) so clinic stays quiet.
7. ~~Package on `Agency.medicalPackageCode` / name tokens~~ — **retired.** Live FO uses hotel `HotelSellablePackage` + explicit card codes only ([hotel-sanatorium-sellable-packages.md](../hotel-sanatorium-sellable-packages.md)).
8. ~~FO Guests from live clinic program-template-codes~~ — **retired.** FO lists active MEDICAL rows from the hotel catalog snapshot; Infotur is the stay tariff (left), not a guest mix column.
9. Reservation card **Calculate daily prices** does not open the BAR calendar for a medical stay. MEDICAL SKUs use the sell grid (package × charged room type × meal × adult count × night). Mixed packages use the block formula. Infotur uses **its own** sell-grid cells. A missing cell returns an explicit error. A BAR plan quotes from the **booked** room type (`Reservation.roomTypeId`). Saving stores `manualFlag` only for nights the desk edited.

## Consequences

- Per-pax column `ReservationGuest.medicalPackageCode` remains the stamp for clinic `programCode`.
- Live FO package pick-lists and agency-name heuristics → see [hotel-sanatorium-sellable-packages.md](../hotel-sanatorium-sellable-packages.md).

## Related

- FO cheat-sheet: `era-hotel-pms/doc/nafta/ERA-PKG-FO-CHEATSHEET.md` (historical)
- Coverage: HOT-PKG-02, HOT-PKG-05, CLI-50
- Superseding ADR: [hotel-sanatorium-sellable-packages.md](../hotel-sanatorium-sellable-packages.md)
