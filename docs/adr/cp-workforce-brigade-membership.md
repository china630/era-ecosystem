# ADR: Dated brigade membership and transfer editor

- **Status:** Accepted (implementation landed 2026-09-24; docs still not SHIPPED / not edition `ga`)
- **Date:** 2026-09-24
- **Product:** Control plane Workforce (`era-orchestrator`)
- **Capability:** CP-WF-ROSTER-01
- **Amends:** [evrostar-workforce-pilot.md](./evrostar-workforce-pilot.md) §2 (labor roster primitives)
- **Related:** [asia-baku-clock.md](./asia-baku-clock.md), [cp-personnel-orders.md](./cp-personnel-orders.md), [workforce-dual-audit.md](./workforce-dual-audit.md)

Field crews (Evrostar-class: cleaning / objects) need to **move people between brigades on a civil day** and later answer **who was in which brigade when**. Wave 2 shipped brigades as a **current snapshot** (`MULTI` checkboxes + `deleteMany`/`createMany`). That cannot reconstruct history and is too slow for daily reassignments.

## Context (today)

| Layer | Shape |
|-------|--------|
| Catalog | `WorkforceBrigade` (`organizationId`, `code`, `name`) |
| Membership | `WorkforceBrigadeMember` — unique `(brigadeId, employmentId)`, `createdAt` only |
| Write | PATCH replaces the whole member set |
| Assignment | Dated `WorkforceShiftAssignment`: employment **XOR** brigade × place × cycle |
| Materialize | Loads **current** members; a brigade assignment applies to whoever is in the brigade **now** |

Consequences:

- Saving an edit **destroys** prior membership.
- A person may sit in **several** brigades at once (no exclusive current-member rule).
- Rematerializing a past month after a transfer **rewrites the plan** as if the new crew had always been there.
- UI cannot “move Ali from A to B as of 12 Sep” without unchecking/rechecking lists.

Personnel order `TRANSFER` is **org unit / position** (legal employment). Brigade move is **operational crew**, not a statutory order.

## Decision

### 1. Membership is dated (same grain as assignment)

`WorkforceBrigadeMember` becomes an interval, not a set membership:

| Field | Rule |
|-------|------|
| `employmentId` | CP employment in the same `organizationId` |
| `brigadeId` | Brigade in that org |
| `effectiveFrom` | Baku civil day (`@db.Date` = UTC midnight of that YMD) |
| `effectiveTo` | Inclusive last day, or `null` = still in the brigade |
| `leftToBrigadeId` | Optional FK: brigade they moved **to** (null = left without a new crew) |

Open interval: `effectiveTo IS NULL`. Closed: `from ≤ day ≤ to`.

**Exclusive current crew:** for one employment, open intervals must not overlap. At most **one** brigade with `effectiveTo IS NULL`. Historical closed rows may exist for many brigades.

Do **not** unique `(brigadeId, employmentId)` without dates. Replace with a partial unique on `(employmentId) WHERE effectiveTo IS NULL` (Postgres) plus an overlap check in the service (same employment, two intervals that share a Baku day).

### 2. Transfer is the write path (not “save checkbox set”)

Atomic mutation `POST …/brigades/transfers` (name may be nested under workforce roster):

Input: `employmentIds[]`, `toBrigadeId`, `effectiveFrom` (Baku YMD), optional `fromBrigadeId` (must match current open membership when provided).

In one `prisma.$transaction`:

1. For each employment, find the open membership (`effectiveTo IS NULL`).
2. If they are already in `toBrigadeId` on that day → no-op for that person.
3. Close it: `effectiveTo = day before effectiveFrom` (or reject if `effectiveFrom` is on/before `effectiveFrom` of the open row).
4. Set `leftToBrigadeId = toBrigadeId`.
5. Insert new open row on `toBrigadeId` with that `effectiveFrom`.

**Join (no prior brigade):** insert open row only.

**Leave (no target):** close open row, `leftToBrigadeId = null`. Same date rules.

**Backdated transfer:** allowed while the timesheet month for affected days is **not APPROVED**. If DRAFT cells exist for those days from an older `roster_plan` paint, the API returns `rematerializeSuggested: true`. The flag does **not** rewrite fact. HTTP materialize is retired (410); the operator compares plan and fact on `/workspace/workforce/plan-fact` and edits the timesheet by hand if the old letters are wrong.

Reject: employment not in org / not ACTIVE; brigade not in org; overlapping interval; `effectiveFrom` after today+N (cap: 31 Baku days ahead) unless a documented override later.

### 3. Snapshot PATCH is retired for members

`PATCH /brigades/:id` with `employmentIds[]` **must not** `deleteMany` members.

