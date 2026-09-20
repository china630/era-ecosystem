# ADR: Clinic staff kind + monthly duty roster (CLI-38)

## Status

Accepted — 2026-08-17  
**Amended — 2026-09-03** (dual table views; head-doctor day substitution; no silent auto-fallback)  
**CLI-38b SHIPPED — 2026-09-03** (`StaffDutyDayOverride`; dual Procedures|Nurses UI; planner order override → posted → no silent pool)

Related: [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) · [clinic-practitioner-shifts.md](./clinic-practitioner-shifts.md) · [clinic-procedure-day-ops.md](./clinic-procedure-day-ops.md) · capability **CLI-38** / **CLI-38b** in [`docs/COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

Screen: `/sanatorium/nurse-roster` · API: `/api/sanatorium/nurse-roster`, `/api/sanatorium/nurse-roster/day-overrides`, `/api/sanatorium/staff-absences`

---

## Context

Nafta posts a paper form *«Tibb bacılarının fizioterapevtik aparatarda işləmə qrafiki»*: at the start of each month the head doctor assigns nurses to physiotherapy devices. One nurse may cover several devices; some assignments stay stable; vacations and other absences must be visible. Laboratory staff is a third class, not a doctor and not a procedure nurse.

Product workshop (2026-09):

- True **many-to-many** on the monthly matrix is **not** required for the process (one responsible nurse per procedure/device).
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

**`Practitioner.staffKind`** = `DOCTOR | NURSE | LAB`.

- Hire from CP Workforce maps `satelliteRole` (`LAB_TECH` → `LAB`). SatAdmin may correct kind.
- Appointment day matrix lists **doctors only**.
- Duty roster page toggles **Nurses / Lab** on the same screen (`staffKind` on the roster).

### 2. Monthly matrix cardinality (not M:N)

**`StaffDutyRoster` + `StaffDutyLine`** — one draft or approved matrix per org / `YYYY-MM` / staff kind.

| Rule | Meaning |
|------|---------|
| Axis of truth | Rows = **procedure types** (devices / SVC-*); cell = **at most one** `practitionerId` |
| Uniqueness | `@@unique([rosterId, procedureTypeId])` — one responsible per procedure per month |
| Nurse covers many devices | Allowed: same `practitionerId` on many lines (1 nurse → N procedures) |
| Many nurses on one device | **Forbidden** on the monthly matrix (paper 1:1; confirmed 2026-09) |

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
| Planner prefers APPROVED posted nurse | **SHIPPED** |
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
