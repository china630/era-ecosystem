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

Source: `NAFTA-START/clinic/reports/27-practitioners-roster.json` + FIN from `hr/37-Employees.xlsx`.

Full patient archive is default (`NAFTA_PATIENTS_ALL=0` to restore live filter).

Curated procedures pack (SSOT `NAFTA-START/clinic/reports/01-procedures.xlsx` — duration + `gap` as `resourceGapMinutes`):

```
node era-clinic/scripts/nafta-cutover/build-procedures-import.cjs
```

Writes `NAFTA-ERA-READY/clinic/25-Treatments.xlsx`, `26-Rooms.xlsx`, `40-Procedure-Requirements.xlsx` (wizard entity `procedure-requirements`). Mirror + `manifest.json` under `NAFTA-START/clinic/reports/era-import/`.

## Clinic files (`NAFTA-ERA-READY/clinic/`) — same numbers as START checklist

| File | Rows (2026-08-25) | START source | Columns |
|------|------------------:|----------------|---------|
| 21-patients.xlsx | 1665 | dump cards/patients | externalRef, fullName, sex, birthDate, hotelResNo, roomNumber, checkIn, checkOut, programCode |
| 23-slots.xlsx | 2373 | dump calendar | externalRef, date, startTime, patientRef, procedureCode, roomCode, status |
| 24-lab-orders.xlsx | 2153 | dump lab-results + files/lab | externalRef, patientRef, testCode, status, panel, takenAt |
| 25-Treatments.xlsx | 80 | `01-procedures.xlsx` SSOT | externalRef, code, nameAz, durationMin, resourceGapMinutes, patientRestMinutes, price |
| 26-Rooms.xlsx | 63 | SSOT + calendar history | externalRef, code, name |
| 40-Procedure-Requirements.xlsx | 126 | `01-procedures.xlsx` cabinets | procedureCode, resourceCode, role, quantity |
| 27-Doctors.xlsx | 8 | `27-practitioners-roster.json` + HR | externalRef, fin, fullName, role |
| 29-Analyses.xlsx | 58 | catalogs/29 + ERA panel codes | externalRef, code, name, group |
| 31-Diagnostics.xlsx | 370 | dump exam forms (USG) | externalRef, patientRef, code, name, resultText, takenAt |
| 32-Diagnoses.xlsx | 372 | dump exam forms | patientRef, rawText, icd10, recordedAt |
| 38-quotas.xlsx | 8778 | derived from calendar | patientRef, procedureCode, quotaTotal, quotaUsed, quotaLeft |
| 39-lab-results.xlsx | 22620 | Word tables | orderRef, code, label, value, unit, refMin, refMax |
| 28, 30 | — | **Dropped** from ERA-READY (WO reference only; no wizard entity) |
| 33–36 | copy catalogs | as in START |
| `../hr/hr-01-Employees.xlsx` | START `hr/37-Employees.xlsx` | fin, fullName, orgUnit, position, hireDate, satellites |
| `../hotel/01–20` | hotel/01–20 | EW wizard |
| `../1c/40–53` | 1c | as received |

Lab fields: Word QAN/BİOKİM/SİDİK → ERA `LAB-CBC` / `LAB-BIOCHEM` / `LAB-URINE` + analyte aliases (`LYM%`→`LYMPH%`). **Ignored:** orders without parseable Word (~170) — no #39 lines, still importable via #24 as header-only orders.

```
node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs
node era-clinic/scripts/nafta-cutover/rebuild-derived.cjs
```

Quota rule: do not burn twice. Historical COMPLETED / `IMPORTED_DONE` sets `importedHistorical` — no folio post, no nurse bonus.

Ops slots in `#23`: **2026-08-25 … 2026-08-30** window; WO SCHEDULED data **25–29 Aug** (2373 rows). Pre-cutover → COMPLETED.

### Curated procedure rules (SSOT)

- Elektroforez / Amplipuls: separate `#25` rows; `#40` LOCATION pool is cabinets **7, 8, 10–13** — **not Kabina 14**. FIFO (`placeConfirmedProcedures`) uses that whole pool for `2 li` (12/13 count as 2-pad). `4 lü` is **not** a second SKU — capability filter to **12 or 13 when free**; do not reserve those couches. Canon §9: BTL 4000 split 7∥8 and 10∥11; UNISTIM 5S on 12; BTL 4825S on 13.
- Kabina 14: in `#26` + historical `#23` only
- Vakumterapiya: Kabina 1 (cutover)
- Aplikasiya: WO alias → Naftalan vannası (no `#25` row)
- Future FIFO placement reads `#40` only (`placeConfirmedProcedures`). Electro: no hold of 12/13 for four-pad.

## Hour X punch list

1. Freeze WebOnly writes.
2. Lab files: `WO_COOKIE=… node era-clinic/scripts/nafta-cutover/fetch-lab-files.cjs` (gate ≥2000).
3. Build packs: `node era-clinic/scripts/nafta-cutover/build-era-ready.cjs`.
4. Staging: `node era-clinic/scripts/nafta-cutover/staging-gate.cjs`. Empty clinic DB → wizard by entity (25 … 40 procedure-requirements … 39 lab-results). Spot-check 3 in-house guests + lab fields (WBC).
5. Hotel FO stays Elektraweb. Do not dual-run the WO calendar.
6. Super-admin “Muslim schedule” later must not reset `quotaUsed` / historical COMPLETED.

## Wizard phases

Admin → Cutover import (`/admin/import`). Clinic admin write.

1. Dictionaries: 25 → 26 → **40** (procedure → room requirements)  
2. Staff: 27  
3. Patients: 21  
4. Quotas + slots: 38 + 23  
5. Lab / USG / diagnoses: 29, 24, 39, 31, 32  

Re-upload of the same `externalRef` updates, does not duplicate.

## Runbook (ops vs archive)

Hour X: upload `NAFTA-ERA-READY/hotel/*` in hotel wizard and `clinic/01–10` in clinic wizard. Rebuild after any START delta.

Patients `/patients`: filter hotel room (existing) + program/package (`programCode`) on OPEN episodes.

Roster mapping (`Vəzifə` → satellites) lives in `scripts/nafta-cutover/roster-map.cjs`. Orchestrator workforce import accepts the same CSV columns; xlsx is converted to CSV in the API.

## Procedure site (`nahiye`) — wizard `#23` slots

WO free-text `nahiye` is **not** dropped on cutover. Canon: [physio-site-canon.md](./physio-site-canon.md) §6.

Calendar dump has no `nahiye`. Join card `slices.procedures[].id` → slot `patientProcedureId`. Packer writes the string on `#23` (`HEADERS.slots` includes `nahiye`). Import copies it into `ProcedureOrder.note` and runs the S matcher (`nahiye-cutover.service`). **Do not wipe `note`.** Unmatched / residue land in SatAdmin `/admin/physio-sites` → Unmatched. Coverage CLI (`nahiye-s-match.cjs`) stays the offline SoR; domain TS is golden-locked to it.

Coverage CSVs (re-run `scripts/nafta-cutover/nahiye-s-coverage.cjs`):

- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-s-unknown.csv` — no S
- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-s-partial.csv` — S + residue
- Excel A→Z + attending doctor: `nahiye-s-unknown.xlsx`, `nahiye-s-partial.xlsx`
- `D:\ERA-BACKUP\NAFTA-START\clinic\reports\nahiye-empty-by-treatment.csv`
