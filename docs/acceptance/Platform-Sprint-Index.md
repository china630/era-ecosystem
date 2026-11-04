# Platform — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Platform-Implementation-Matrix.md`](./Platform-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE 🟡 (TOPO **in** rollup — PlacementJob API ≠ live hop) · UI 🟡 · Sell: do not claim GA or SHARED pool  
**Satellite queue (2026-10-31):** job id strips `:`, including clinic and staff fan-out. FIN-02 stays HEADLESS. Does not change the rollup.  
**BE honesty:** Wave 7 greened AUTH/BILL/MDM/WF/SA/INT/BIND/CFG. TOPO stays in rollup 🟡. Playbook: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md).

---

## Wave board

| Wave | Gate | AC rollup (from Matrix) | Pilot-ready | Notes / log |
|------|------|-------------------------|-------------|-------------|
| W0 baseline | gate[x] | 🟡 | [ ] | reports/platform-stage-W0-signoff.md scaffold-gate-pass |
| W1 honesty | gate[ ] | ❌ | [ ] | Close P0 residuals; UAT lab signoff; topology placement still open |
| W7 Green BE | gate[x] | 🟡 | [ ] | Eight AC Scaffold ✅ + negatives; TOPO in rollup → edition BE 🟡 |
| W8 Green BE | gate[x] | 🟡 | [ ] | TOPO excl. reverted; TOPO in rollup; pool/migrate not sellable |

## Backlog

| ID | Item | Status | Proof |
|----|------|--------|-------|
| S-1 | Stage-gate script green + signoff | [~] | `scripts/run-platform-stage-gate.mjs` |
| S-2 | Pilot lab UAT-SMOKE signed | [ ] | `era-orchestrator/doc/UAT-SMOKE-PLATFORM.md`, `UAT-SMOKE-RBAC.md` |
| S-3 | Field / customer sign-off | [ ] | — |
| S-4 | Deployment topology program | [~] | Waves 0–18: bind + runtime-config + PlacementJob API scaffold + host agent stub + SHARED-ready schema/filter + two-org UAT outline. **Open:** live SHARED pool ops / field isolation signoff / automated migrate product — not sellable as SaaS pool |
| S-5 | BE deepen → Scaffold ✅ (excl. TOPO) | [x] | IM + `apps/api/src/**/cp-*-negative.spec.ts` (Wave 7) |
| S-BILL-T3 | TIER_3 à-la-carte module toggle (retire ENTERPRISE_ALL_MODULES) | [~] | Orch + Finance mirror; `billing-toggle-tier.spec.ts`; Nest toast siblings; UAT-SMOKE-PLATFORM E-C.7; CP-BILL-OWNER-01 API; gate/sell unchanged |
| S-BILL-SYNC | Toggle/bundle/connect → `syncForOrg` + F&B submodule CP-first gate | [~] | ADR; notify + F&B buffet CP-first (incl. partial-snapshot fallback); kit `onSharedOrgSnapshot` pull test; `synced:false` on modal/workforce/connect; UAT E-C.7 / FB-5; API; gate/sell unchanged |
| S-6 | TOPO in BE rollup + return playbook | [x] | [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md); TOPO 🟡 paints BE |
| S-7 | Org legal/branding profile (CP-ORG-PROFILE-01) | [~] | API+SCREEN + Sync `orgProfile`; dual-edit cutover; F&B/Retail `printChrome` + Outlet contacts; backfill script; AC 🟡 out of BE rollup; UAT open; **not** a gate/sell change |
| S-WF-JOB | Job architecture (CP-WF-JOB-01 / AC-CP-WF-JOB) | [~] | API+SCREEN 2026-10-30 — grades/jobs, position parent, employment/hire managers, org-chart, extended route kinds, nav `org` gate; AC 🟡 out of BE rollup; COVERAGE Status=API; UAT open; **not** a gate/sell/`ga` change |
| S-WF-JOB-BANDS | Grade salary bands UI (`minSalary`/`maxSalary` on `/job-architecture`) | [ ] | Deferred debt — [ADR cp-workforce-job-architecture](../adr/cp-workforce-job-architecture.md) § Deferred debt. Finance remains payroll SoR; no empty-band UI pretend. |
| S-WF-JOB-CHART-DND | Drag-edit org chart (`/org-chart`) | [ ] | Deferred debt — same ADR. Chart read-only; forms edit parents. |
| S-NEST-API | Industry satellite API Nest cutover (hotel first) | [ ] | **P0 platform debt** recorded 2026-10-28 — [ADR](../adr/industry-satellite-api-nest-migration.md). Not started. Out of Gate/BE rollup until scheduled; mutation-audit uses fail-closed Next ([mutation-audit-depth](../../.cursor/plans/mutation-audit-depth.plan.md)) |
| S-CONTROL-HOME | Control Home + topology + 7d grace + SA cutover | [~] | 2026-11-03 API+SCREEN + closeout (CP-HOME/STRUCTURE/OUTLET/GRACE/BILL-LINES/OP-FIN stub/COMMS stub; app→platform redirects; launch suspend; late-month workforce siblings; F&B+retail CP outlet upsert). Gate/BE/Pilot/edition **unchanged** (`mvp`, TOPO paints BE 🟡). UAT/SHOW open |
| S-CHANNELS | Satellite integration channels (CP-CHANNELS-01) | [~] | 2026-11-03 API+SCREEN — PLATFORM sync, SA Channels, hotel/clinic/F&B `/admin/links` + ChannelEdgeCard (i18n), F&B FOLIO+SETTLEMENT / clinic gates + fail-closed UI flags; invoice tree; structure negatives. Not Scaffold ✅; sell/`ga` unchanged |
| S-CHANNELS-LINKS-REST | `/admin/links` retail + finance + auto | [ ] | Deferred debt — [ADR satellite-integration-channels](../adr/satellite-integration-channels.md) § Deferred debt. Hotel/clinic/F&B done. |
| S-CHANNELS-RETAIL-GATE | Retail FOLIO_POST/SETTLEMENT fail-closed | [ ] | Deferred — PLATFORM rows exist; retail bridge call sites unwired. |
| S-CHANNELS-REVENUE | `REVENUE_EVENT` fail-closed on finance dispatch | [ ] | Deferred — PLATFORM edges exist; publishers fail-open. |
| S-CHANNELS-READ-LEGACY | `READ_STATUS` + UI `CODE_LEGACY` | [ ] | Deferred — schema-ready; display-only legacy not built. |
| S-COMMS-HUB | Messaging Comms Hub (CP-COMMS-01) | [ ] | Deferred — separate from channels; `/workspace/comms-hub` stub. |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
