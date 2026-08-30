# ADR: Nafta medical SKU dual-run (Wave A)

**Status:** Accepted  
**Date:** 2026-08-30  
**Context:** Elektraweb rate codes are not medical packages. FO writes package intent in Extra Request / agency labels. Clinic needs `PKG-STANDART` | `PKG-PREMIUM` | `PKG-DERMO` | `PKG-DETOKS`.

## Decision

1. **Hotel** resolves commercial SKU from notes + agency via `resolveMedicalSku` (never EW `Rate Code` / `medicalFlag`).
2. Priority: `ERA-PKG` Extra Req → unstructured Extra/Res/CIn phrases → agency prefix / walk-in labels → Həmkarlar → Standart; else unresolved.
3. One agency per reservation → SKU on **all** pax unless Extra Req names contradict.
4. Mix / unresolved → omit `programCode` on lifecycle; stamp `medicalPackageUnresolved`.
5. **Clinic** always opens an in-house episode on check-in event; staff Select assigns one of four templates when hotel omitted SKU.
6. `Walkin leisure` is **not** a medical SKU: hotel check-in **skips** `dispatchGuestCheckedIn` (`stayKind: leisure`) so clinic stays quiet; clinic «always open» still applies if a lifecycle event somehow arrives.
7. Editable `AgencyMedicalSkuRule` (SatAdmin `/settings/agency-medical-sku`) overrides code defaults when seeded; empty table → hardcoded prefixes remain.
8. FO Guests tab may set `ReservationGuest.medicalPackageCode` per pax; save stamps FO codes + `syncComposedDailyRates` + stay-product (non-leisure).

## Consequences

- Per-pax column `ReservationGuest.medicalPackageCode` stores dual-run resolve; Wave E uses it for two episodes.
- Quotas / composite price / doctor day-1 confirm are later waves (B–E landed; see related ADRs).

## Related

- FO cheat-sheet: `era-hotel-pms/doc/nafta/ERA-PKG-FO-CHEATSHEET.md`
- Coverage: HOT-PKG-02, CLI-50
- Pilot polish leisure gate + agency table + FO SKU UI