- **Create brigade:** code + name; optional initial members as open intervals from `todayBakuYmd` (or explicit `effectiveFrom`).
- **Rename** brigade: PATCH name only.
- Member changes go through **transfer / join / leave** only.

A one-shot migration converts existing snapshot rows: `effectiveFrom = Baku date of createdAt`, `effectiveTo = null`. Duplicate employment in two brigades: keep the latest `createdAt` as open; close others with `effectiveTo = day before` that open `from` (or same-day close if timestamps collide — last write wins, log in audit).

### 4. Materialize and preview use as-of membership

For each employment and each Baku YMD `d`:

```
member where employmentId = E
  and effectiveFrom <= d
  and (effectiveTo is null or effectiveTo >= d)
```

Brigade-targeted `ShiftAssignment` applies only if that membership holds **on `d`**. Employment-targeted assignment still wins or merges per existing `pickAssignment` sort (unchanged: later `effectiveFrom` wins). Do not use “members right now” for past days.

### 5. History SoR is the membership table

Query, not a parallel history table:

- **Person:** all intervals for `employmentId`, newest first, with brigade code/name and `leftToBrigade`.
- **Brigade:** intervals that overlap a from/to filter (default: open members + last 90 Baku days of leavers).

`WorkforceAuditLog` still records `ROSTER_BRIGADE_TRANSFER` (batch payload: counts + ids). Audit is not the operator history UI.

No Finance event: brigade is labor **plan** crew, not legal transfer and not payroll SoR. Timesheet approve remains the Finance bridge.

### 6. UI

Stay on `/workspace/workforce/shifts/brigades` (plus optional person-side later). Three surfaces, kit list/modal:

| Surface | Job |
|---------|-----|
| **Current roster** | Open members per brigade (not a count-only grid). |
| **Transfer editor** | Pick people (current brigade filter) → target brigade → `effectiveFrom` DatePicker (Baku) → confirm. CatalogField `ENTITY_REF` / `MULTI` for people, not free-typed UUIDs. |
| **History** | Filter person or brigade; columns from / to / brigade / next brigade. Empty row + docked pager. |

Do not rebuild the Wave 2 MULTI “save whole set” modal as the primary editor.

i18n en + az + ru. Status stays **API / SCREEN** until UAT-SMOKE; not SHOW, not SHIPPED, not edition `ga`.

### 7. Calendar

Membership bounds are **Baku civil days** ([asia-baku-clock.md](./asia-baku-clock.md)). Store `@db.Date` via kit (`bakuCivilUtcDate`). Display `bakuDateDisplay`. Do not use `toISOString().slice(0, 10)` as “today”.

## Non-goals

- Personnel order / PDF for brigade move (not `TRANSFER` in [cp-personnel-orders.md](./cp-personnel-orders.md)).
- Cross-`organizationId` / holding-wide brigades (holding view remains read-union of two scopes).
- Staffing optimizer, auto-balance headcount, GPS.
- Hotel HK / clinic nurse duty sheets (still satellite posting).
- Silent rematerialize of **APPROVED** timesheet months.

## Consequences

- Prisma: drop `@@unique([brigadeId, employmentId])`; add interval columns + partial unique on open membership; migrate snapshot rows.
- API: transfer/join/leave; list members `asOf`; history query; stop member-replace PATCH.
- Roster preview joins membership **by day**. `materialize-roster` is retired (410) and does not write fact.
- Module map / COVERAGE_MATRIX: update when routes land; capability stays API until UAT-SMOKE.
- Existing Wave 2 runbook steps that say “edit brigade MULTI” become “transfer as of date”.

## API (landed; capability still API / SCREEN)

Implementation: `WorkforceRosterService` + `workforce-roster.controller.ts`. Status in COVERAGE stays **API** until UAT-SMOKE.

| Method | Path | Role |
|--------|------|------|
| `POST` | `/platform/v1/workforce/brigades/transfers` | batch move / join |
| `POST` | `/platform/v1/workforce/brigades/leaves` | close open membership |
| `GET` | `/platform/v1/workforce/brigades/:id/members?asOf=` | current-as-of |
| `GET` | `/platform/v1/workforce/brigade-memberships?employmentId=&brigadeId=&from=&to=` | history |

Exact DTO names follow existing workforce roster controllers.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Keep snapshot + append-only audit | Cannot query “who was on site on Tuesday” without replaying logs; rematerialize stays wrong. |
| New `BrigadeMembershipHistory` table plus snapshot | Two sources of truth; snapshot will drift. |
| Date membership on `ShiftAssignment` only | Assignment is place×cycle; crew composition changes without a new site assignment. |
| Allow many open brigades per person | Field ops (one crew, one object) become ambiguous on materialize; exclusive open interval is the default. A later ADR may add a documented dual-crew exception. |
