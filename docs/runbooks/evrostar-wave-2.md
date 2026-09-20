# Evrostar Wave 2 — labor roster UAT runbook

**ADR:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md)  
**Capability:** `CP-WF-ROSTER-01` (API + UI; **not SHIPPED** until UAT-SMOKE signoff)  
**Depends on:** Wave 0 (two orgs) + Wave 1 (DRAFT/APPROVED timesheet path)

## Goal

HR defines places, shift types/cycles, brigades and dated assignments, then materializes a month into **DRAFT** timesheet cells (`source=roster_plan`). Fact is edited on the timesheet grid; month approve remains payroll SoR (Wave 1).

## Preconditions

- Org has `platform_workforce` entitlement.
- ACTIVE employments exist (Wave 0 hire path).
- Month timesheet is **DRAFT** (open `/workspace/workforce/timesheets`).

## UAT steps (per VÖEN / organization)

1. **Places** — `/workspace/workforce/places`  
   Create two places (e.g. `SITE_A`, `SITE_B`). Confirm they do **not** appear as OrgUnits.

2. **Shifts** — `/workspace/workforce/shifts`  
   Click **Seed default types & cycles** (or rely on first list load). Confirm types `E`, `N`, `OFFICE`, `H24` and cycles `FIVE_TWO` (5/2), `TWO_TWO` (2/2), `TWENTY_FOUR_FORTY_EIGHT` (24/48).  
   Create a brigade **with members** (MULTI) and note its code.

3. **Assignments** — `/workspace/workforce/roster`  
   Assign one employment (or the brigade) to `SITE_A` + `FIVE_TWO` with `effectiveFrom` = first of month.  
   Optionally assign another person to `SITE_B` + `TWO_TWO`.  
   **P2:** UI copy — Place = site/post; OrgUnit = structure; override Place is required to change post (not OrgUnit).

4. **Materialize** — same roster page  
   Select year/month → **Materialize month**.  
   Backend also runs **sync absences** after the plan (locked VACATION/SICK beat overrides).  
   Open timesheets: cells should show WORK/OFF from the cycle; `source` conceptually `roster_plan` (fact edits overwrite after last materialize).  
   Roster **grid** should show place-colored plan cells before/after materialize (`GET roster/preview`).

5. **Locks & overrides**  
   Click a grid cell → set DAY_OFF / EXTRA / SWAP. **EXTRA/SWAP require Place** (site/post, not OrgUnit) **and** shift type — UI and API reject save without `placeId`. Re-preview: orange outline on override cells.  
   Approve an absence covering one day → re-materialize: locked VACATION/SICK cells unchanged.  
   With `preserveManual=Yes`, a cell edited as `ops_grid` is not overwritten.

6. **Approve path (Wave 1)**  
   After plan + fact edits, **Approve month** → Finance timesheet header APPROVED (Wave 1 runbook).

7. **Second org**  
   Switch organization (second VÖEN). Places/assignments of org A must **not** appear. Materialize only writes that org’s timesheet.

## Out of scope (do not fail UAT for)

- FaceID, holding-federated HR UI, personnel-order templates, MGMT book, hotel HK / clinic nurse roster.

## Evidence

- Screenshots: places list, shifts seed, roster assignment, timesheet after materialize, second-org empty places.
- API smoke optional: `POST /platform/v1/workforce/timesheets/:id/materialize-roster`.

Status stays **API** in COVERAGE until human UAT-SMOKE closes this runbook.
