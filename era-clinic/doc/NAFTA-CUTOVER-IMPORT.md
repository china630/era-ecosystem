# Nafta cutover import

Operator format: `.xlsx`, row 1 = English headers. Idempotency key: `externalRef` (`wo:treatment:{id}`, `wo:patient:{id}`, `wo:res:{id}`, …).

JSON dumps under `D:\ERA-BACKUP\NAFTA-START` stay raw. Wizard books live in `D:\ERA-BACKUP\NAFTA-ERA-READY` (never nested inside START).

Build files:

```
node era-clinic/scripts/nafta-cutover/build-era-ready.cjs
```

Full patient archive (all `bulk/patients.json`, no live filter):

```
NAFTA_PATIENTS_ALL=1 node era-clinic/scripts/nafta-cutover/build-era-ready.cjs
```

Clinic pack checklist on disk: `NAFTA-ERA-READY/IMPORT-CHECKLIST.md` (mirror: `NAFTA-START/CHECKLIST.md` §B).

**Cutover:** `2026-08-25` · **Ops slots (#23):** `2026-08-25` … `2026-08-30` (WO data 25–29 Aug only).

## Post-deploy on droplet (after clinic image ship)

Do **not** run full `rebuild-derived` only for this wave. Seed catalogs, then re-Apply the Excel books below.

1. **Diagnostic catalog** (intake package + USG fields):

```bash
cd era-clinic && node prisma/seed-diagnostic-catalog.cjs
```

2. **Physio S catalog** (~31 zones + type gates, Solyuks / `NAFTALAN_FILL`):

```bash
cd era-clinic && npx tsx prisma/seed-physio-catalog.ts
```

3. **Verify:** `/admin/physio-sites` ≈ 31; `/admin/diagnostic-catalog` has `PKG-NAFTA-INTAKE`; `GET /api/physio-catalog` → non-empty `sites`.

4. **Re-Apply `#23` (slots)** — required. Rewrites `scheduledAt` with Baku `+04:00` and rematches `nahiye` → sites (`replaceSites: true` always). Without this, PLAN/növbəti keep old UTC offsets and empty chips.

5. **Re-Apply `#31` (USG diagnostics)** only if intake USM row is still MISSING or USG fields empty — after diagnostic seed. **Skip `#32`** (non-USG leftovers). **Do not Apply `#33`/`#34`** for the check-in checklist (those are physio CheckUp / Darsonval).

6. **Spot checks:** Yağmur — Solyuks zones + two times; cards **2152** / **2019** — intake 4 rows; **2019** USM DONE/ORDERED after `#31`. Punch list: `doc/UAT-SMOKE.md` § Nafta cutover + CLI-49.

---

Rebuild USG only (`#31` + empty `#32`), does **not** rewrite lab or hotel READY:

```
node era-clinic/scripts/nafta-cutover/rebuild-usg.cjs
```

Rebuild derived books (patients, quotas, slots, lab, USG, diagnoses) **without** overwriting curated #25/#26/#27/#40:

```bash
# Refresh WO dump first (hour X delta)
node era-clinic/scripts/refresh-webonly-clinic-catalogs.cjs
node era-clinic/scripts/dump-webonly-clinic-calendar.cjs --from 2026-02-01 --to 2026-09-05
node era-clinic/scripts/nafta-cutover/patch-procedures-ssot.cjs
node era-clinic/scripts/nafta-cutover/build-procedures-import.cjs
node era-clinic/scripts/nafta-cutover/rebuild-derived.cjs
```

Practitioners (#27) from human roster SSOT:

```
node era-clinic/scripts/nafta-cutover/build-practitioners-import.cjs
```

Source: `NAFTA-START/clinic/reports/27-practitioners-roster.json` + FIN from the latest START HR workbook (`Əməkdaşların yenilənmiş siyahı…` / `37-Employees.xlsx`).

Full patient archive is default (`NAFTA_PATIENTS_ALL=0` to restore live filter).

Curated procedures pack (SSOT `NAFTA-START/clinic/reports/01-procedures.xlsx` — duration + `gap` as `resourceGapMinutes`):

```
node era-clinic/scripts/nafta-cutover/build-procedures-import.cjs
```

Writes `NAFTA-ERA-READY/clinic/25-Treatments.xlsx`, `26-Rooms.xlsx`, `40-Procedure-Requirements.xlsx` (wizard entity `procedure-requirements`). Mirror + `manifest.json` under `NAFTA-START/clinic/reports/era-import/`.

## Clinic files (`NAFTA-ERA-READY/clinic/`) — same numbers as START checklist

| File | Rows (2026-08-28 dump) | START source | Columns |
|------|------------------:|----------------|---------|
| 21-patients.xlsx | 1714 | dump `cards/{id}.json` `slices.patient` joined onto `bulk/patients.json` | externalRef, woId, fullName, givenName, surname, sex, birthDate, nationality, phone, hotelResNo, roomNumber, folioPerson, uniqueId, checkIn, checkOut, treatmentDaysCount, nightCount, isReservationPatient, doctorId, doctorName, doctorFormCreatedAt, checkUpId, checkUpName, programCode, latestPainDegree, latestPainDegreeCreatedAt |
| 23-slots.xlsx | 2802 | dump calendar | externalRef, date, startTime, patientRef, procedureCode, roomCode, status |
| 24-lab-orders.xlsx | 2354 | dump lab-results + files/lab | externalRef, patientRef, testCode, status, panel, takenAt |
| 25-Treatments.xlsx | 80 | `01-procedures.xlsx` SSOT | externalRef, code, nameAz, durationMin, resourceGapMinutes, patientRestMinutes, price |
| 26-Rooms.xlsx | 63 | SSOT + calendar history | externalRef, code, name |
| 40-Procedure-Requirements.xlsx | 126 | `01-procedures.xlsx` cabinets | procedureCode, resourceCode, role, quantity |
| 27-Doctors.xlsx | 8 | `27-practitioners-roster.json` + HR | externalRef, fin, fullName, role |
| 29-Analyses.xlsx | 58 | catalogs/29 + ERA panel codes | externalRef, code, name, group |
| 31-Diagnostics.xlsx | 429 | dump exam forms (USG) | externalRef, patientRef, code (`USG-ABD` / `USG-THYROID` / `USG-BREAST` / `USG-DOPPLER` / `USG-SOFT`), name, resultText, resultJson, takenAt |
| 32-Diagnoses.xlsx | 0 | leftover non-USG exam notes only (ICD empty). Skip Apply. | patientRef, rawText, icd10, recordedAt |
| 38-quotas.xlsx | 9108 | derived from calendar | patientRef, procedureCode, quotaTotal, quotaUsed, quotaLeft |
| 39-lab-results.xlsx | 22620 | Word tables | orderRef, code, label, value, unit, refMin, refMax |
| 28, 30 | — | **Dropped** from ERA-READY (WO reference only; no wizard entity) |
| 33–36 | copy catalogs | as in START |
| `../hr/37-Employees.xlsx` | START `hr/37-Employees.xlsx` (133; FİN + Cins K/Q + DOB + hire) | fin, fullName, sex, birthDate, orgUnit, position, hireDate, workplace, satellites. Dates are calendar strings `YYYY-MM-DD` (Excel serials + `DD.MM.YYYY` converted; empty only `NAN`/`0`). Do not write Date cells/`cellDates` — SheetJS emits `…T04:00:00.000Z`. Empty `satellites` = employment, no login seat. `workplace` `ADDITIONAL` = second job, no seat. Rebuild: `node era-clinic/scripts/nafta-cutover/build-hr-roster.cjs` |
| `../hr/org-structure.xlsx` | START `hr/Ştat vahidləri Nafta 28.08.2026.xlsx` | orgUnit, position, totalSlots. Import **before** roster. Upsert by name; does not delete extra units. |
| `../hotel/01–20` | hotel/01–20 | EW wizard |
| `../1c/40–53` | 1c | as received |

`#21` joins card `GET /api/Patient/{id}` onto list `get-all`. The list omits `gender`, `name`/`surname`, `folioPerson`, and often `reservationId`; those live on the card. `sex` is `MALE`/`FEMALE`/`UNKNOWN` from card `gender` (Female must not be treated as male — the substring `male` sits inside `female`). Extra columns stay on the book for ops/MDM; wizard persist: name, sex, birthDate, nationality, phone, hotelResNo, room, program, stay dates.

Episode status on `#21` (Asia/Baku calendar day): `checkOut` **before today** → `IMPORTED_CLOSED` + `closedAt` (archive; drops off live OPEN lists). Empty / today / future → `OPEN` (no `closedAt`). Live hotel checkout still writes `CLOSED`. Not the same as procedure `IMPORTED_DONE` → `COMPLETED` + `importedHistorical`.

Attending doctor is **not** a field on `PatientRef`. Same as live ops: reception assigns the episode doctor via the **first Visit**. `#21` `doctorId` → `#27` `wo:doctor:{id}` → one idempotent Visit on check-in (`attending-visits` / `{patientRef}:attending`). OPEN → `IN_PROGRESS`; archive → `COMPLETED`. No Appointment (calendar stays clean). Empty/`0` doctorId or missing `#27` row → skip. Wizard already imports `#27` before `#21`.

MDM on `#21`: stamp FO `uniqueId` + `passport` via `apply-wo-fo-guest-bridge.cjs` (dump `GET https://nafta-frontoffice.webonly.io/api/GuestCard`). Import hotel `#10` first — FO-only cards are appended as `Guest Id=wo:fo:{id}` with passport filled. Then `linkPersonIdentity` with that passport/FIN so clinic and hotel share MDM. Name+DOB hotel lookup and `hotelResNo` stay remain fallbacks. Walk-ins without FO/EW get a surrogate. Anamnesis stamp is `Nafta cutover import`.

Lab fields: Word QAN/BİOKİM/SİDİK → ERA `LAB-CBC` / `LAB-BIOCHEM` / `LAB-URINE` + analyte aliases (`LYM%`→`LYMPH%`). **Ignored:** orders without parseable Word (~170) — no #39 lines, still importable via #24 as header-only orders.

Lab / USG list date: WO patients grid has no analysis column. `#24` `takenAt` is WO `LabResult.resultDate` (file date; present on the API even when the UI hides it). Empty `takenAt` → stay **check-in** (`ClinicalEpisode.openedAt` from `#21`). Import stamps `collectedAt` / `resultDate` / `createdAt` to that clinical day so `/lab-orders` “Tarix” is not the Apply timestamp. Date filters use `collectedAt` (fallback `createdAt`). Re-Apply `#24` (and `#31` for USG) after deploy to backfill already-imported rows.

`#31` diagnostics = WO **Müayinə Anketi** blocks (not ICD). Map **questionnaire name only** (do not sniff `Qeyd`): `USM` → `USG-ABD` (Nafta tam abdomen + pelvis fields), `Tiroid`/`Qalxanabənzər…` → `USG-THYROID`, `Süd vəzilərin us` → `USG-BREAST`, `dopler` → `USG-DOPPLER`, `səthi toxuma` → `USG-SOFT`. Parser fills organ fields into `resultJson`; raw `Qeyd` stays in `resultText` and is stored as `sourceNote` on Apply. Re-seed `node era-clinic/prisma/seed-diagnostic-catalog.cjs` so `USG-ABD` has kidney/pelvis + `sourceNote` fields (droplet stub `USG` / 0 fields cannot hold parsed lines). Then Apply `#31`. **Do not Apply `#32`** — leftover non-USG notes only (usually 0 rows).

**İlkin diaqnostik prosedurlar (check-in checklist)** is **not** `#33`/`#34` (`CheckUp/get-all` = physio «Check up starter» with Darsonval). Source = card `slices.diagnostics` / `GET /api/PatientDiagnostic/patient/{id}` group «İlkin diaqnostik prosedurlar (Check-up)» — four lines → package `PKG-NAFTA-INTAKE` (`SANATORIUM-INTAKE`, `GYN-OR-URO`, `ECG-12`, `USG-ABD`). Rebuild report only: `node era-clinic/scripts/nafta-cutover/rebuild-intake.cjs` (optional `--xlsx`). Apply `#31` closes the USM checklist row when `USG-ABD` exists. Episode `programCode` stays the physio/rate program — do not set it to the intake package name. Live open episode instantiates missing ECG/USG orders (idempotent; no physio FIFO).

```
node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs
node era-clinic/scripts/nafta-cutover/rebuild-derived.cjs
```

Quota rule: do not burn twice. Historical COMPLETED / `IMPORTED_DONE` sets `importedHistorical` — no folio post, no nurse bonus. `#38` upserts `ProgramProcedureBalance` on the cutover episode’s `ProgramInstance` (`findUnique` by episode, tenant-scoped via `organizationId` + `episodeId`).

Ops slots in `#23`: **2026-08-25 … 2026-08-30** window; WO SCHEDULED data **25–29 Aug** (2373 rows). Pre-cutover → COMPLETED.

**Slot clock (Asia/Baku):** `#23` `date` + `startTime` are wall times in Baku. Import uses `parseBakuDateTime` → ISO with `+04:00` (not host/container local TZ). After deploy, **re-Apply `#23`** so existing `scheduledAt` instants are rewritten — otherwise PLAN can show 18:36 vs 10:36 depending on when the row was first imported. Re-Apply always rematches sites (`replaceSites: true`). Patient card «növbəti» and compact PLAN use `scheduledAt >= now` + server Baku labels (not browser `toLocaleString`).

### Curated procedure rules (SSOT)

- Elektroforez / Amplipuls: separate `#25` rows; `#40` LOCATION pool is cabinets **7, 8, 10–13** — **not Kabina 14**. FIFO (`placeConfirmedProcedures`) uses that whole pool for `2 li` (12/13 count as 2-pad). `4 lü` is **not** a second SKU — capability filter to **12 or 13 when free**; do not reserve those couches. Canon §9: BTL 4000 split 7∥8 and 10∥11; UNISTIM 5S on 12; BTL 4825S on 13.
- Kabina 14: in `#26` + historical `#23` only
- Vakumterapiya: Kabina 1 (cutover)
- Aplikasiya: WO alias → Naftalan vannası (no `#25` row)
- Future FIFO placement reads `#40` only (`placeConfirmedProcedures`). Electro: no hold of 12/13 for four-pad.

## Hour X punch list

1. Freeze WebOnly writes.
2. Lab files: `WO_COOKIE=… node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs` (gate ≥2000).
3. Build packs: `node era-clinic/scripts/nafta-cutover/build-era-ready.cjs` (runs FO passport bridge if `hotel/dump/guest-cards.json` exists). Refresh FO cards: `WO_BEARER=… node era-hotel-pms/scripts/dump-webonly-fo-guest-cards.cjs`.
4. Staging: `node era-clinic/scripts/nafta-cutover/staging-gate.cjs`. Hotel wizard `#10`/`#11` first (EW + `wo:fo:*` guests → MDM). Empty clinic DB → wizard by entity (25 … 40 procedure-requirements … 39 lab-results). Spot-check 3 in-house guests share `globalPersonId` with hotel + lab fields (WBC).
5. Hotel FO stays Elektraweb. Do not dual-run the WO calendar.
6. Super-admin “Muslim schedule” later must not reset `quotaUsed` / historical COMPLETED.

## Wizard phases

Admin → Cutover import (`/admin/import`). Clinic admin write.

1. Dictionaries: 25 → 26 → **40** (procedure → room requirements)  
2. Staff: 27  
3. Patients: 21 (after hotel `#10`/`#11`; FO `passport`/`uniqueId` → MDM; attending Visit from `#27`)  
4. Quotas + slots: 38 + 23  
5. Lab / USG: **29 → 24 → 39**, then **31** after diagnostic catalog seed. Skip **32**. 

Re-upload of the same `externalRef` updates, does not duplicate. `#21` finds the latest episode **any** status (`openedAt` desc) and applies status / dates / room / reservation / program — re-upload `#21` only, no clinic DB wipe. Missing episode is created.

## Runbook (ops vs archive)

Hour X: upload `NAFTA-ERA-READY/hotel/*` in hotel wizard and `clinic/01–10` in clinic wizard. Rebuild after any START delta.

Patients `/patients`: filter hotel room (existing) + program/package (`programCode`) on OPEN episodes.

Roster mapping lives in `scripts/nafta-cutover/map.cjs` (`mapRosterRow` / `mapOrgStructureRow`). Rebuild only HR books (do **not** run full `build-era-ready.cjs` for a HR refresh — it wipes hotel READY):

```
node era-clinic/scripts/nafta-cutover/build-hr-roster.cjs
```

**Workforce import order (Orchestrator):** org-structure (`hr/org-structure.xlsx`) → roster (`hr/37-Employees.xlsx`). Empty `satellites` = MDM + employment, no login seat. Dual job = one FIN, two positions (`PRIMARY` / `ADDITIONAL`); one seat per person. Sex: `MALE` / `FEMALE` / `UNKNOWN` (HR `K`/`Q`). Re-import is idempotent: updates MDM sex/DOB (fill-not-clear) and `hireDate` on the existing employment; does not duplicate the same unit/position. Orchestrator accepts xlsx or CSV; READY dates are `YYYY-MM-DD` strings.

## Procedure site (`nahiye`) — wizard `#23` slots

WO free-text `nahiye` is **not** dropped on cutover. Canon: [physio-site-canon.md](./physio-site-canon.md) §6.

**Before Apply `#23` (required):** seed physio S catalog so chips are not dropped:

```bash
cd era-clinic && npx tsx prisma/seed-physio-catalog.ts
```

Check: `/admin/physio-sites` ≈ 31 zones; `GET /api/physio-catalog` returns non-empty `sites`. Empty catalog → UI shows «catalog not seeded» (not SEARCHABLE «No matches»). Then **re-Apply `#23`** with `replaceSites: true` so `nahiye` is rematched against DB rows. Spot: Yağmur Cəfərli — naftalan `Tam` / Solyuks `Belinə`/`Başına` show chips; Qeyd keeps residue only.

Calendar dump has no `nahiye`. Join card `slices.procedures[].id` → slot `patientProcedureId`. Packer writes the string on `#23` (`HEADERS.slots` includes `nahiye`). Import copies it into `ProcedureOrder.note` (residue after match; doctor notes preserved) and runs the S matcher (`nahiye-cutover.service`). Unmatched / residue land in SatAdmin `/admin/physio-sites` → Unmatched. Coverage CLI (`nahiye-s-match.cjs`) stays the offline SoR; domain TS is golden-locked to it.

Coverage CSVs (re-run `scripts/nafta-cutover/nahiye-s-coverage.cjs`):

- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-s-unknown.csv` — no S
- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-s-partial.csv` — S + residue
- Excel A→Z + attending doctor: `nahiye-s-unknown.xlsx`, `nahiye-s-partial.xlsx`
- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-empty-by-treatment.csv`
