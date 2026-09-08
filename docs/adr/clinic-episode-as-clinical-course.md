# ADR: Clinical episode as the unit of a care course

**Status:** Accepted (product canon) — **implemented SCREEN** (waves W1–W4). Not SHIPPED / not Pilot-ready.

**Date:** 2026-08-31

**Coverage:** CLI-55 (**SCREEN**) · AC-CLI-EPISODE 🟡 (out of Scaffold BE rollup until field UAT)

**Related:** [clinic-episode-care-team.md](./clinic-episode-care-team.md) (CLI-56 multi-doctor assign + clinical gate)

Related: [nafta-episode-per-pax.md](./nafta-episode-per-pax.md) · [clinic-patient-clinical-demographics.md](./clinic-patient-clinical-demographics.md) · [clinic-icd10-catalog.md](./clinic-icd10-catalog.md) · [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md) · [clinic-print-forms.md](./clinic-print-forms.md) · [sanatorium-vnext.md](./sanatorium-vnext.md) · [era-clinic/PRD.md](../../era-clinic/PRD.md)

---

## Context

`ClinicalEpisode` is already the sanatorium **course** (one stay / one walk-in registration): hotel check-in opens it; hotel checkout sets `CLOSED` and cancels leftover `SCHEDULED` / `CHECKED_IN` procedures (`hotel_checkout`). One reservation can have two OPEN episodes (one per pax) — [nafta-episode-per-pax.md](./nafta-episode-per-pax.md).

That is not enough to **read last year’s course** when the guest returns:

1. **Walk-in** (`patientOrigin=WALK_IN`) has **no close path**. The episode stays `OPEN` forever. There is no reception close action and no idle cron.
2. **History is not course-shaped.** Diagnoses and complaints are children of the episode. Procedures have no episode FK (`patientRefId` + optional `reservationId` only). Visits have no episode FK. `LabOrder.clinicalEpisodeId` is optional and often unset (`POST /api/lab-orders`). The patient card mixes all years; ICD on the card is **only the current OPEN** episode (`NO_OPEN_EPISODE` when none). `/sanatorium` lists OPEN only. Print checkup/procedures take the latest episode by `openedAt`, not a chosen course.
3. **Standing vs course facts are inverted.** `PatientRef.anamnesisText` is required to PATCH demographics. `PatientContraindication` is patient-wide; the planner blocks body parts from **all years**. A returning guest’s intake also treats prior-year visits/labs as “already done” (`hasAnyVisit` / lab fallback by patient).
4. PRD §1.3 still says “no full EMR”. That remains true: we do **not** ship a lifetime single chart. We **do** keep an archive of **courses**.

## Decision

### D1 — Episode = one care course

A `ClinicalEpisode` is one registration of care (hotel stay pax **or** walk-in on `/sanatorium`). A returning patient (same `PatientRef`) gets a **new** OPEN episode. The previous course stays `CLOSED` and is never merged.

Hotel IN_HOUSE uniqueness stays Wave E: partial unique `(organizationId, reservationId, patientRefId)` where `status=OPEN`.

Walk-in may have at most **one OPEN** episode per `patientRefId` (same org). Opening a second walk-in while one is OPEN is rejected until close (or the existing OPEN is reused — product default: **reject**, do not silently reuse a stale OPEN).

Outpatient Pattern B (`/appointments` with no sanatorium episode) may keep `clinicalEpisodeId` null. Sanatorium walk-in and in-house **must** attach clinical work to the OPEN episode. Inpatient ADT remains a separate encounter; optional `episodeId` only when the admission is during a sanatorium course (not required).

### D2 — What lives on the patient vs on the episode

**Patient (`PatientRef` + MDM) — identity, “eternal” ops cache:**

| Field | Notes |
|-------|--------|
| Full name, phone | Ops cache |
| Sex, birthDate → age | MDM SoR; clinic cache |
| Blood group | Care / emergency |
| Nationality, emergency contact | Ops cache |
| Identifiers | MDM (FIN / passport); not duplicated as SoR |
| `globalPersonId` | Link only |

**Episode — this course only (empty on a new stay unless the doctor enters them again):**

| Entity / field | Notes |
|----------------|--------|
| Anamnesis | `ClinicalEpisode.anamnesisText` (+ `anamnesisUpdatedAt`) |
| Contraindications | `PatientContraindication.episodeId` **required**; planner reads **this** episode |
| Complaints, ICD (`ClinicalDiagnosis`) | Already episode-scoped |
| Visits | `Visit.clinicalEpisodeId` required when created in a sanatorium course |
| Lab / diagnostic orders | `LabOrder.clinicalEpisodeId` required when an OPEN episode exists for the patient |
| Procedures | `ProcedureOrder.clinicalEpisodeId` required for sanatorium planner / confirm / manual assign |
| Program instance | Already `episodeId` unique |

Do **not** auto-copy last year’s anamnesis or contraindications into the new episode. An explicit “copy from previous course” control is optional later — not in this canon.

### D3 — Patient card UX

Header (always the person, independent of selected course): name, age, sex, blood group, identifiers, phone / emergency contact.

**Episode select** (all courses, OPEN and CLOSED), default = **latest** by `openedAt` (usually the current OPEN; if none, the most recent closed).

Selecting a course loads **that course’s** blocks, in this order:

1. Anamnesis (above the rest)
2. Contraindications
3. Complaints / ICD
4. Visits
5. Labs / diagnostics
6. Procedures / program

