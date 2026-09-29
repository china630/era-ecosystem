# ADR: Floor attendance — live board, punches, breaks, employee requests

**Status:** Accepted (scope; not a delivery wave)  
**Date:** 2026-09-29  
**Updated:** 2026-09-29 (ZUP build/refuse list; Evrostar fitness files)  
**Amends:** [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md) wave 6 (geofence, phone, breaks, and the live board move from “never” to “later”; wave 6 itself stays tablet ingest)  
**Does not replace:** [cp-core-workforce-hub.md](./cp-core-workforce-hub.md), [cp-workforce-absence-split.md](./cp-workforce-absence-split.md), [workforce-external-payroll-and-1c-export.md](./workforce-external-payroll-and-1c-export.md)

## Context

Floor staff in Azerbaijan still prove the day with a paper journal or a Turkish-style PDKS (personel devam). A local product, [Cordinor](https://cordinor.com/) (operator Hasan Mahmudov, Narimanov, Baku), is that PDKS with an Azerbaijani UI. Its panel, punch-method codes (`KONUM_SECIM`, `MOBIL_QR`), timesheet codes (NM / FM / HT / RT / Yİ), and the default overtime rate **150%** are Turkish labor-law leftovers. Azerbaijan overtime is at least **double** the hourly rate (Labor Code of the Republic of Azerbaijan, art. 165). Their payroll screen is an empty sheet, not a statutory calculation.

ERA already has the accountant’s half and a thin punch pipe:

- CP month grid (`WORK / VACATION / SICK / OFF / BUSINESS_TRIP`), absence workflow for seven TK AZ kinds, approve locks the cell.
- Shift **plan** (places, cycles, brigades) does **not** paint the grid. `materialize-roster` is 410. Fact is manual, FaceID, or an approved absence. Plan vs fact is read-only.
- Wave 6 (`CP-WF-ATT-01`, **API**, not SHIPPED): vendor-agnostic tablet `POST /platform/v1/workforce/attendance/punches`, immutable raw events, IN→OUT pairing in Asia/Baku, rebuild into **DRAFT** only. Runbook: [evrostar-wave-6.md](../runbooks/evrostar-wave-6.md). Out of that wave: geofence, face templates stored in ERA, pay from a punch.

What is missing is the floor loop a supervisor opens in the morning: who is late, who never punched, which break is still open, which request is waiting.

1C:ZUP 8 PROF and CORP (edition 3.1) are the other reference. They are Russian statutory payroll (NDFL, insurance funds, T-13, military registration), not an Azerbaijan PDKS and not a phone clock. Boundary in [§ Boundary vs 1C](#boundary-vs-1c-zup-8-prof-and-corp).

## Decision

Seven floor capabilities. They sit on wave 6 punches and the existing timesheet. They do not become a second payroll and they do not copy Turkish codes or the 150% rate.

### 1. Live exception board

OrgOwner / department head opens **today in Asia/Baku**, not the month grid. Cards list named people: arrived, shift started with no IN, not arrived, still inside (no OUT), left early, late past the shift tolerance, open break, pending leave or hourly-leave request. Each card opens the underlying punch or request.

`/workspace/workforce/plan-fact` stays the month plan-vs-fact view. The board is operational, not a payroll report.

### 2. Punch from the phone and from the door

Keep the wave 6 device contract (`att_` token, optional HMAC, idempotent `externalId`, unmapped personRef does not write the grid).

Add, without a vendor FaceID SDK:

| Channel | Rule |
|---------|------|
| Door tablet / personal QR / NFC | Same ingest. Reader mode and operator mode are devices, not a new SoR. |
| Phone GPS | Place has a radius and an “allow outside” flag. A punch outside the radius is stored and flagged. It does not fill the timesheet until HR accepts it. |
| Entry window | Place or shift may reject or flag a punch outside the allowed clock window. |
| Face check | Matching stays on the device. ERA stores **no photo and no face template**. |
| Clock | `occurredAt` is interpreted in the org timezone (Asia/Baku). The phone clock is not the source of truth. GPS is read at punch time only — no background track. |

### 3. Break is its own IN/OUT

`ShiftType.break` remains the **planned** break length. A break the person actually took is a punch pair (`BREAK_START` / `BREAK_END`), duration computed, visible on the board while open. It is not a comment on the day cell.

### 4. Timesheet is filled from punches, priced by Azerbaijan law

Rebuild stays DRAFT-only and still skips `APPROVED` months, approved cells, and absence locks.

From pairs, the day carries **minutes**, not Turkish letter codes: normal, shortfall versus the shift, overtime, night, rest day, holiday, hourly leave. First IN and last OUT of the calendar day are the display pair (night OUT belongs to the IN date, as wave 6 already does).

Finance (`hr_full`) prices those minutes. Overtime is at least double (TK AR art. 165), not 150%. Weekend and holiday premiums stay Finance’s. CP does not compute gross, DSMF, or net.

The five cell types remain the approved attendance SoR. Punch-derived minutes are the fact underneath `WORK` (and hourly leave where the absence kind allows). The shift plan still does not overwrite fact.

### 5. Requests from the employee phone

The employee can submit, for their own employment only:

- full-day leave (existing CP absence kinds — no new kind catalog);
- hourly leave inside a shift;
- a late reason attached to a punch;
- an advance **request** (amount + note).

HR approves or rejects in the workspace. An approved full-day leave is the existing absence workflow. An approved advance does not pay anything on CP; Finance creates the payment when `hr_full` is on. No salary balance on the phone.

### 6. Announcements with read receipts

Org-scoped post. Each active employment has a read timestamp. This is not a messenger and not a satellite inbox.

### 7. Correction journal next to the punch

Raw punches stay immutable (wave 6). A correction is a new event: who, when, before/after, reason. Suspicious (outside radius, failed window, duplicate person at two places) is a queue, not a silent drop. Accepting a suspicious punch is the act that allows rebuild to use it.

`WorkforceAuditLog` continues to cover HR mutations. The punch journal is the attendance trail a supervisor reads beside the row. Do not merge it into satellite folio audit.

### 8. Finance prices Azerbaijan hours and a short list of pay documents

Minute buckets from decision 4 are the contract into Finance. Finance (`hr_full`) prices them under TK AR: overtime at least double (art. 165), night, rest day, holiday, sick pay that already uses seniority, unpaid time, hourly leave. CP still does not compute gross, DSMF, or net.

Add a pay document in Finance only when a real payroll run needs it: time off in lieu, alimony, employee loan, material assistance. An approved advance request (decision 5) is paid in Finance; it is not a second balance on CP. Do not open the ZUP payroll catalog (dividends, in-kind income, vacation reserves, delay compensation) until a customer run requires that document.

### 9. Thin employee cabinet

The phone surface is decisions 5 and 6 plus two reads, for the signed-in employment only:

- own MDM fields the org is already allowed to show (name, phone, citizenship — not another person’s file);
- own payslip for a closed month, when `hr_full` is on.

No certificate-request desk, no benefit cafeteria, no 2-NDFL.

### 10. Fitness files on the employment (Evrostar)

Evrostar (cleaning, chemicals, two VÖEN) requires three files on the person **at that employer** before the person can be assigned to a place. Two are statutory for this work, as the customer states. The third is their house rule.

| Kind | Why | Expiry |
|------|-----|--------|
| `HEALTH` | Health certificate. Statutory for this work. | `validUntil` required |
| `NARCOLOGY` | Narcological certificate. Statutory for this work. | `validUntil` required |
| `CRIMINAL_RECORD` | Criminal-record certificate. Evrostar house rule, not a statutory gate. | Issued date required. Freshness window is org policy (not hardcoded as law). |

Each row is employment-scoped (one org, one VÖEN): kind, issued date, valid until, file, who attached it, when. Status is `MISSING`, `PRESENT`, or `EXPIRED`. The file lives in org storage. It is not a column on MDM `PersonHrProfile`, not copied to the other VÖEN, not pushed to a satellite, not included in workforce CSV.

The org marks which kinds are required. Evrostar’s required set is all three. A missing or expired required kind:

- shows on the live board (decision 1);
- blocks a **new** shift assignment to a place;
- does not delete punches already stored and does not auto-terminate the employment.

The UI labels `CRIMINAL_RECORD` as the employer’s rule. It must not be captioned as a legal requirement. ERA does not decide the legal duty and does not read the medical content; it stores the file and the dates HR entered.

This is not the 1C OH&S module (special assessment, accident investigation, psychiatric-exam classifier, PPE norms). A later vertical may add a briefing log and PPE issue from inventory. Those are out until a customer pays for them. Headcount cost plans by project stay in Finance and are out until someone buys that book.

## Already in the product (do not rebuild)

| Piece | Where |
|-------|--------|
| Device, identity map, punch ingest, CSV import, DRAFT rebuild | Wave 6, `CP-WF-ATT-01` |
| Places, shift windows, planned break length | Evrostar wave 2 |
| Absence approve, month approve, Finance mirror | CP workforce hub + `hr_full` |
| Plan vs fact, roster does not paint cells | `materialize-roster` → 410 |

## Non-goals

- Turkish timesheet alphabet (NM, FM, EM, HT, RT, Yİ, Üİ, DZ, Sİ) and a 150% overtime constant.
- Payroll, payslip, IBAN, or “bordro” on CP. Export remains [workforce-external-payroll-and-1c-export.md](./workforce-external-payroll-and-1c-export.md) (CSV). Statutory calc stays Finance or the customer’s 1C.
- Storing a face photo or a 128-float template.
- Continuous location tracking.
- ZKTeco / Hikvision SDK, auto-approve of the month, pay calculated from a biometric event.
- Becoming 1C:ZUP. Refused from the CORP demo, not a later wave: recruitment, grades, KPI, 360, talent pool, LMS, benefit cafeteria, Russian NDFL / 2-NDFL / FSS / SFR / military commissariat / electronic labor book, special assessment of working conditions, accident-investigation package, psychiatric-exam classifier.
- Painting the timesheet from the shift plan.
- Treating the criminal-record file as a statutory requirement, or storing health / narcology / criminal-record files on the global person.

No COVERAGE row and no SHIPPED / Pilot claim from this ADR. A later wave updates `CP-WF-ATT-01` or adds rows when a UI path exists.

## Boundary vs 1C:ZUP 8 PROF and CORP

Both editions are **Russia**, configuration «Зарплата и управление персоналом», **3.1**. PROF and CORP share кадровый учёт, payroll, NDFL, contributions, regulated reports, and multi-org in one database. CORP adds the HR layer in the official description, chapter 1.1, plus management accounting (chapter 30). Official short diff: [solutions.1c.ru comparison](https://solutions.1c.ru/catalog/hrm/comparison). The comparison is platform-and-HR, not “CORP calculates salary and PROF does not”.

Time in both editions is **plan + deviations**, not a phone clock. Chapter 11: production calendar, schedules, night/evening, overtime document, holiday work, and a timesheet document only to correct what deviation documents cannot express. The printed form is T-13. CORP adds shift-level time (a night shift that crosses midnight can be split across pay codes) and an individual schedule. Neither edition is a geofenced QR/NFC clock. Turnstiles are an external SKUD feeding the timesheet.

Employee self-service (leave balance, leave and trip requests, payslip view, certificate requests) is **CORP**, including the hosted or on-prem service «1С:Кабинет сотрудника». That overlaps decision 5 only. It does not cover decisions 1–4, 6, or 7.

| | ERA after this ADR | ZUP PROF 3.1 | ZUP CORP 3.1 |
|--|--------------------|--------------|--------------|
| Law | Azerbaijan (DSMF, TK AR, Asia/Baku) | Russian Federation | Russian Federation |
| Fact of the day | Punches + approved absence → minutes → Finance prices | Schedule minus deviation documents; timesheet doc for leftovers | Same, plus shift splitting and individual schedules |
| Phone / geofence / QR | In scope here | No | No (cabinet is documents, not a clock) |
| Live “who is late” board | In scope here | Reports | Reports |
| Break punch | In scope here | Planned break kinds (including nursing breaks) | Same |
| Leave request by the employee | In scope here | HR enters documents | Cabinet |
| Grades, KPI, hiring, training, 360, talent pool, full OH&S, DMS | Out | Out | In (ch. 1.1) |
| Fitness files (health, narcology, criminal record) | In (decision 10, Evrostar) | No | Medical exams inside OH&S, not these three files |
| Statutory payroll | Finance `hr_full` or the customer’s own 1C via CSV | Full | Full, plus staged calc documents and some NDFL extras |

Use ZUP as the checklist of **deviation documents and hour kinds** Finance must be able to price (overtime, night, holiday, unpaid, downtime, hourly leave). Do not port its Russian reports or its CORP HR suite into the control plane.

### Where the full manuals are

The complete books are on 1C ITS (subscription). Public pages expose the contents, not the chapter text.

| Edition | Manual | What it is |
|---------|--------|------------|
| CORP 3.1 | [its.1c.ru/db/zupcorpdoc](https://its.1c.ru/db/zupcorpdoc) | «Описание» конфигурации. Fullest outline: intro, ch. 1 (HR extras + payroll core), ch. 2 settings, ch. 3–8 org / staffing / military / deductions / loans, ch. 9–11 absences and time, ch. 12–17 pay, ch. 18–19 NDFL and funds, later chapters through management accounting (ch. 30). |
| PROF (and the shared core) | [its.1c.ru/db/hrmdoc](https://its.1c.ru/db/hrmdoc) | «Зарплата и управление персоналом, редакция 3. Документация». Same payroll and time core. It does not contain CORP chapter 1.1 or chapter 30. |
| Both, one page | [solutions.1c.ru/catalog/hrm/comparison](https://solutions.1c.ru/catalog/hrm/comparison) | Vendor’s short Базовая / ПРОФ / КОРП comparison. |
| Product | [solutions.1c.ru/catalog/hrm](https://solutions.1c.ru/catalog/hrm) | Official catalog entry. Country: Russia. |

Partner write-ups (for example the 2025 PROF-vs-CORP tables) repeat chapter 1.1 in prose. They are not a substitute for the ITS description. A browser demo of CORP is published at `https://hrm.demo.1c.ru/corp/ru_RU/` (login as a listed user, no password).

## Consequences

- Next attendance wave extends punch direction and place policy. It does not reopen `materialize-roster`.
- Finance hour pricing must accept minute buckets (normal, overtime ≥ 2×, night, holiday, shortfall) instead of five day-types only, when this wave is built. Until then, wave 6 rebuild behavior stands.
- Employee phone, announcements, the live board, and fitness files are new surfaces (az + ru + en) and do not ship inside wave 6’s API claim.
- Finance grows pay documents from decision 8 only as a payroll run needs them. Fitness files do not post to the ledger.

## Related

- [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md)
- [evrostar-wave-6.md](../runbooks/evrostar-wave-6.md)
- [workforce-timesheet-construction-bridge.md](./workforce-timesheet-construction-bridge.md)
- [workforce-external-payroll-and-1c-export.md](./workforce-external-payroll-and-1c-export.md)
- [cp-workforce-absence-split.md](./cp-workforce-absence-split.md)
