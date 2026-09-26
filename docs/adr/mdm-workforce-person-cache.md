# ADR: Workforce person and roster preview cache

- **Status:** Accepted
- **Date:** 2026-09-26

## Context

Opening a workforce timesheet or the roster grid (`GET /platform/v1/workforce/roster/preview`) resolves every active person's display name through MDM, one database round-trip per person. The roster grid is then rebuilt from assignments, cycles, and day overrides. Both are read often and change only when a person, grant, or shift plan is written.

Redis on the orchestrator already backs BullMQ. Cache keys must expire and must not be allowed to crowd out the queue. Postgres remains the source of truth for cells, grants, and the ledger. Approved timesheet months are not cached: after the person snapshot, the remaining read is one indexed page of cells.

## Decision

Two Redis snapshots, prefix `cache:`, TTL 6 hours. A Redis error falls through to the live read.

### Person card

`MdmService.batchGetPersonOpsProfile` reads and writes `cache:wf:person:{globalPersonId}:{organizationId}`.

Stored fields: display name, name parts, masked identifier, sex, birth date, `accessDenied`. `hrProfile` (addresses, blood group, photo) is not stored. A cache hit returns `hrProfile: null`. The employment card still loads HR profile through `getPersonHrProfile`.

A full hit writes one `person_access_log` row, action `WORKFORCE_OPS_PROFILE_CACHE`. Misses keep `WORKFORCE_OPS_PROFILE_BATCH`. Lookup failures are not cached.

A merged-away id is stored as an alias of the canonical person (`cache:wf:person-alias:{globalPersonId}`) and dropped with that person.

The org index `cache:wf:person-orgs:{globalPersonId}` lists organizations that hold a snapshot. It is cleared on:

- person demographics or identifier update (all organizations);
- person merge (source and target);
- access-request decision and workforce access grant (that organization only).

### Roster grid

`WorkforceRosterService.previewMonth` caches its return value (year, month, last day, places, rows, gaps) at `cache:wf:roster:{organizationId}:{year}:{month}:{placeId|-}:{orgUnitId|-}`. Person names are not in this value; the controller still attaches them from the person cache.

`roster/compare` calls `previewMonth`, so the plan side is cached and timesheet fact stays a live read.

Every month and filter for the organization is dropped after a roster write (place, shift type, cycle, brigade membership, assignment, day override, default seed) and after employment create, transfer, hire, terminate, or a hire-date correction on roster import / workforce migration. A failed access-log insert does not discard a person snapshot that was already read.

## Consequences

- Timesheet, absences, vacation plans, personnel orders, export, and the roster screen share the person snapshot without a per-screen cache.
- A grant removed outside the methods above can show a name until the TTL.
- Cache keys carry `organizationId`. They hold masked identifiers and names, not a raw FIN.