CLOSED course = **read-only** (including anamnesis and contraindications). Writes only against `status=OPEN`.

`/sanatorium` remains the **ops board of OPEN courses** only. Archive is the card (and print of a chosen episode). Print checkup and procedure schedule must take the **selected** episode id, not “latest `openedAt`”.

### D4 — Anamnesis gate (procedures)

Demographics PATCH **must not** require anamnesis (supersedes CLI-06 / `patientAnamnesisDenied` on clinical demographics).

While the OPEN episode has empty anamnesis, **block any procedure assignment or confirmation** (`409` `ANAMNESIS_REQUIRED`):

- `complete-checkup` / instantiate program
- `buildProposedPlan` (creating `PROPOSED`)
- `POST /api/procedures` (manual assign)
- `POST /api/procedures/confirm` (`placeConfirmedProcedures`)
- `bulk-cancel` replace that creates new orders

Hotel check-in still opens the episode and may instantiate **intake** (visits + ECG/USG). It **must not** build a physio FIFO / proposed plan until anamnesis is filled.

Labs, intake visits, and ICD/complaints are **not** blocked by empty anamnesis.

### D5 — Close rules

**IN_HOUSE (hotel):** unchanged. `SATELLITE_HOTEL_GUEST_CHECKED_OUT` closes every OPEN episode for that reservation and cancels leftover `SCHEDULED` / `CHECKED_IN` procedures (`hotel_checkout`). Early checkout is a hotel fact; clinic follows.

**WALK_IN:** never auto-close while the course is still running.

Refuse close (`409`) if any of:

- procedure in `PROPOSED` | `SCHEDULED` | `CHECKED_IN`
- lab in `ORDERED` | `COLLECTED` | `IN_PROGRESS`

Terminal procedure/lab statuses (`COMPLETED`, `PUBLISHED`, `CANCELLED`, `NO_SHOW`, …) do **not** block.

Close paths for walk-in (only when the gate is clear):

1. **Manual** — reception on `/sanatorium` (`POST …/episodes/:id?action=close`).
2. **Weekly cron** — `WALK_IN` + `OPEN` + idle (gate clear). Bearer `PLATFORM_CRON_SECRET`, same tenant loop as other clinic crons.

Walk-in close **must not** silently cancel leftover plan (unlike hotel checkout). If leftovers exist, close is refused.

### D6 — Create-path and idempotency

When an OPEN episode exists for the patient in a sanatorium flow, new `Visit`, `LabOrder`, and `ProcedureOrder` rows **must** set `clinicalEpisodeId`.

Intake “already exists” checks are **per episode**, not per patient lifetime (fix `hasAnyVisit` / lab-by-patient fallback).

`getEpisodeSchedule` and card plan/history for a selected course filter by that `clinicalEpisodeId`.

Cutover import already attaches history to an episode (OPEN or CLOSED archive). After this ADR, live ops must match that shape.

## As-is (do not treat as canon)

| Today | After this ADR |
|-------|----------------|
| Walk-in never closes | Manual + weekly cron; gate on live procedures **and** open labs |
| Anamnesis on `PatientRef`; required to save sex/blood | Anamnesis on episode; required to assign/confirm **procedures** |
| Contraindications patient-wide; planner uses all years | Per episode; new course starts with no blocked zones |
| Procedures / most visits / many labs not on episode | Children of the episode |
| Card ICD = OPEN only; no course switcher | Switcher; default latest; archive read-only |
| Print = latest episode by `openedAt` | Print = selected episode |

## Out of scope

- Lifetime single EMR / longitudinal problem list across courses (other than browsing archived episodes).
- Auto-inherit last year’s anamnesis or contraindications.
- Changing hotel checkout (force-close + cancel leftover slots).
- Requiring a `ClinicalEpisode` for every Pattern B outpatient appointment.
- Making inpatient ADT a child of the sanatorium episode by default.
- Implementation wave breakdown (separate plan).

## Consequences

- Schema: `anamnesisText` on `ClinicalEpisode`; `episodeId` on contraindications; `clinicalEpisodeId` on `ProcedureOrder` and `Visit`; tighten lab create to always set it when OPEN exists. Backfill existing rows onto the best-matching episode (cutover archive or latest course) in the same delivery, not as a silent null.
- Planner substitution uses the **open** (or selected, for display) episode’s contraindication set.
- CLI-06 anamnesis-on-demographics UAT/tests are **superseded** when CLI-55 ships; until then current SHIPPED behavior stays.
- Product edition remains `mvp`; this ADR is not GA / not Pilot-ready.

## Implementation waves

| Wave | Scope | Status |
|------|--------|--------|
| W1 | Schema FK + backfill + stamp on create + schedule-by-episode | Done |
| W2 | `ANAMNESIS_REQUIRED`, walk-in one OPEN, intake per-episode, planner CI scope, hotel FIFO skip without anamnesis | Done |
| W3 | Card episode selector, `?episode=` APIs/print, CLOSED read-only, i18n | Done |
| W4 | `closeWalkInEpisode`, reception Close, weekly cron | Done |
| W5 | Negatives + UAT-SMOKE + COVERAGE SCREEN + acceptance | Done |

## Related

- CLI-55 in `docs/COVERAGE_MATRIX.md` (**SCREEN**)
- `era-clinic/doc/UAT-SMOKE.md` § Episode as care course
- AC-CLI-EPISODE in Clinic Implementation-Matrix (🟡, out of BE rollup)
