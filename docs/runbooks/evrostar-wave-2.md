# Evrostar Wave 2 — labor roster UAT runbook

**ADR:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md)  
**Capability:** `CP-WF-ROSTER-01` (API + UI; **not SHIPPED** until UAT-SMOKE signoff)  
**Depends on:** Wave 0 (two orgs) + Wave 1 (DRAFT/APPROVED timesheet path)

## Goal

HR defines places, shift types/cycles, brigades and dated assignments. The month grid is the plan only. Copying that plan into timesheet cells (`POST …/materialize-roster`) returns **410** — fact stays manual, FaceID, or an approved absence. Compare them on `/workspace/workforce/plan-fact`. Month approve remains payroll SoR (Wave 1).

## Preconditions

- Org has `platform_workforce` entitlement.
- ACTIVE employments exist (Wave 0 hire path).
- Month timesheet is **DRAFT** (open `/workspace/workforce/timesheets`).

## UAT steps (per VÖEN / organization)

1. **Places** — `/workspace/workforce/places`  
   Create two places (e.g. `SITE_A`, `SITE_B`). Confirm they do **not** appear as OrgUnits.

2. **Shifts** — `/workspace/workforce/shifts`  
   Click **Seed default types & cycles** (or rely on first list load). Confirm types `E`, `N`, `OFFICE`, `H24` and cycles `FIVE_TWO` (5/2), `TWO_TWO` (2/2), `TWENTY_FOUR_FORTY_EIGHT` (24/48).  
   Create a brigade (code + name). On `/workspace/workforce/shifts/brigades` use **Transfer** with `effectiveFrom` (Baku) — do not MULTI-save the whole set.

2a. **3→4 brigades from the 1st** — create empty brigade D. Transfer selected people from A/B/C to D with `effectiveFrom` = first of next month (cap +31 Baku days). Current-month preview must stay on A/B/C until that day.

3. **Assignments** — `/workspace/workforce/roster` (add) and `/workspace/workforce/shifts/assignments` (list / end)  
   Assign one employment (or the brigade) to `SITE_A` + `FIVE_TWO` with `effectiveFrom` = first of month.  
   Optionally assign another person to `SITE_B` + `TWO_TWO`.  
   **P2:** UI copy — Place = site/post; OrgUnit = structure; override Place is required to change post (not OrgUnit).

4. **Month plan** — `/workspace/workforce/roster`  
   Select year/month. The grid lists only people with an assignment that overlaps the month (personal or via brigade).  
   A post-day the cycle marks as a shift, with nobody resolving to WORK, is listed as a coverage hole. Two assignments on one person on one day show a red `!`.  
   `POST …/timesheets/:id/materialize-roster` returns **410** `ROSTER_MATERIALIZE_RETIRED`. The timesheet is not painted from the plan.

5. **Locks & overrides**  
   Click a grid cell → set DAY_OFF / EXTRA / SWAP. **EXTRA/SWAP require Place** (site/post, not OrgUnit) **and** shift type — UI and API reject save without `placeId`. Re-preview: orange outline on override cells.  
   Approve an absence covering one day → timesheet sync writes that letter on the fact grid. The plan grid does not copy it into fact.

6. **Plan vs fact** — `/workspace/workforce/plan-fact`  
   Current Baku month, from the 1st through today. Default rows are exceptions only (no-show, unscheduled work, work during leave). Matching days stay hidden until “show matches”. The screen writes nothing.

7. **Approve path (Wave 1)**  
   After fact edits (manual, FaceID, or approved absence), **Approve month** → Finance timesheet header APPROVED (Wave 1 runbook).

8. **Second org**  
   Switch organization (second VÖEN). Places/assignments of org A must **not** appear.

## Out of scope (do not fail UAT for)

- FaceID, holding-federated HR UI, personnel-order templates, MGMT book, hotel HK / clinic nurse roster.

## Evidence

- Screenshots: places list, shifts seed, roster grid (assigned people only), plan-vs-fact exceptions, second-org empty places.
- API smoke: `POST /platform/v1/workforce/timesheets/:id/materialize-roster` returns 410.

Status stays **API** in COVERAGE until human UAT-SMOKE closes this runbook.
