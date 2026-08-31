# Nafta cutover import

Operator format: `.xlsx`, row 1 = English headers. Idempotency key: `externalRef` (`wo:treatment:{id}`, `wo:patient:{id}`, `wo:res:{id}`, …).

JSON dumps under `D:\ERA-BACKUP\NAFTA-START` stay raw. Wizard books live in `D:\ERA-BACKUP\NAFTA-ERA-READY` (never nested inside START).

Build files:

```
node era-clinic/scripts/nafta-cutover/build-era-ready.cjs --domain=clinic
```

Full patient archive (all `bulk/patients.json`, no live filter):

```
NAFTA_PATIENTS_ALL=1 node era-clinic/scripts/nafta-cutover/build-era-ready.cjs --domain=clinic
```

Clinic pack checklist on disk: `NAFTA-ERA-READY/IMPORT-CHECKLIST.md` (mirror: `NAFTA-START/CHECKLIST.md` §B).

**Cutover:** `2026-08-25`.  
**WO dump refreshed:** `2026-08-30` — catalogs, calendar (`62166` slots, max `2026-09-10`), cards (`1722`), exam forms (`431` USG), lab-results (`2369` / `2200` Word), FO guest cards. `#26` = **historical COMPLETED** only (WO future stays off the matrix; remaining plan comes from `#23` templates after checkup). `#17` physio sites from seed JSON; `#23` program templates from PDF CSV `package_inclusion`.

## Post-deploy on droplet (after clinic image ship)

Do **not** run full `rebuild-derived` only for this wave. Seed catalogs, then re-Apply the Excel books below.

1. **Diagnostic catalog** (base + Nafta overlay → `PKG-NAFTA-INTAKE` + USG patches):

```bash
cd era-clinic && node prisma/seed-diagnostic-catalog.cjs
# or explicitly:
# node prisma/seed-diagnostic-catalog-base.cjs && node prisma/seed-diagnostic-catalog-nafta.cjs
```

2. **Physio S catalog** (base 31 S + Nafta WO aliases / type gates):

```bash
cd era-clinic && npx tsx prisma/seed-physio-catalog.ts
# or: npm run db:seed:physio:base && npm run db:seed:physio:nafta
```

3. **Verify:** `/admin/physio-sites` ≈ 31; `/admin/diagnostic-catalog` has `PKG-NAFTA-INTAKE`; `GET /api/physio-catalog` → non-empty `sites`.

4. **Re-Apply `#26` (slots)** — required. Rewrites `scheduledAt` with Baku `+04:00` and rematches `nahiye` → sites (`replaceSites: true` always). Without this, PLAN/növbəti keep old UTC offsets and empty chips.

5. **Re-Apply `#29` (USG diagnostics)** only if intake USM row is still MISSING or USG fields empty — after diagnostic seed. **Skip leftover diagnoses** (non-USG). **Do not Apply WO CheckUp `#33`/`#34`** for the check-in checklist (those are physio CheckUp / Darsonval).

6. **Spot checks:** Yağmur — Solyuks zones + two times; cards **2152** / **2019** — intake 4 rows; **2019** USM DONE/ORDERED after `#29`. Punch list: `doc/UAT-SMOKE.md` § Nafta cutover + CLI-49.

---

Rebuild USG only (`#29`), does **not** rewrite lab or hotel READY:

```
node era-clinic/scripts/nafta-cutover/rebuild-usg.cjs
```

Rebuild derived books (patients, quotas, slots, lab, USG) **without** overwriting curated #19/#20/#21/#22:

```bash
# Refresh WO dump first (hour X delta)
node era-clinic/scripts/refresh-webonly-clinic-catalogs.cjs
node era-clinic/scripts/dump-webonly-clinic-calendar.cjs --from 2026-02-01 --to 2026-09-20
node era-clinic/scripts/nafta-cutover/patch-procedures-ssot.cjs
node era-clinic/scripts/nafta-cutover/build-procedures-import.cjs
node era-clinic/scripts/nafta-cutover/rebuild-derived.cjs
node era-clinic/scripts/nafta-cutover/build-physio-sites-import.cjs
node era-clinic/scripts/nafta-cutover/build-program-templates-import.cjs
```

