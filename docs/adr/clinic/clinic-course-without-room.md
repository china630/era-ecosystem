# ADR: Courses without a hotel room (ambulatory + staff benefit)

**Status:** Accepted — SCREEN (not SHIPPED / not Pilot-ready)  
**Date:** 2026-11-25  

**Coverage:** CLI-69 (new) · deepens CLI-55 / CLI-57 · walk-in party CLI-61 entry only  

**Related:** [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) · [clinic-episode-procedure-assign-modal.md](./clinic-episode-procedure-assign-modal.md) · [clinic-walk-in-party.md](./clinic-walk-in-party.md) · [sanatorium-vnext.md](./sanatorium-vnext.md) · [workforce-identity-and-hr-provisioning.md](../workforce-identity-and-hr-provisioning.md)

---

## Context

Nafta ops need three “no room” entry paths on `/sanatorium`, under one menu (not the English “Walk-in” label):

1. **Ambulatory** — day visitors buy paid extras only (not Standart/Premium). They still need an N-day course window so extras can be planned and paid before attendance.
2. **Ambulatory group** — existing CLI-61 party → hotel cashier basket.
3. **Staff benefit** — active CP Workforce employments may open a free **PKG-STANDART** course without a hotel stay. Free-typed people must be impossible.

Hotel lifecycle (`CHECKED_IN` / amend / checkout) remains SoT for **IN_HOUSE** guests only. Do not fake a hotel stay for staff or ambulatory.

## Decision

### D1 — One CTA, three flows

`/sanatorium` header: single **New course** menu (`EraMenu`):

| Item | Opens |
|------|--------|
| Ambulatory | Modal → `POST /api/sanatorium/episodes` |
| Group | Modal create (+ detail CRUD) via shared `WalkInPartyWorkspace` — same domain as CLI-61; list stays at `/sanatorium/walk-in-parties` (sidebar) |
| Staff | Modal → workforce picker → `POST /api/sanatorium/episodes/staff-course` |

### D2 — `PatientOrigin` stays two-valued

`WALK_IN` | `IN_HOUSE` only. Do **not** add `PatientOrigin.STAFF`.

Staff and ambulatory without a room use `WALK_IN`. Distinguish with:

| Field | Values |
|-------|--------|
| `ClinicalEpisode.courseKind` | `AMBULATORY` \| `STAFF_BENEFIT` \| null (hotel / legacy) |
| `ClinicalEpisode.plannedEndsOn` | Course end when there is **no** `ProgramInstance` (ambulatory extras horizon) |
| `ClinicalEpisode.benefitEmploymentId` | CP `cpEmploymentId` when `STAFF_BENEFIT` (audit) |

### D3 — Schedule horizon without hotel nights

Seat / extras / OPEN pin horizon:

```text
scheduleBefore = ProgramInstance.endsOn ?? ClinicalEpisode.plannedEndsOn
```

Without either, `staySeatMax = 0` (unchanged fail-closed).

Hotel-owned episodes (`reservationId` set): refuse clinic `PATCH …/course-window` with `409 HOTEL_OWNED_WINDOW`. Ops UI: patient card **Course** box DatePicker when `courseWindowEditable` (no reservation + OPEN).

### D4 — Ambulatory = no package + window

Register stamps `courseKind=AMBULATORY`, `noPackageConfirmedAt`, and `plannedEndsOn` from `courseDays` (Asia/Baku). Package assign stays **hidden** (extras only). Money: existing walk-in extras → settlement hub / hotel cashier.

### D5 — Staff = Workforce picker + Standart

- Picker: S2S `GET …/internal/v1/workforce/organizations/:orgId/picker` (same as hotel duty schedules). Clinic Nest proxies `GET /api/sanatorium/workforce-picker`.
- `POST …/staff-course` body **requires** `cpEmploymentId` (active). No free name/FIN create path.
- Opens `WALK_IN` + `STAFF_BENEFIT` + `ProgramInstance` `PKG-STANDART` with `nights = courseDays`.
- In-package charges remain 0 AZN. No hotel COMP/HOUSE.
- Package assign UI: show when a `ProgramInstance` exists, even if origin is `WALK_IN` (amends CLI-57 “Walk-in → extras only”).

### D6 — Nest-only HTTP

New/changed routes live under `era-clinic/nest/native/controllers`. Domain in `src/domain` / `src/lib/services`.

## Out of scope

- `PatientOrigin.STAFF`
- Fake hotel check-in / `from-stay` for staff
- Workforce entitlement calendar / HR medical leave product
- Commercial “курсовка” SKU with Finance price
- Claiming SHIPPED / Pilot / edition `ga` without field UAT

## Consequences

- Schema migration + seat-cap / extras horizon fallback.
- i18n: UI says Ambulatory / Staff; code may keep `WALK_IN`.
- Acceptance: CLI-69 SCREEN; CLI-55/57 deepen; AC-CLI-COURSE-NOROOM 🟡 until field UAT.
