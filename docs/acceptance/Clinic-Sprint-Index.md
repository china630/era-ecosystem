# Clinic — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Clinic-Product-Readiness-Matrix.md`](./Clinic-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Clinic-Implementation-Matrix.md`](./Clinic-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE ✅ · UI 🟡 · Sell: do not claim GA — fiscal/HL7 STUB; pilot open

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | ✅ | [ ] | reports/clinic-stage-W0-signoff.md scaffold-gate-pass; Green-BE wave 5 negatives |
| W1 honesty | gate[ ] | ✅ | [ ] | Close P0 residuals; UAT lab signoff |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-clinic-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-clinic/doc/UAT-SMOKE.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | SHARED clinic pool (`organizationId` + isolation) | [~] | AC-CLI-TENANT 🟡 — schema+filter on Nafta; live pool / field UAT open |
| S-5 | BE deepen → Scaffold ✅ (excl. TENANT) | [x] | IM + `__tests__/cli-*-negative.spec.ts` |
| S-6 | ICD-10 waves CLI-39…42 | [~] | ADR clinic-icd10-catalog; UAT-SMOKE ICD; `__tests__/icd10-catalog.spec.ts` |
| S-7 | Procedure TTK → Finance stock (CLI-47) | [~] | ADR clinic-procedure-consumable-ttk; W1 BOM+event API; Finance write-off W2 |
| S-8 | Physio S catalog (CLI-49) | [~] | W4 + Nafta card wave: Solyuks/`belinə`/`NAFTALAN_FILL`/empty-catalog; always rematch `#23`; UAT-SMOKE CLI-49 open |
| S-9 | Nafta card wave — intake + Baku slots (CLI-25/32/34/48) | [~] | `PKG-NAFTA-INTAKE` checklist/print/live instantiate; `#23` `parseBakuDateTime`; now/PLAN `gte now`; ops: seed catalogs → re-Apply `#23` (+ `#31` if USG). 2026-11-04 lab norms wave + second-pass do not move Gate/Pilot |
| S-10 | Catalog seed layers base + Nafta overlay | [~] | ADR clinic-catalog-base-and-org-overlay-seeds; `db:seed:physio` / `db:seed:diagnostic-catalog` = base then org overlay |
| S-11 | Nafta medical SKU dual-run assign (Wave A) | [~] | CLI-50 SCREEN; AC-CLI-SAN-PKG 🟡; `/sanatorium` Select 4 SKUs + `?episode=`; **pilot punch open** |
| S-12 | Nafta PDF quota knots (Wave B) | [~] | CLI-51 API; AC-CLI-SAN-QUOTA 🟡; knots **matrix** UI; UAT open |
| S-13 | Nafta doctor first-day confirm (Wave C) | [~] | CLI-52 SCREEN; AC-CLI-SAN-DAY1 🟡; no Confirm all; AFTER_CHECKUP settings |
| S-14 | Nafta doctor bonus extras (Wave D) | [~] | CLI-53 SCREEN; AC-CLI-BONUS 🟡; fulfillment view; prescriber stamp; % stay 0 until FO |
| S-20 | Clinic paid-fact revenue statement (CLI-63) | [~] | SCREEN `/reports/revenue`; AC-CLI-REV 🟡 out of BE; no fixed article list; UAT open — not Pilot |
| S-15 | Nafta one stay two episodes (Wave E) | [~] | CLI-54 SCREEN; AC-CLI-SAN-PAX 🟡; openEpisode per patient; shared surname does not merge; depart/move by stay id; stay reconcile 06:00/18:00 Asia/Baku opens a missing course and closes a checked-out or departed guest; `/sanatorium` 1-click select / 2-click open Guest deepen; **pilot punch open**. Gate/Pilot/edition unchanged |
| S-16 | Episode as care course (CLI-55) | [~] | SCREEN waves W1–W5; AC-CLI-EPISODE 🟡; UAT open — not Pilot |
| S-17 | Clinic RBAC Variant A + custom roles | [~] | AC-CLI-RBAC 🟡; `/admin/access` clone; system seed; UAT open — not Pilot |
| S-AUD | Mutation audit Layer A belt (ecosystem standard) | [~] | CLI-19 SHIPPED viewer; Wave B ClinicReceipt SETTLE/VOID + ClinicShift; Wave E compound `(organizationId, createdAt)` 2026-10-29; hash-chain deferred; HTTP_MUTATION UAT open; Gate/Pilot/edition unchanged |
| S-18 | Walk-in groups → hotel cashier basket (CLI-61) | [~] | SCREEN; AC-CLI-WALKIN-PARTY 🟡 out of BE; send stamps `revenueCode` (client required); UAT §11a open — not Pilot |
| S-19 | Open attendance + SAME_DAY check-in (CLI-62) | [~] | SCREEN; AC-CLI-OPEN-ATTEND 🟡 out of BE; OPEN codes share a day / same code once; OPEN unseated day-anchor out of restGap / overlap / compatibility (2026-11-02); Pay keeps pin; UAT §11b open — not Pilot |
| S-20 | CLI-26 matrix reception check-in + nurse unpaid Late | [x] | SHIPPED deepen; `receptionProcedureCheckIn` Nafta default on; 2026-11-02 day list + `/print/nurse-day` (no price, unpaid mark); AC-CLI-OPS stays ✅; Gate/Pilot/edition unchanged |
| S-21 | Package Saxla redispatch + home/reports polish | [~] | CLI-57/58 SCREEN deepen (same-block redispatch + modal №; Pay keeps OPEN pin; save-ask blue/gray; extra-tickets room/name + today-forward; print/card Baku dates; **2026-11-02** pinned bath day walks the day before the next-morning move; `seatMiss`; later Save uses remembered hour or current hour; package_assign audit startOn); CLI-13/17/29/42 SHIPPED deepen (arrival sort; range i18n); AC-CLI-ASSIGN stays 🟡; Gate/Pilot/edition unchanged |
| S-22 | Patient assignment ledger (CLI-64) | [~] | SCREEN `/reports/patient-assignments` + print RBAC; AC-CLI-ASSIGN-LEDGER 🟡 out of BE; UAT open — not Pilot; Gate/edition unchanged |
| S-24 | Working hours + peak journal (CLI-59) | [~] | `/admin/working-hours` Schedule / Day calendar / Peaks; Settings day chip links there; Saturday = short; procedure-day window on place/scan/matrix (no clinic-wide 22); outside slots darkened; appointments grid uses clinic days; calendar/peaks do not reseat. CLI-59 SCREEN; AC-CLI-SAN/MD unchanged; Gate/edition/sell unchanged. Needs migrate + image deploy |
| S-23e | Fizio + special pool script | [~] | Applied 2026-11-04 on clinic droplet after dump `/root/era-clinic-2026-11-04.sql.gz`. Premium/Derma `SVC_SPECIAL_POOL` folded into `SVC_FIZIO_POOL`, cap 10. Detoks cap only. Open courses: Derma 606/707 remain 64, Derma 901 used 42 remain 22, Premium 711 used 24 remain 24. AC-CLI-ASSIGN stays 🟡. Gate/edition/sell unchanged |
| S-23d | Blank Tarix + dash result | [~] | CLI-34 SHIPPED deepen. **2026-11-04** dash result skips norm and flag. **2026-11-05** lab/USM title is one **Tarix** (issue date); HBsAg, HCV/`Anti-HCV`, RPR `WEAK_POSITIVE` applied on the clinic droplet DB; those card rows also print a boxed PCR note under the table (az/ru/en, no parenthetical method names). **2026-11-05** a result that only repeats the catalog range prints as a dash with no norm (LYM# / MXD# / NEUT#). AC-CLI-PRINT ✅ unchanged; Gate/edition/sell unchanged. Range echo needs image deploy |
| S-23c | Guest blank after pay + reception day sheets | [~] | CLI-12 SCREEN. **2026-11-04** `guestBlankRelease=AFTER_PAYMENT` on the diagnostic service (lab works before pay, guest blank after pay, paid re-add reuses the order). Reception `/reception/nurse-sheets`. AC-CLI-LAB ✅ unchanged; Gate/edition/sell unchanged |
| S-23b | Lab open-duplicate + diagnostic lane | [~] | CLI-12 SCREEN. **2026-11-04** open same-code lab blocked per patient (lock inside the create transaction); unlinked ECG/US/endoscopy leave the analyses lane. `repairOpenLabDuplicates` not executed (no local clinic DB). AC-CLI-LAB ✅ unchanged; Gate/edition/sell unchanged |
| S-23 | Diagnostics package money + Extra tickets pay desk | [~] | CLI-12/57 SCREEN; **2026-11-05** extra-tickets scopes due/overdue/noshow/issued/all (period is kit `DatePicker`) (pay only due+overdue; due also lists today's already-paid rows in amber, with Appointment and Payment columns; mixed patient total is unpaid only); package amountNet 0; modal lane parity; package and study fulfillment scales on the İcra planı chip only; modality folders; procedure menu omits labs/visits; hidden LAB/VISIT burns via studyBalances; **2026-11-03** extra +/− stays draft until Saxla; Saxla drops unpaid extras from the latest day and repacks remaining OPEN `PENDING_PAY` from today; lab/USM print name is the result enterer; diagnostics modal catalog titles, payable total beside Save, `/print/studies` list (package and payable visits); yesterday start only when the course has no seated procedures, stored `COMPLETED`. **2026-11-02** auto LAB analyses+diagnostics `packageStamp` + study-line ensure + heal (assign GET + day-1 linkExisting; remaining quota); package-assign LAB `packageStamp`; Extra tickets hide CLOSED episodes; day-end/checkout/walk-in close cancel unpaid labs/visits; AC-CLI-LAB ✅ / AC-CLI-ASSIGN 🟡; UAT open; Gate/edition unchanged. **2026-11-05** catalog Active on service/modality cards; categories tab; package-only biochem is set in the DB; guest card now keeps the flag and the lab picker hides those rows (live image still lists them until this map deploys); an inactive category leaves pickers and keeps order titles. **2026-11-05** auto lab/visit books every active catalog member of the block, not the quota key; open droplet courses repaired (Premium USG quota 14); AC-CLI-ASSIGN stays 🟡; image not deployed. **2026-11-05** package biochem own blank is 30 days on Standart/Premium/Derma/Detoks/infect in the clinic DB; AC-CLI-LAB stays ✅; checkbox waits for the image. **2026-11-05** diagnostics assigned row matches the procedure row (trash on the title, extra price beside the stepper); image not deployed |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
