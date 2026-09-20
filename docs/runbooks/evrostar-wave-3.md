# Evrostar Wave 3 — group HR (federated view) UAT runbook

**ADR:** [evrostar-workforce-pilot.md](../adr/evrostar-workforce-pilot.md) §1  
**Capability:** `CP-WF-GROUP-01` (API + UI; **not SHIPPED** until UAT-SMOKE)  
**Depends on:** Wave 0 (two STANDALONE + holding + dual employment)

## Goal

HR with membership on both firms sees one person directory and a dual-employment card, without a merged OrgUnit tree. Writes still require org switch (header or card buttons).

## Preconditions

- Holding with two STANDALONE orgs attached.
- User has org role `OWNER` or `HR_MANAGER` on A and/or B (holding VIEWER alone is not enough).
- Same MDM person hired in A and B (or only A for isolation test).

## UAT steps

1. **Isolation** — User HR only on A: `/workspace/workforce/group` → select holding → only A employments; no B rows.
2. **Union** — User HR on A and B: one directory row for Ivanov with two firm chips; open card → two blocks.
3. **Mutate** — On card, **Open in org** / **Login & access** / **Absences** → header switches → existing screens honor `?employmentId=` / `?hire=1&globalPersonId=` / `?login=1`. **Hire in another firm** for missing ACTIVE employment → switches to B and opens hire wizard (not dual hire).
4. **VIEWER** — Holding VIEWER without org HR → directory returns 403 / forbidden message (no FIO list).
5. **Audit** — Security audit Holding select → rows from both visible orgs (union), each row still has its `organizationId`.
6. **Deep link** — `/workspace/workforce/group?holdingId=` preselects holding; person card back-link preserves it. Dual-ACTIVE banner on hire also works **without** a Holding (`GET persons/:id/employments` with no `holdingId`).
7. **DEPARTMENT** — If a DEPARTMENT org is attached to the holding, it does not appear as a second employer in the federated list.

## Out of scope

- Merged OrgUnit / single payroll / holding roster SoR / FaceID.

## Evidence

Screenshots: directory dual row, person card, 403 for VIEWER, audit union.

Status stays **API** in COVERAGE until human UAT-SMOKE.