Practitioners (#22) from human roster SSOT:

```
node era-clinic/scripts/nafta-cutover/build-practitioners-import.cjs
```

Source: `NAFTA-START/clinic/reports/27-practitioners-roster.json` + FIN from the latest START HR workbook (`Əməkdaşların yenilənmiş siyahı…` / `02-Employees.xlsx`).

Full patient archive is default (`NAFTA_PATIENTS_ALL=0` to restore live filter).

Curated procedures pack (SSOT `NAFTA-START/clinic/reports/01-procedures.xlsx` — duration + `gap` as `resourceGapMinutes`):

```
node era-clinic/scripts/nafta-cutover/build-procedures-import.cjs
```

Writes `NAFTA-ERA-READY/clinic/19-Treatments.xlsx`, `20-Clinic-Rooms.xlsx`, `21-Procedure-Requirements.xlsx` (wizard entity `procedure-requirements`). Mirror + `manifest.json` under `NAFTA-START/clinic/reports/era-import/`.

## Clinic files (`NAFTA-ERA-READY/clinic/`) — numbers = READY pack-layout

| File | Rows (2026-08-28 dump) | START source | Columns |
|------|------------------:|----------------|---------|
| 24-Patients.xlsx | 1714 | dump `cards/{id}.json` `slices.patient` joined onto `bulk/patients.json` | externalRef, woId, fullName, givenName, surname, sex, birthDate, nationality, phone, hotelResNo, roomNumber, folioPerson, uniqueId, checkIn, checkOut, treatmentDaysCount, nightCount, isReservationPatient, doctorId, doctorName, doctorFormCreatedAt, checkUpId, checkUpName, programCode, latestPainDegree, latestPainDegreeCreatedAt |
| 26-Slots.xlsx / `clinic/26-Slots/26-Slots-p01.xlsx` … | ~60 480 COMPLETED | dump calendar | externalRef, date, startTime, patientRef, procedureCode, roomCode, status, nahiye. **Chunks of 5 000 rows in `clinic/26-Slots/`** — wizard `#26` is multi-file; do not POST the full book (FormData parse fails). Bake writes the folder automatically. |
| 27-Lab-Orders.xlsx | 2354 | dump lab-results + files/lab | externalRef, patientRef, testCode, status, panel, takenAt |
| 19-Treatments.xlsx | 80 | `01-procedures.xlsx` SSOT | externalRef, code, nameAz, durationMin, resourceGapMinutes, patientRestMinutes, price |
| 20-Clinic-Rooms.xlsx | 63 | SSOT + calendar history | externalRef, code, name |
| 21-Procedure-Requirements.xlsx | 126 | `01-procedures.xlsx` cabinets | procedureCode, resourceCode, role, quantity |
| 22-Doctors.xlsx | 8 | `27-practitioners-roster.json` + HR | externalRef, fin, fullName, role |
| 16-Diagnostic-Lab-Catalog.xlsx | TODO | seed + analyses map | externalRef, code, name, group |
| 29-Diagnostics.xlsx | 429 | dump exam forms (USG) | externalRef, patientRef, code (`USG-ABD` / `USG-THYROID` / `USG-BREAST` / `USG-DOPPLER` / `USG-SOFT`), name, resultText, resultJson, takenAt |
| 25-Quotas.xlsx | 9108 | derived from calendar | patientRef, procedureCode, quotaTotal, quotaUsed, quotaLeft |
| 28-Lab-Results.xlsx | 22620 | Word tables | orderRef, code, label, value, unit, refMin, refMax |
| `../hr/01-Org-Structure.xlsx` | START `hr/Ştat vahidləri Nafta 28.08.2026.xlsx` | orgUnit, position, totalSlots. Import **before** roster. |
| `../hr/02-Employees.xlsx` | START `hr/02-Employees.xlsx` (133; FİN + Cins K/Q + DOB + hire) | fin, fullName, sex, birthDate, orgUnit, position, hireDate, workplace, satellites. Rebuild: `node era-clinic/scripts/nafta-cutover/build-hr-roster.cjs` |

Episode `programCode` (list **Proqram / paket**): **not** WO Check-up name. Overlay from EW FO-with-Notes + long Notes `#12`: agency Premium/Dermo/Həmkarlar, **Extra Req `ERA-PKG` only**, phrases in Extra / Res / CIn / **Operator** / **Payment**, Price Note, **Walkin medical → PKG-STANDART**. Skip leisure and mix (two SKUs on one card). Həmkarlar FO slice from 1 June (including September `Reservation`) is merged so the 152 cards are not truncated to in-house. Join: name+date, ±1 day, unique last name, unique room+date.

```
node era-clinic/scripts/nafta-cutover/enrich-package-stamps.cjs         # rebuild stamps JSON
node era-clinic/scripts/nafta-cutover/stamp-clinic-program.cjs          # dry-run
node era-clinic/scripts/nafta-cutover/stamp-clinic-program.cjs --apply  # writes 24-Patients.xlsx
```

Then **Re-Apply wizard `#24`**. Rebuild/bake runs the overlay automatically. `rebuild-derived.cjs` also stamps before writing `#24`.

`#24` joins card `GET /api/Patient/{id}` onto list `get-all`. The list omits `gender`, `name`/`surname`, `folioPerson`, and often `reservationId`; those live on the card. `sex` is `MALE`/`FEMALE`/`UNKNOWN` from card `gender` (Female must not be treated as male — the substring `male` sits inside `female`). Extra columns stay on the book for ops/MDM; wizard persist: name, sex, birthDate, nationality, phone, hotelResNo, room, program, stay dates.

Episode status on `#24`: checkout **datetime already past** → `IMPORTED_CLOSED` + `closedAt` (archive; drops off live OPEN lists). Empty / future → `OPEN` (no `closedAt`). WO often sends date-only midnight — that means **end of that Baku calendar day** (in-house morning of checkout day stays OPEN). Live hotel checkout still writes `CLOSED`. Stay `checkIn`/`checkOut` keep clock time (`+04:00`). Not the same as procedure `IMPORTED_DONE` → `COMPLETED` + `importedHistorical`.

Attending doctor is **not** a field on `PatientRef`. Same as live ops: reception assigns the episode doctor via the **first Visit**. `#24` `doctorId` → `#22` `wo:doctor:{id}` → one idempotent Visit on check-in (`attending-visits` / `{patientRef}:attending`). OPEN → `IN_PROGRESS`; archive → `COMPLETED`. No Appointment (calendar stays clean). Empty/`0` doctorId or missing `#22` row → skip. Wizard already imports `#22` before `#24`.

MDM on `#24`: stamp FO `uniqueId` + `passport` via `apply-wo-fo-guest-bridge.cjs` (dump `GET https://nafta-frontoffice.webonly.io/api/GuestCard`). Import hotel `#10` first — FO-only cards are appended as `Guest Id=wo:fo:{id}` with passport filled. Then `linkPersonIdentity` with that passport/FIN so clinic and hotel share MDM. Name+DOB hotel lookup and `hotelResNo` stay remain fallbacks. Walk-ins without FO/EW get a surrogate. Anamnesis stamp is `Nafta cutover import`.

Lab fields: Word QAN/BİOKİM/SİDİK → ERA `LAB-CBC` / `LAB-BIOCHEM` / `LAB-URINE` + analyte aliases (`LYM%`→`LYMPH%`). Urine Word tables: join `w:t` runs without spaces, start at row `№=1`, drop `Tarix` / date grids (do not emit `U-DATE`). **Ignored:** orders without parseable Word (~170) — no #28 lines, still importable via #27 as header-only orders.

**Import hardening (required before re-Apply `#27`):** middleware must pass `/api/import` without cloning request headers (Cookie + multipart). `#27`/`#29` upserts run inside `prisma.$transaction`: `LabOrder.create` then top-level `LabOrderItem.create` (scalar `diagnosticServiceId`). Nested `items.create` is rejected — tenant stamp adds `organizationId` to a non-tenant model, and nested Prisma input wants `diagnosticService.connect`, not the FK.

Lab / USG list date: WO patients grid has no analysis column. `#27` `takenAt` is WO `LabResult.resultDate` (file date; present on the API even when the UI hides it). Empty `takenAt` → stay **check-in** (`ClinicalEpisode.openedAt` from `#24`). Import stamps `collectedAt` / `resultDate` / `createdAt` to that clinical day so `/lab-orders` “Tarix” is not the Apply timestamp. Date filters use `collectedAt` (fallback `createdAt`). Re-Apply `#27` (and `#29` for USG) after deploy to backfill already-imported rows.

`#29` diagnostics = WO **Müayinə Anketi** blocks (not ICD). Map **questionnaire name only** (do not sniff `Qeyd`): `USM` → `USG-ABD` (Nafta tam abdomen + pelvis fields), `Tiroid`/`Qalxanabənzər…` → `USG-THYROID`, `Süd vəzilərin us` → `USG-BREAST`, `dopler` → `USG-DOPPLER`, `səthi toxuma` → `USG-SOFT`. Parser fills organ fields into `resultJson`; raw `Qeyd` stays in `resultText` and is stored as `sourceNote` on Apply. Re-seed `node era-clinic/prisma/seed-diagnostic-catalog.cjs` so `USG-ABD` has kidney/pelvis + `sourceNote` fields (droplet stub `USG` / 0 fields cannot hold parsed lines). Then Apply `#29`. Do not Apply leftover diagnoses (non-USG notes).

**İlkin diaqnostik prosedurlar (check-in checklist)** is **not** WO CheckUp catalogs (`CheckUp/get-all` = physio «Check up starter» with Darsonval). Source = card `slices.diagnostics` / `GET /api/PatientDiagnostic/patient/{id}` group «İlkin diaqnostik prosedurlar (Check-up)» — four lines → package `PKG-NAFTA-INTAKE` (`SANATORIUM-INTAKE`, `GYN-OR-URO`, `ECG-12`, `USG-ABD`). Rebuild report only: `node era-clinic/scripts/nafta-cutover/rebuild-intake.cjs` (optional `--xlsx`). Apply `#29` closes the USM checklist row when `USG-ABD` exists. Episode `programCode` stays the physio/rate program — do not set it to the intake package name. Live open episode instantiates missing ECG/USG orders (idempotent **on that episode**; no physio FIFO). **CLI-55:** intake idempotency is per-episode (`clinicalEpisodeId` on Visit/LabOrder).

```
node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs
node era-clinic/scripts/nafta-cutover/rebuild-derived.cjs
```

Quota rule: do not burn twice. Historical COMPLETED / `IMPORTED_DONE` sets `importedHistorical` — no folio post, no nurse bonus. `#25` upserts `ProgramProcedureBalance` on the cutover episode’s `ProgramInstance` (`findUnique` by episode, tenant-scoped via `organizationId` + `episodeId`).

`#26` slots: **historical COMPLETED** only (`importedHistorical`). WO future appointments are **not** planted on the live matrix — remaining quota is `#25` (`quotaUsed` = completed count) and forward scheduling comes from `#23` templates after checkup. Adapter also closes a row if `scheduledAt < now`. Proof after 2026-08-31 bake: `#26` **60 480** COMPLETED = `#25` `quotaUsed` sum **60 480**; `quotaTotal` **61 649** so `quotaLeft` **1 169** = dropped WO SCHEDULED (not a second burn). New stays instantiate from `#23` knots, not from those leftover calendar times.

**Slot clock (Asia/Baku):** `#26` `date` + `startTime` are wall times in Baku. Import uses `parseBakuDateTime` → ISO with `+04:00` (not host/container local TZ). After deploy, **re-Apply `#26`** so existing `scheduledAt` instants are rewritten — otherwise PLAN can show 18:36 vs 10:36 depending on when the row was first imported. Re-Apply always rematches sites (`replaceSites: true`). Patient card «növbəti» and compact PLAN use `scheduledAt >= now` + server Baku labels (not browser `toLocaleString`).

### Curated procedure rules (SSOT)

- Elektroforez / Amplipuls: separate `#19` rows; `#21` LOCATION pool is cabinets **7, 8, 10–13** — **not Kabina 14**. FIFO (`placeConfirmedProcedures`) uses that whole pool for `2 li` (12/13 count as 2-pad). `4 lü` is **not** a second SKU — capability filter to **12 or 13 when free**; do not reserve those couches. Canon §9: BTL 4000 split 7∥8 and 10∥11; UNISTIM 5S on 12; BTL 4825S on 13.
- Kabina 14: in `#20` + historical `#26` only
- Vakumterapiya: Kabina 1 (cutover)
- Aplikasiya: WO alias → Naftalan vannası (no `#19` row)
- Future FIFO placement reads `#21` only (`placeConfirmedProcedures`). Electro: no hold of 12/13 for four-pad.

## Hour X punch list

1. Freeze WebOnly writes.
2. Lab files: `WO_COOKIE=… node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs` (gate ≥2000).
3. Build packs: `node era-clinic/scripts/nafta-cutover/build-era-ready.cjs --domain=clinic` (runs FO passport bridge if `hotel/dump/guest-cards.json` exists). Refresh FO cards: `WO_BEARER=… node era-hotel-pms/scripts/dump-webonly-fo-guest-cards.cjs`.
4. Staging: `node era-clinic/scripts/nafta-cutover/staging-gate.cjs`. Hotel wizard `#10`/`#11` first (EW + `wo:fo:*` guests → MDM). Empty clinic DB → wizard by pack-layout (`#16` … `#29`). Spot-check 3 in-house guests share `globalPersonId` with hotel + lab fields (WBC).
5. Hotel FO stays Elektraweb. Do not dual-run the WO calendar.
6. Super-admin “Muslim schedule” later must not reset `quotaUsed` / historical COMPLETED.

## Wizard phases

Admin → Cutover import (`/admin/import`). Clinic admin write.

1. Dictionaries: **16** catalog → **17** physio → **19** treatments → **20** rooms → **21** requirements → **23** templates. Do **not** Apply EW `Hizmet Tanımları` (old READY `#18`) — package quota procedures are not tariffed; do not clone 0 AZN extras.  
2. Staff: **22**  
3. Patients: **24** (after hotel `#10`/`#11`; FO `passport`/`uniqueId` → MDM; attending Visit from `#22`)  
4. Quotas + slots: **25** + **26** (select all files from `clinic/26-Slots/26-Slots-p01.xlsx` … in one step; wizard posts each chunk separately)  
5. Lab / USG: **27** → **28**, then **29** after diagnostic catalog seed. Do **not** Apply leftover diagnoses.

Re-upload of the same `externalRef` updates, does not duplicate. `#24` finds the latest episode **any** status (`openedAt` desc) and applies status / dates / room / reservation / program — re-upload `#24` only, no clinic DB wipe. Missing episode is created. Re-Apply `#26` / `#27` / `#29` also stamps `clinicalEpisodeId` on existing procedure/lab/USG rows (orphans from pre-CLI-55 Apply).

## Seed catalog vs WO cutover (master-data duplicates)

If `db:seed` (`SVC-*` / `CAB-*`) ran **before** wizard `#19`/`#20`, master-data shows two catalogs. Seed owns names and encoding. WO `#26` owns historical slot times (`scheduledAt`). Do **not** wipe slots.

1. Dry-run: `npx tsx scripts/nafta-cutover/merge-seed-wo-catalog.ts`
2. Apply: `npx tsx scripts/nafta-cutover/merge-seed-wo-catalog.ts --apply`
3. Check `/admin/master-data` — leftover `WO-TR-*` / `WO-ROOM-*` should be gone; unmatched names stay in the JSON report (do not delete those by hand until mapped).
4. Re-Apply `#26` after deploy so slot rows stamp `SVC-*` + seed cabinet resource (times stay). `#19` will not overwrite seed duration/name.

Unmatched WO treatments (no `SVC-*` name hit) are left in place. Add an alias in `src/lib/import/seed-catalog-match.ts` and re-run.

## Runbook (ops vs archive)

Hour X: upload `NAFTA-ERA-READY/hotel/*` in hotel wizard and `clinic/01–10` in clinic wizard. Rebuild after any START delta.

Patients `/patients`: filter hotel room (existing) + program/package (`programCode`) on OPEN episodes. Clinic-native **`P-######`** `refCode` (Tenant `nextPatientSeq`); WO `wo:patient:{id}` stays only in `CutoverImportKey`. After legacy import, remap: `npx tsx scripts/nafta-cutover/backfill-patient-ref-codes.ts` then `--apply`. USG protocols mistakenly stored as complaints: `npx tsx scripts/nafta-cutover/scrub-usg-complaints.ts` then `--apply`. Diagnoses leftover adapter no longer writes `rawText` into `ClinicalComplaint`.

Roster mapping lives in `scripts/nafta-cutover/map.cjs` (`mapRosterRow` / `mapOrgStructureRow`). Rebuild only HR books:

```
node era-clinic/scripts/nafta-cutover/build-era-ready.cjs --domain=hr
```

**Workforce import order (Orchestrator):** org-structure (`hr/01-Org-Structure.xlsx`) → roster (`hr/02-Employees.xlsx`). Empty `satellites` = MDM + employment, no login seat. Dual job = one FIN, two positions (`PRIMARY` / `ADDITIONAL`); one seat per person. Sex: `MALE` / `FEMALE` / `UNKNOWN` (HR `K`/`Q`). Re-import is idempotent: updates MDM sex/DOB (fill-not-clear) and `hireDate` on the existing employment; does not duplicate the same unit/position. Orchestrator accepts xlsx or CSV; READY dates are `YYYY-MM-DD` strings.

## Procedure site (`nahiye`) — wizard `#26` slots

WO free-text `nahiye` is **not** dropped on cutover. Canon: [physio-site-canon.md](./physio-site-canon.md) §6.

**Before Apply `#26` (required):** seed physio S catalog so chips are not dropped:

```bash
cd era-clinic && npx tsx prisma/seed-physio-catalog.ts
# base then Nafta overlay (same as npm run db:seed:physio)
```

Check: `/admin/physio-sites` ≈ 31 zones; `GET /api/physio-catalog` returns non-empty `sites`. Empty catalog → UI shows «catalog not seeded» (not SEARCHABLE «No matches»). Then **re-Apply `#26`** with `replaceSites: true` so `nahiye` is rematched against DB rows. Spot: Yağmur Cəfərli — naftalan `Tam` / Solyuks `Belinə`/`Başına` show chips; Qeyd keeps residue only.

Calendar dump has no `nahiye`. Join card `slices.procedures[].id` → slot `patientProcedureId`. Packer writes the string on `#26` (`HEADERS.slots` includes `nahiye`). Import copies it into `ProcedureOrder.note` (residue after match; doctor notes preserved) and runs the S matcher (`nahiye-cutover.service`). Unmatched / residue land in SatAdmin `/admin/physio-sites` → Unmatched. Coverage CLI (`nahiye-s-match.cjs`) stays the offline SoR; domain TS is golden-locked to it.

Coverage CSVs (re-run `scripts/nafta-cutover/nahiye-s-coverage.cjs`):

- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-s-unknown.csv` — no S
- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-s-partial.csv` — S + residue
- Excel A→Z + attending doctor: `nahiye-s-unknown.xlsx`, `nahiye-s-partial.xlsx`
- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-empty-by-treatment.csv`
