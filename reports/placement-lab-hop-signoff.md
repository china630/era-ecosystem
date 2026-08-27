# Placement lab hop signoff (SaaS Waves 7 + 11)

**Scope:** PlacementJob SHARED⇄DEDICATED state machine + hotel curated JSON slice (CP-PLACE-01 / AC-CP-TOPO)  
**Does not claim:** host compose/restore, sellable migrate, AC-CP-TOPO Scaffold ✅, edition `ga`, SHARED pool ops

## Lab checklist (CI) — Wave 7 hop

| Step | Result | Notes |
|------|--------|-------|
| Hop ladder allows SHARED↔DEDICATED / DEDICATED↔ONPREM | pass | `placement-job.service.spec.ts` |
| Direct SHARED↔ONPREM → REJECTED | pass | negative path |
| Full advance chain freeze→…→complete (SHARED→DEDICATED) | pass | Wave 7 + Wave 11 |
| Advance refused on REJECTED | pass | |

```bash
cd era-orchestrator/apps/api && npm test -- --testPathPattern=placement-job.service
```

## Lab dump (Wave 11) — hotel curated JSON slice

| Step | Result | Notes |
|------|--------|-------|
| Kit `exportOrgSlice` / `importOrgSlice` two-org isolation | pass | `packages/satellite-kit` placement tests |
| Hotel export-slice excludes other org guests | pass | `saas-wave11-placement-slice` |
| Orch `exportSlice` hotel note ≠ `not implemented full dump` | pass | `ERA_PLACEMENT_SLICE_LAB=1` or live hotel HTTP |
| Non-hotel satelliteKey honest stub | pass | `slice not implemented for {key}` |

Hotel models (v1): `role` → `user` → `guest`. Reservation/folio backlog.

### Lab dump signoff

- Runner: CI / Wave 11 agent
- Date: 2026-08-28
- Verdict: **lab dump passed** (hotel curated JSON). Host apply / field migrate still open. AC-CP-TOPO stays **🟡**.

## Lab UI

| Surface | Path | Check |
|---------|------|-------|
| Placement | `/super-admin/orgs/{id}/placement` | create SHARED→DEDICATED PENDING; SHARED→ONPREM REJECTED |
| Host agent | `scripts/era-placement-agent.mjs` | polls jobs; **logs** only — no auto compose/restore |
| Hotel export | `POST /api/internal/v1/placement/export-slice` | Bearer service token; org-scoped JSON |

## Field / product open

| Step | Result | Notes |
|------|--------|-------|
| Host provision + migrate apply | pending | |
| Full table graph / object-storage | pending | |
| Customer migrate wizard | pending | |
| Field migrate UAT | pending | required before AC-CP-TOPO Scaffold ✅ |

### Field signoff

- Runner:
- Date:
- Verdict: **not passed**
