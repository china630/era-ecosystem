# ADR: Nafta medical SKU dual-run (Wave A)

**Status:** Accepted  
**Date:** 2026-08-30  
**Context:** Elektraweb rate codes are not medical packages. FO writes package intent in Extra Request / agency labels. Clinic needs `PKG-STANDART` | `PKG-PREMIUM` | `PKG-DERMA` | `PKG-DETOKS`.

## Decision

1. **Hotel** resolves commercial SKU from notes + agency via `resolveMedicalSku` (never EW `Rate Code` / `medicalFlag`).
2. Priority: `ERA-PKG` Extra Req → unstructured Extra/Res/CIn phrases → agency prefix / walk-in labels → Həmkarlar → Standart; else unresolved.
3. One agency per reservation → SKU on **all** pax unless Extra Req names contradict.
4. Mix / unresolved → omit `programCode` on lifecycle; stamp `medicalPackageUnresolved`.
5. **Clinic** always opens an in-house episode on check-in event; staff Select assigns one of four templates when hotel omitted SKU.
6. `Walkin leisure` is **not** a medical SKU: hotel check-in **skips** `dispatchGuestCheckedIn` (`stayKind: leisure`) so clinic stays quiet; clinic «always open» still applies if a lifecycle event somehow arrives.
7. The package lives on `Agency.medicalPackageCode`. Import stamps `PKG-*` from the agency name (`resolveAgencyPackageCode`). Empty code on the travel-agency form means “from the name”. The prefix table `AgencyMedicalSkuRule` is removed.
8. FO Guests tab sets `ReservationGuest.medicalPackageCode` on the Medical Rates family from the current clinic template codes (`GET /api/internal/v1/program-template-codes`). A stay tariff whose code is itself a current clinic template (including `PKG-INFOTUR`) stamps that code on the guest and sends it as `programCode`. The clinic list is not answered: an already stored `PKG-*` is kept and still sent; a new code is not invented. Night prices stay on their own tariff grids.
9. Reservation card **Calculate daily prices** does not open the BAR calendar for a medical stay. The four medical SKUs use the sell grid for each night: package × charged room type × meal × adult count × that night's date. Mixed packages use the block formula. Infotur uses **its own** sell-grid cells, not that mix. No compiled 139/193/180/178/96 fallback and no `pricePerNight` fallback. A missing cell leaves stored nights in place and returns an error. A BAR plan still quotes from the **booked** room type (`Reservation.roomTypeId`), not the assigned door. Saving the card stores `manualFlag` only for nights the desk edited.

## Consequences

- Per-pax column `ReservationGuest.medicalPackageCode` stores dual-run resolve; Wave E uses it for two episodes.
- Quotas / composite price / doctor day-1 confirm are later waves (B–E landed; see related ADRs).

## Related

- FO cheat-sheet: `era-hotel-pms/doc/nafta/ERA-PKG-FO-CHEATSHEET.md`
- Coverage: HOT-PKG-02, CLI-50
- Pilot polish leisure gate + agency table + FO SKU UI
