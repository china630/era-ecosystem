# Placement lab hop signoff (Waves 7 + 11 + A–F engineering)

**Scope:** PlacementBatch / PlacementJob SHARED⇄DEDICATED + OrgFullSliceV2 hotel/clinic (CP-PLACE-01 / AC-CP-TOPO)  
**Does not claim:** field migrate UAT, sellable migrate, AC-CP-TOPO Scaffold ✅, edition `ga`, live object-storage copy, remaining satellite full-org routes

## Lab checklist (CI) — hop + A–F

| Step | Result | Notes |
|------|--------|-------|
| Hop ladder allows SHARED↔DEDICATED / DEDICATED↔ONPREM | pass | `placement-job.service.spec.ts` |
| Direct SHARED↔ONPREM → REJECTED | pass | batch + legacy create |
| Start requires targetHost; stores recipeJson + composeYaml + process logs | pass | |
| Start → PROVISION; report-provision ok → CONFIGURE (autopilot off) | pass | |
| Autopilot hotel lab → DONE | pass | freeze + slice lab + cutover + smoke lab |
| Freeze writes `settings.placementFreeze` + Sync | pass | kit 423 helper |
| report-provision fail → FAILED (+ applyLog) | pass | |
| Second active batch → Conflict | pass | |
| Non-hotel `exportSlice` → FAILED | pass | fail-closed |
| Advance refused on REJECTED | pass | |

```bash
cd era-orchestrator/apps/api && npm test -- --testPathPattern=placement-job.service
```

## Lab dump (Wave 11 → OrgFullSliceV2) — hotel full-org slice

| Step | Result | Notes |
|------|--------|-------|
| Kit `exportFullOrgSlice` / `importFullOrgSlice` + checksum | pass | `packages/satellite-kit` `full-org-slice.test.ts` |
| Hotel export-slice excludes other org guests | pass | `saas-wave11-placement-slice` (formatVersion 2) |
| Orch hotel/clinic export with `ERA_PLACEMENT_SLICE_LAB=1` | pass | lab summary V2 |
| Unsupported satelliteKey fail-closed | pass | job `FAILED` (retail etc.) |
| Import empty OrgFullSliceV2 `modelOrder` fail-closed | pass | `placement-job.service.spec` + kit checksum/empty-order |

Product models: all Prisma models with scalar `organizationId` (DMMF order). Object-storage manifest stub until copy hook.

### Lab dump signoff

- Runner: CI / Wave 11 agent + full-org P0–P3
- Date: 2026-11-10
- Verdict: **lab dump passed** (OrgFullSliceV2 hotel/clinic). Host apply / field migrate / blob copy still open. AC-CP-TOPO stays **🟡**.

## Lab UI

| Surface | Path | Check |
|---------|------|-------|
| Placement | `platform…/orgs/{id}/placement` | Start → inline lab + autopilot → DONE (lab envs); process log |
| Legacy | `/super-admin/orgs/{id}/placement` | same |
| Host agent | `scripts/era-placement-agent.mjs` | lab dry-run or `compose` up + health; `report-provision` |
| Hotel export/import | `/api/internal/v1/placement/*-slice` | Bearer service token; org-scoped JSON |
| Kit freeze | `@era/satellite-kit/placement/freeze` | 423 on mutations when frozen |

## Field / product open

| Step | Result | Notes |
|------|--------|-------|
| Host provision on real customer iron | pending | compose + disk path exists; field proof open |
| Reservation / folio / object-storage restore | pending | hotel room/rate + clinic patientRef landed |
| Remaining satellites (F&B/retail/…) slices | pending | fail-closed |
| SSO exchange smoke beyond GET /login | pending | health + login path probe landed |
| Field migrate UAT | pending | required before AC-CP-TOPO Scaffold ✅ |

### Field signoff

- Runner:
- Date:
- Verdict: **not passed**
