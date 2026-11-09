# ADR: Hotel department duty schedules + type catalog

- **Status:** Accepted (implementing)
- **Date:** 2026-11-05
- **Products:** `era-hotel-pms` (reception / security / engineering), `era-fnb-pos` (WEEK_PERSON cədvəl), catalog names clinic `MONTH_DUTY` without executing it
- **Related:** [hotel-housekeeping-nafta-ops.md](./hotel-housekeeping-nafta-ops.md) · [clinic-staff-duty-roster.md](./clinic-staff-duty-roster.md) · [cp-workforce-org-units.md](./cp-workforce-org-units.md) · [fnb-buffet-cost-attribution.md](./fnb-buffet-cost-attribution.md)

## Context

Hotel departments need weekly duty boards (reception, security, technical). Housekeeping already has `HkRosterWeek` / `HkRosterCell`. Clinic has a monthly procedure × person matrix. F&B Nafta paper «F&B Cedvel» is person × day with letter shift codes. Copying clinic or HK into every satellite duplicates people lists and mixes labor axes.

Workforce already exposes `GET /internal/v1/workforce/organizations/:id/picker` (name, `orgUnitId`, `positionId`, `leadership`).

## Decision

### 1. Type catalog (metadata, not one engine)

| Code | Period | Axis | Used by |
|------|--------|------|---------|
| `WEEK_ZONE` | week | zone | Hotel HK — **existing** `HkRosterWeek` (do not rewrite cells) |
| `WEEK_POST` | week | post | Hotel reception + security |
| `WEEK_CREW` | week | crew zone | Hotel engineering |
| `WEEK_PERSON` | week | person | F&B `/admin/cedvel` |
| `MONTH_DUTY` | month | procedure | Clinic only — catalog name; hotel/F&B must not write `StaffDutyRoster` |

Conflict rules stay on the type (`one_person_one_post_per_day`, etc.). Auto-draft from Workforce cycles is out of this wave.

### 2. People source

Satellites call the Workforce picker. Each board has a **binding**: `orgUnitIds` (+ optional `positionIds`). The screen filter only chooses among bound units. If the picker is unavailable, existing cells remain visible and new assignments are refused (`ORCH_UNAVAILABLE`). A person who left the bound units stays on an approved/draft cell as `orphaned`.

### 3. Hotel IA

Sidebar section **Schedules** is the **last ops block before Settings**: hub `/schedules`, HK `/hk/roster` (not under Housekeeping staff), boards `/schedules/reception`, `/schedules/security`, `/schedules/engineering`. Models: `DutyScheduleBinding`, `DutyScheduleAxis`, `DutyScheduleWeek`, `DutyScheduleCell`, `DutyShiftCode`. Concurrent seed of binding/axes/week treats Prisma `P2002` as success. Sidebar open-section uses best href so `/hk` does not steal `/hk/roster` from Schedules.

### 4. F&B cədvəl

`/admin/cedvel` — person × day, outlet + position columns, shift codes E/A/L/P/N/OFF/EG/IB (+ placeholder letter codes). **`StaffRoster` (PIN) is unchanged.** Buffet management eaters stay on their own API.

### 5. Clinic

Out of this wave. Do not change planner order (override → posted → empty) or `StaffDutyRoster` shape.

## Consequences

- Ops can manage FO / security / engineering weeks without inventing local staff masters.
- Scaffold / SHIPPED wait on UAT + negative paths; Implementation-Matrix stays 🟡 until then.
- Future automation fills draft weeks from type + Workforce cycle; approve stays human.

## UX deepen (2026-11-06)

Boards: week prev/next/this, approve confirm, copy previous week, binding/axes in collapsible settings, chip + single editor strip (hotel), click-cell shift set (F&B), today/weekend/legend styling. Still SCREEN / not SHOW until UAT §34b and FNB-CEDVEL-01 signed.
