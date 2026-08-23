# Nafta cutover import

Operator format: `.xlsx`, row 1 = English headers. Idempotency key: `externalRef` (`wo:treatment:{id}`, `wo:patient:{id}`, `wo:res:{id}`, …).

JSON dumps under `D:\ERA-BACKUP\NAFTA-START` stay raw. The wizard only loads `era-ready\`.

Build files:

```
node era-clinic/scripts/nafta-cutover/build-era-ready.cjs
```

## Clinic files (`era-ready/clinic/`)

| File | Columns |
|------|---------|
| 01-procedures.xlsx | externalRef, code, nameAz, durationMin, resourceGapMinutes, patientRestMinutes, price |
| 02-rooms.xlsx | externalRef, code, name |
| 03-practitioners.xlsx | externalRef, fin, fullName, role |
| 04-patients.xlsx | externalRef, fullName, sex, birthDate, hotelResNo, roomNumber, checkIn, checkOut, programCode |
| 05-quotas.xlsx | patientRef, procedureCode, quotaTotal, quotaUsed, quotaLeft |
| 06-slots.xlsx | externalRef, date, startTime, patientRef, procedureCode, roomCode, status |
| 07-lab-catalog.xlsx | externalRef, code, name, group |
| 08-lab-orders.xlsx | externalRef, patientRef, testCode, status, resultText, takenAt, fileRel |
| 09-diagnostics.xlsx | externalRef, patientRef, code, name, resultText, takenAt |
| 10-diagnoses.xlsx | patientRef, rawText, icd10, recordedAt |
| `../hr/37-roster.xlsx` | fin, fullName, orgUnit, position, hireDate, satellites |

`fileRel` points at dump `files/lab/{id}_{fileName}`. Public WebOnly GET often returns JSON, not Word/PDF bytes — at Hour X copy binaries from the WO share if downloads fail. Do not parse Word CBC grids before go-live.

Quota rule: do not burn twice. COMPLETED slots count used **or** load `05-quotas` without past slots on the live board. Historical COMPLETED / `IMPORTED_DONE` sets `importedHistorical` — no folio post, no nurse bonus.

Ops slots: **24.08–31.08.2026** as SCHEDULED. Past dates COMPLETED (or aggregate in 05). Full calendar: `06-slots-archive.xlsx`.

## Hour X punch list

1. Freeze WebOnly writes.
2. Lab files: `node era-clinic/scripts/dump-webonly-patient-cards.cjs --with-files --skip-cards --skip-bulk`.
3. Build packs: `node era-clinic/scripts/nafta-cutover/build-era-ready.cjs`.
4. Wizard 01–07, then 05–06 (quotas + ops week). Then 08–10 after the board is stable.
5. Empty `icd10` skips ICD FK. Hotel FO stays Elektraweb. Do not dual-run the WO calendar.
6. Super-admin “Muslim schedule” later must not reset `quotaUsed` / historical COMPLETED.

## Wizard phases

Admin → Cutover import (`/admin/import`). Clinic admin write.

1. Dictionaries: 01–02  
2. Staff: 03  
3. Patients: 04 (no MDM required)  
4. Quotas + slots: 05–06  
5. Lab / USG / diagnoses: 07–10  

Re-upload of the same `externalRef` updates, does not duplicate.

## Runbook (ops vs archive)

Hour X:

1. Hotel `era-ready/hotel/*` ops extract (in-house + future 2026 + open folio).  
2. Clinic 01–06 ops week + 07 catalog.  
3. After stabilize: hotel `*-archive.xlsx`; clinic `06-slots-archive.xlsx`; 08–10.

Patients `/patients`: filter hotel room (existing) + program/package (`programCode`) on OPEN episodes.

Roster mapping (`Vəzifə` → satellites) lives in `scripts/nafta-cutover/roster-map.cjs`. Orchestrator workforce import accepts the same CSV columns; xlsx is converted to CSV in the API.
