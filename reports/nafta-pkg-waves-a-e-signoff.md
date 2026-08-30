# Nafta medical packages — Waves A→E signoff (47-point backlog)

**Date:** 2026-08-30  
**Honesty:** No Product-Readiness `ga`, no COVERAGE **SHIPPED**, no Pilot-ready. New ACs are 🟡 **out of** Hotel/Clinic Scaffold BE rollups. Status vocabulary: `done` | `partial` | `deferred` | `blocked`.

## Process tracker

| Tracker | Status |
|---------|--------|
| Wave A (5 child todos) | completed |
| Wave B (6 child todos) | completed |
| Wave C (6 child todos) | completed |
| Wave D (4 child todos) | completed |
| Wave E (5 child todos) | completed |
| This report | completed |

## Scoreboard (1–47)

| # | Item | Status | Wave | Evidence |
|---|------|--------|------|----------|
| 1 | Four commercial PDF SKUs / sell versions | done | A (+D seed) | Hotel rate plans PKG-*; clinic `ProgramTemplate` seed; ADR dual-run |
| 2 | EW Rate Code is not medical SKU | done | A | `resolveMedicalSku` ignores `ratePlanCode`; tests |
| 3 | Composite room price (193+96, 180+160, …) | done | D | `composeNaftaPackageNightlySell` + `nafta-package-compose.spec.ts` |
| 4 | Package/nights change: hotel money, clinic quotas | done | B+D+polish | Mid-stay pax SKU + date → stamp/FO override + `syncComposedDailyRates` + stay-product; UAT §39.5 |
| 5 | Package field per pax | done | A | `ReservationGuest.medicalPackageCode` |
| 6 | Share two cards vs one card two pax | done | A+E+polish | Share = two reservations; one card two pax = Wave E; FO Guests Select + `E2E-MIX-289-SHARE-SMOKE.md` |
| 7 | Check-in `programCode` per guest | done | A+E | Per-pax `dispatchGuestCheckedIn` with pax code |
| 8 | Extra Req `ERA-PKG` cheatsheet | done | A | `era-hotel-pms/doc/nafta/ERA-PKG-FO-CHEATSHEET.md` |
| 9 | No 1./2. ordinals | done | A | Named `Name: CODE` parser; tests |
| 10 | Bridge parses Extra Req first | done | A | Bridge note upsert + stamp after notes |
| 11 | Import all note types | done | A | `reservation-notes` adapter EXTRA/RES/CIN/PRICE |
| 12 | Live-bridge notes upsert | done | A | `upsert-reservation.ts` note fields |
| 13 | Unstructured Extra/Res/CIn parser | done | A | Phrase path in resolver |
| 14 | Price Note as hint | done | A | After Extra in resolve order |
| 15 | Agency prefix → SKU all pax | done | A | `resolveAgencyPackageCode` + tests |
| 16 | Walkin medical / leisure not SKU | done | A | Leisure/medical without prefix → unresolved |
| 17 | Həmkarlar → STANDART + Extra override | done | A | Tests |
| 18 | Unresolved = queue, not silent Standart | done | A | `medicalPackageUnresolved`; omit programCode |
| 19 | Walk-in agency labels documented | done | A | Cheatsheet + ADR |
| 20 | Agency→SKU table (editable) | done | polish | `AgencyMedicalSkuRule` + `/settings/agency-medical-sku` CRUD; resolver DB then code defaults |
| 21 | Check-in always opens episode | done | A | Clinic `ensureEpisodeAndProgram` always `openEpisodeFromStay` |
| 22 | Walkin leisure not forced to medblock | done | polish | Hotel skips `dispatchGuestCheckedIn` when `stayKind: leisure`; ADR dual-run §6 |
| 23 | Unrecognized SKU: staff Select | done | A | `/sanatorium` FieldSelect 4 PKG-* |
| 24 | Assign/change program after arrival | done | A | complete-checkup Select |
| 25 | Checkup Select 4 SKUs | done | A | Replaced DETOX-7 free text |
| 26 | Walk-in same Select | done | A | Walk-in modal uses `naftaPackageTemplates` |
| 27 | Two programs on one reservation | done | E | Episode per `patientRefId`; per-pax events |
| 28 | `?episode=` opens treatment chart | done | A | Deep link `openChart` |
| 29 | PDF knot grid min/max + interpolate | done | B | `quotaFor` + seed knots |
| 30 | `quotaTotal = f(package, procedure, nights)` | done | B | Instantiate from knots |
| 31 | Extend/shorten nights recalc | done | B | Hotel date amend → `recalcProgramQuotas` |
| 32 | Standart→Premium: used vs new total, no SCHEDULED cancel | done | B | Lifecycle no longer cancels SCHEDULED |
| 33 | Template editor multi-procedure + knots | done | B+polish | Admin knots **matrix** UI (CatalogField + nights×qty); same PATCH API |
| 34 | PDF inclusions as quota rules not 0 AZN SKUs | done | B | Charge by quota remaining |
| 35 | One catalog code; free = remaining quota | done | B | `resolveProcedureCharge` in-quota → 0 |
| 36 | AFTER_CHECKUP in `/admin/settings` | done | C | Select + display row |
| 37 | Checkup → all PROPOSED not full matrix | done | C | Existing + exam-prefix sort |
| 38 | Confirm 2–3 day 1; no Confirm all | done | C | Confirm all removed; default select 3 |
| 39 | Package lines only by doctor confirm | done | C | Manual POST guard for in-quota codes |
| 40 | `PKG-NAFTA-INTAKE` not 5th sell SKU | done | A/B | Intake separate; exam knots qty=1 pattern |
| 41 | Doctor bonus COMPLETED % of amount | partial | D+polish | Base AZN + % columns; defaults **0** until FO sets in settings; punch checklist |
| 42 | In-quota package not in bonus | done | D | `bonusEligible` false when amountNet=0 |
| 43 | Extra / not-in-package in bonus | done | D | amountNet>0 → bonusEligible |
| 44 | Walk-in vs in-house bonus baskets | done | D | `grandTotalInHouse` / `grandTotalWalkIn` |
| 45 | Do not use amountNet=0 as only filter | done | D | Explicit `bonusEligible` flag |
| 46 | Codes `PKG-STANDART` etc. match | done | A | Canonical codes hotel+clinic |
| 47 | Do not enable ON_CHECKIN for Nafta | done | C | Default AFTER_CHECKUP; documented in UAT |

### Counts

| Status | Count |
|--------|------:|
| done | 46 |
| partial | 1 |
| deferred | 0 |
| blocked | 0 |

## Pilot polish

See [`reports/nafta-pkg-pilot-punch.md`](nafta-pkg-pilot-punch.md) — UAT §38–41 / CLI-50…54 open until FO/clinic sign. Sprint S-11…S-15 stay `[~]`.

## Acceptance IDs (all 🟡 / not SHIPPED)

- HOT-PKG-02/03/04 · CLI-50…54  
- AC-HOT-PKG-NAFTA, AC-HOT-PKG-COMPOSE  
- AC-CLI-SAN-PKG, AC-CLI-SAN-QUOTA, AC-CLI-SAN-DAY1, AC-CLI-BONUS, AC-CLI-SAN-PAX  

## Key artifacts

- ADRs: `nafta-medical-sku-dual-run`, `nafta-program-quota-knots`, FIFO amend, `nafta-compose-sell-and-doctor-bonus`, `nafta-episode-per-pax`
- Tests: `medical-package-resolve`, `reservation-notes-import-adapter`, `program-quota`, `nafta-package-compose`, `cli-san-negative` unknown template
- `npm run check:acceptance` PASS at closeout
