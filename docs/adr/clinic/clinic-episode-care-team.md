# ADR: Episode care team (multi-doctor assignment)

**Status:** Accepted — implementing **SCREEN** (CLI-56)

**Date:** 2026-09-02

**Coverage:** CLI-56 · extends CLI-55 / CLI-RBAC data-scope

Related: [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) · [clinic-domain-permissions-and-rbac.md](./clinic-domain-permissions-and-rbac.md) · [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md) · [clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md) (CLI-57 package/extras assign on card — PLANNED)

---

## Context

DOCTOR defaults have **no** `scope:episodes.all`: `/sanatorium` lists only episodes “assigned” via visit / `prescribedBy` / procedure allocation. Reception had **no** UI to attach a doctor to a sanatorium course. Intake auto-stamped visits onto the first `DOCTOR` by `code`, which is not an explicit care-team choice.

Product flow agreed:

1. Reception finds/creates patient and OPEN course.
2. Opens card from `/sanatorium` — **identity + package + care-team list** only.
3. Adds one or more doctors (`+ Doctor`: therapist, gyn, uro, …) → Save.
4. Only then: those doctors see the course under assigned-only scope, and clinical blocks (anamnesis, CI, complaints/ICD, plan, confirm) unlock.
5. Later: link care team / first exam to `/appointments` (out of this ADR’s ship slice).

---

## Decision

### D1 — Care team is a first-class episode child

Table `EpisodeCareDoctor`:

| Column | Notes |
|--------|--------|
| `episodeId` | FK `ClinicalEpisode` |
| `practitionerId` | FK `Practitioner` (`staffKind=DOCTOR`, active) |
| `assignedAt` / `assignedByUserId` | Audit |
| unique `(episodeId, practitionerId)` | No duplicate rows |

Many doctors per course. Order = `assignedAt` asc (first = typically therapist).

### D2 — Data scope

`episodeAssignedToPractitionerWhere` is **care-team only**:

```text
careDoctors: { some: { practitionerId } }
```

Visit / prescribe / allocation OR-arms were removed for sanatorium assigned scope so a doctor not on the care team cannot see the course via old Visit rows.

### D3 — Gate clinical work

Code `CARE_TEAM_REQUIRED` (409) when care team is empty for:

- anamnesis PATCH, complaints/diagnoses writes, complete-checkup / program instantiate, procedure assign/confirm.

Care-team POST/DELETE itself is **not** gated on an existing member (reception must seed the team). First assign requires a role with `scope:episodes.all` (RECEPTION / admin) or platform bypass — assigned-only doctors cannot see an empty team episode.

On OPEN courses, DELETE of the last care doctor returns `LAST_CARE_DOCTOR` (409).

### D3b — Day-1 package open (ops amendment 2026-09-02)

When OPEN episode has **anamnesis AND ≥1 complaint AND ≥1 ICD-10** (all required):

1. If `programCode` is set and no `ProgramInstance` yet → **auto-instantiate** package as `PROPOSED` (`tryOpenProgramAfterTherapistStage`) and stamp `checkupCompletedAt`.
2. The intake checklist is not this gate. After the first care-team doctor it lists auto analyses and auto diagnostics from the current template (`AUTO_ON_OPEN` / `AUTO_DAY1` that book a lab order, including ECG/USG). It does not paint a fixed Nafta four-slot list and does not wait for the package snapshot.

Concurrent twin open attempts → `ALREADY_OPEN` (unique on episode / P2002). Missing `programCode` → `NO_PROGRAM_CODE` (card toast).

Manual Complete checkup remains available as a fallback / re-entry with the same AND gate (anamnesis + complaint + ICD-10).

### D4 — Card UX

On OPEN episode, before care team has ≥1 member, card shows only:

1. Patient identity (header)
2. Episode selector + package/room summary
3. Care team editor (`+ Doctor` / remove)

After ≥1 doctor: existing CLI-55 blocks (anamnesis → CI → complaints/ICD → clinical sections). Chart Complete checkup on `/sanatorium` uses the same day-1 gate — not “complaint OR ICD”.

CLOSED episode: care team read-only.

### D5 — Intake visits / package auto-apply

`instantiateIntakePackage` must **not** invent a default “first doctor by code”. Prefer a care-team member as `Visit.practitionerId`; if care team empty, skip creating intake visits until a doctor is assigned. Episode open does **not** call it: without a `ProgramInstance` no ECG/USG orders are created.

**Amended 2026-11-02:** Auto labs, imaging, and visits are created in one place, `applyPackageAutoBlocks`, and only after `ProgramInstance` exists. `instantiateProgramFromTemplate` calls it with `CARE_TEAM` as soon as the course is saved. Episode open does not call it: there is no course yet, so the old `OPEN` hook only returned `NO_PROGRAM`. If the care team is empty, visits stay `PENDING_DOCTOR` and labs are still created. Assigning the first doctor retries `CARE_TEAM` and logs a failure instead of discarding it. Opening the package still requires anamnesis, one complaint, and one ICD-10. `linkExistingAutoOrdersToPackage` only stamps orders that already exist. `MANUAL_RETRY` (patient-card «recalculate this course») refreshes quotas and creates the same missing auto blocks.

### D6 — Appointments (deferred design)

Not wired yet. Intended later: reception books appointment with a doctor → appointment auto-links to the episode → doctor check-in starts episode life. Until then `/appointments` stays Pattern B ambulatory SoT; sanatorium ops start from `/sanatorium` + care team.

Assigned DOCTOR needs `api:patients` to open the card from sanatorium; list/get are scoped to patients with that doctor on care team.

---

## Consequences

- Honest assigned-only RBAC for sanatorium (care-team membership only).
- Reception owns initial routing; doctors can `+ Doctor` peers (gyn/uro) once on the team.
- Confirm (`/api/procedures/confirm`) requires the doctor on care team when scope is ASSIGNED (not only anamnesis in the planner).

## Out of scope

- Auto-suggest specialty from intake package lines.
- Patient-facing portal care team.
- Splitting `checkupCompletedAt` into doctor-exam vs labs/USG/ECG milestones (field name currently means therapist stage done).

## Data cutover

WO `#24` `doctorId` → attending Visit (`attending-visits`) → `EpisodeCareDoctor` via Prisma migration `20260902150000_backfill_care_team_from_wo_attending` (and optional script `scripts/nafta-cutover/backfill-care-team-from-wo-attending.ts`). Re-import `#24` also upserts care team in `ensureCutoverAttendingVisit`.
