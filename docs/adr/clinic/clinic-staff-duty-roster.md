# ADR: Clinic staff kind + monthly duty roster (CLI-38)

## Status

Accepted — 2026-08-17  
**Amended — 2026-09-03** (dual table views; head-doctor day substitution; no silent auto-fallback)  
**Amended — 2026-10-07** (several people per procedure; staff kinds BATH and MASSAGE on the procedure chart)  
**CLI-38b SHIPPED — 2026-09-03** (`StaffDutyDayOverride`; dual Procedures|Nurses UI; planner order override → posted → no silent pool)

Related: [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) · [clinic-practitioner-shifts.md](./clinic-practitioner-shifts.md) · [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · capability **CLI-38** / **CLI-38b** in [`docs/COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

Screen: `/sanatorium/nurse-roster` · API: `/api/sanatorium/nurse-roster`, `/api/sanatorium/nurse-roster/day-overrides`, `/api/sanatorium/staff-absences`

---

## Context

Nafta posts a paper form *«Tibb bacılarının fizioterapevtik aparatarda işləmə qrafiki»*: at the start of each month the head doctor assigns nurses to physiotherapy devices. One nurse may cover several devices; some assignments stay stable; vacations and other absences must be visible. Laboratory staff is a third class, not a doctor and not a procedure nurse.

Product workshop (2026-09):

- One procedure may list several people (one SKU, several cabins). HARD still keeps one person off two overlapping slots.
- Operators still want a **nurse-centric table** (nurse → assigned procedures), not only procedure → nurse.
- **Day substitutions** when the posted nurse is away are decided **only by the head doctor** — not by an automatic “any skilled free nurse” picker.

The satellite already had:

- one `Practitioner` list (no doctor / nurse / lab split) → now `staffKind`;
- `PractitionerSkill` = lasting capability;
- CLI-36 shifts = *when* a person works;
- CLI-31 `ProcedureRotationRule` = *patient* treatment rotation (naftalan → iod-brom), not staff posting.

None of those is the monthly duty matrix or an explicit day substitution ledger.

---

## Decision

### 1. Staff kind

**`Practitioner.staffKind`** = `DOCTOR | NURSE | LAB | BATH | MASSAGE`.

Bath attendants and massage therapists are their own kinds. The procedure duty chart lists doctors, nurses, bath attendants, and massage therapists together. The lab chart stays lab-only. A role in `/admin/access` stores the same kind; creating the role does not invent the kind.

- Hire from CP Workforce maps `satelliteRole` (`LAB_TECH` → `LAB`). SatAdmin may correct kind.
- Appointment day matrix lists **doctors only**.
- Duty roster page toggles **Nurses / Lab** on the same screen (`staffKind` on the roster).

### 2. Monthly matrix cardinality

**`StaffDutyRoster` + `StaffDutyLine`** — one draft or approved matrix per org / `YYYY-MM` / staff kind.

| Rule | Meaning |
|------|---------|
| Axis of truth | Rows = **procedure types** (SVC-*); a procedure may list **several** people |
| Uniqueness | `@@unique([rosterId, procedureTypeId, practitionerId])` — one row per person per procedure per month |
| One person, many procedures | Allowed |
| Several people, one procedure | Allowed. One SKU can have several cabins, so the month can post several people. HARD still stops one person covering two overlapping slots; the planner takes the next posted person. |

`stable` copies the line into the next month’s draft. Opening a new month seeds from the previous month.

**Not** a join table of arbitrary (nurse × procedure) pairs for co-responsibility. That would be true M:N and is explicitly rejected for the monthly process.

### 3. Screen — dual table views (CLI-38b UI)

Screen: `/sanatorium/nurse-roster` (permission `screen:sanatorium.nurse_roster` — DOCTOR + SatAdmin; head-doctor ops, not a catalog). Link from `/admin/master-data`.

**One source of truth** (`StaffDutyLine`); **two layouts**, both real tables (no card-only boards):

| View | Rows | Assignment control |
|------|------|--------------------|
| **By procedure** (shipped baseline) | Procedure type | Select one nurse (or unassigned) |
| **By nurse** | Each nurse/lab tech in the roster staff pool | Multi-select / chips of procedure types this person owns this month |

Toggle on the toolbar: `Procedures | Nurses` (i18n). Editing either view writes the same lines (assigning procedures to a nurse clears/reassigns those procedure rows’ `practitionerId`).

Absence warnings and `stable` remain visible in both views.

### 4. Absences (overlay)

**`StaffAbsence`** (vacation / sick / training / other) is clinic-local. CLI-36 `DAY_OFF` exceptions also warn on the matrix.

Finance HR vacation sync remains **out of band** until a later wave.

Absences **do not** by themselves choose a replacement nurse.

### 5. Day substitution — head doctor only (CLI-38b)

When the posted nurse cannot work a given calendar day (Asia/Baku), the **head doctor explicitly assigns a substitute** for that procedure (or set of procedures) on that date.

#### Target model

**`StaffDutyDayOverride`:**

| Field | Role |
|-------|------|
| `organizationId` | Tenant |
| `rosterId` or (`yearMonth` + `staffKind`) | Month context |
| `dutyDate` | Date in Asia/Baku (store UTC midnight of that civil day) |
| `procedureTypeId` | Which device/procedure |
| `practitionerId` | Substitute nurse/lab tech (required) |
| `reason` / `note` | Optional |
| `createdByUserId` | Audit |
| Uniqueness | Prefer `@@unique([organizationId, dutyDate, procedureTypeId, staffKind])` — one substitute per procedure per day |

API:

- `GET/PUT/DELETE` under `/api/sanatorium/nurse-roster/day-overrides`, gated by `api:sanatorium.nurse_roster`.
- List by `yearMonth` + optional `dutyDate`; roster GET also returns `dayOverrides[]`.

UI:

- Toolbar toggle **Procedures | Nurses**.
- From **by-nurse** view: substitute CTA for owned procedures.
- From **by-procedure** view: action “Substitute for date…” on a row; list/delete overrides per procedure.

#### Planner resolution order

For STAFF allocation on a procedure slot on civil day `D`:

1. If a **day override** exists for `(D, procedureType)` → use that practitioner (if free + skill rules below).
2. Else if month roster is **APPROVED** and a **posted** nurse exists and is **not** absent on `D` → use posted.
3. Else if posted is absent (or unassigned) and **no** override → **do not** auto-pick another skilled nurse. Surface as unallocated / warning / block per scheduling mode — head doctor must create an override (or change the monthly post).
4. Draft / missing roster: skilled pool for placement **without** claiming a named duty post — never as substitution for an absent posted nurse on an **APPROVED** roster.

Approving the **nurse** month (or saving an already approved nurse month) reassigns **STAFF** on `SCHEDULED` orders whose start is still in the future and inside that month. The lab roster does not move those rows. Cabin and time stay. A day override wins over the monthly post. An absent posted nurse is not assigned. When the procedure is `HARD` and that nurse already occupies an overlapping slot, the later slot is left without a nurse. `CHECKED_IN`, `COMPLETED`, and past slots stay as they were.

Skills: UI warns if override (or post) lacks `PractitionerSkill` for the procedure; override allowed with warning (same as monthly post).

### 6. AuthZ

- Read/write roster, absences, day overrides: `api:sanatorium.nurse_roster` / `screen:sanatorium.nurse_roster`.
- Same actors as today: head-doctor style DOCTOR role + SatAdmin; not reception by default.

---

## Explicitly out of scope

| Item | Notes |
|------|--------|
| True M:N monthly cells (several nurses co-responsible for one procedure) | Rejected for Nafta process (2026-09) |
| Silent auto-fallback to any skilled nurse when posted is absent | **Superseded** — head doctor day override only (CLI-38b) |
| Finance HR approved vacation import | Later |
| Applying CLI-36 shift grids onto the sanatorium resource matrix | Still open elsewhere |
| Separate lab-analyzer board | Same monthly matrix with `staffKind=LAB` |
| Nurse self-service substitution | Not allowed — head doctor chooses |

---

## Shipped vs planned

| Piece | Status |
|-------|--------|
| `staffKind`, monthly roster CRUD, approve, copy previous, absences, by-procedure table | **SHIPPED** (CLI-38) |
| Planner prefers APPROVED posted nurse; approve reassigns future SCHEDULED staff | **SHIPPED** |
| Dual view (by nurse table) | **SHIPPED** (CLI-38b) |
| `StaffDutyDayOverride` + UI + planner order (override → posted → no silent pool) | **SHIPPED** (CLI-38b) |
| Silent skilled-pool fallback when posted absent | **REMOVED** (CLI-38b) |

---

## Consequences

- Head doctor owns **month** (approve) and **day** (override) staffing truth.
- Dual views improve ops (“who covers what” vs “what does this nurse run”) without changing cardinality.
- FIFO placement and `/nurse?mine=1` follow day override, then posted nurse; they must not invent a substitute.
- Skills remain capability checks; duty remains posting; CLI-36 remains hours/exceptions.
- Login role `LAB_TECH` stays wired; lab-orders nav includes it.

---

## Migration notes (CLI-38b) — done

1. `StaffDutyDayOverride` + `/api/sanatorium/nurse-roster/day-overrides` + audit.
2. `resolveDutyCandidates` / `resolvePostedStaffForSlot` / `applyDutyFilter` — override → posted → empty on APPROVED gap; unit tests cover negative path.
3. Nurse-roster UI: Procedures|Nurses toggle + substitute modal.
4. `era-clinic/doc/UAT-SMOKE.md` step 12 updated for CLI-38b.
5. COVERAGE_MATRIX CLI-38b → SHIPPED.
