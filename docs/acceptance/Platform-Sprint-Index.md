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
| S-CONTROL-HOME | Control Home + topology + 7d grace + SA cutover | [~] | 2026-11-03 API+SCREEN + closeout; **2026-11-05** Structure owner UX + Home summary + second-pass (token/label/create guard; UAT-SMOKE UI rows; lab signoff; CP→sat materialize open). Gate/BE/Pilot/edition **unchanged** (`mvp`, TOPO paints BE 🟡). UAT/SHOW open |
| S-CHANNELS | Satellite integration channels (CP-CHANNELS-01) | [~] | 2026-11-06 — `GET /v1/internal/channels` is `@Public` so the service token reaches the handler (user JWT was 401 and clinic folio read that as missing). Still not Scaffold ✅; sell/`ga` unchanged |
| S-CHANNELS-LINKS-REST | `/admin/links` retail + finance + auto (+ wholesale/logistics/construction/CRM) | [x] | 2026-11-06 — kit wrappers + hotel OpsShell SETTINGS + finance panels/i18n |
| S-CHANNELS-RETAIL-GATE | Retail FOLIO_POST/SETTLEMENT fail-closed | [x] | 2026-11-05 — `pms-bridge-client` + `/api/edition` (AUTH_ONLY) |
| S-CHANNELS-REVENUE | `REVENUE_EVENT` fail-closed on finance dispatch | [x] | 2026-11-06 — assert before F&B CLOSE/Z-close; retail PAID/return/hub-settle/Z-close; clinic visit/procedure/lab/hub-settle; room-charge skips revenue |
| S-CHANNELS-OPS-HANDOFF | `OPS_HANDOFF` wholesale→retail PLATFORM pair | [~] | 2026-11-05 — enum + desired edges; call-site assert waits first S2S client |
| S-CHANNELS-READ-LEGACY | `READ_STATUS` + UI `CODE_LEGACY` | [~] | 2026-11-06 — `CHANNEL_LEGACY_HINTS` + legacyTitle/Hint i18n on sats/finance; `READ_STATUS` PLATFORM rows still none |
| S-COMMS-HUB | Messaging Comms Hub (CP-COMMS-01) | [~] | 2026-11-05 — ADR + minimal list/compose shell; not product inbox |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
