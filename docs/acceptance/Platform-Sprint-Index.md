# Platform — Sprint / Wave Index

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness:** [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**AC Matrix:** [`Platform-Implementation-Matrix.md`](./Platform-Implementation-Matrix.md)

Header honesty = **Product Readiness** rollup (not «all ✅»).  
Current rollup: Gate ✅ (scaffold only) · BE 🟡 (TOPO **in** rollup — code residual ≠ field hop / Scaffold ✅) · UI 🟡 · Sell: do not claim GA or SHARED pool  
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
| S-4 | Deployment topology program | [~] | Waves 0–18 + PlacementBatch (Start→DONE; hash/disk preflight; OrgFullSliceV2 hotel+clinic; freeze 423+cron skip; smoke login; UI banner/rollback): bind + runtime-config + SHARED-ready schema/filter + two-org UAT outline. **Open:** field UAT / live blob copy / remaining sat full-org routes / live SHARED pool ops / sellable migrate — not sellable as SaaS pool |
| S-5 | BE deepen → Scaffold ✅ (excl. TOPO) | [x] | IM + `apps/api/src/**/cp-*-negative.spec.ts` (Wave 7) |
| S-BILL-T3 | TIER_3 à-la-carte module toggle (retire ENTERPRISE_ALL_MODULES) | [~] | Orch + Finance mirror; `billing-toggle-tier.spec.ts`; Nest toast siblings; UAT-SMOKE-PLATFORM E-C.7; CP-BILL-OWNER-01 API; gate/sell unchanged |
| S-BILL-SYNC | Toggle/bundle/connect → `syncForOrg` + F&B submodule CP-first gate | [~] | ADR; notify + F&B buffet CP-first (incl. partial-snapshot fallback); kit `onSharedOrgSnapshot` pull test; `synced:false` on modal/workforce/connect; UAT E-C.7 / FB-5; API; gate/sell unchanged |
| S-6 | TOPO in BE rollup + return playbook | [x] | [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md); TOPO 🟡 paints BE |
| S-7 | Org legal/branding profile (CP-ORG-PROFILE-01) | [~] | API+SCREEN + Sync `orgProfile`; dual-edit cutover; F&B/Retail `printChrome` + Outlet contacts; backfill script; AC 🟡 out of BE rollup; UAT open; **not** a gate/sell change |
| S-WF-JOB | Job architecture (CP-WF-JOB-01 / AC-CP-WF-JOB) | [~] | API+SCREEN 2026-10-30 — grades/jobs, position parent, employment/hire managers, org-chart, extended route kinds, nav `org` gate; AC 🟡 out of BE rollup; COVERAGE Status=API; UAT open; **not** a gate/sell/`ga` change |
| S-WF-JOB-BANDS | Grade salary bands UI (`minSalary`/`maxSalary` on `/job-architecture`) | [ ] | Deferred debt — [ADR cp-workforce-job-architecture](../adr/cp-workforce-job-architecture.md) § Deferred debt. Finance remains payroll SoR; no empty-band UI pretend. |
| S-WF-JOB-CHART-DND | Drag-edit org chart (`/org-chart`) | [ ] | Deferred debt — same ADR. Chart read-only; forms edit parents. |
| S-NEST-API | Industry satellite API Nest cutover (hotel first) | [~] | 2026-11-12 code cutover: Nest serves industry HTTP, Next keeps UI. Not Scaffold ✅, not SHIPPED, not Pilot. Gate/BE/Demo/Sell and `platform.yaml` unchanged. [ADR](../adr/industry-satellite-api-nest-migration.md) |
| S-CONTROL-HOME | Control Home + topology + 7d grace + SA cutover | [~] | 2026-11-03 API+SCREEN + closeout; **2026-11-05** Structure owner UX + Home summary + second-pass (token/label/create guard; UAT-SMOKE UI rows; lab signoff; CP→sat materialize open). Gate/BE/Pilot/edition **unchanged** (`mvp`, TOPO paints BE 🟡). UAT/SHOW open |
| S-CHANNELS | Satellite integration channels (CP-CHANNELS-01) | [~] | 2026-11-06 peer-links parity — 10 mesh sats `/admin/links` + ChannelEdgeCard UX; SHARED pool self-URL smoke; retail POS edition hide/disable folio+settlement like F&B. Still not Scaffold ✅ (human UAT → SHOW/SHIPPED **out of wave**); Auto FOLIO PLATFORM = CODE_LEGACY only; sell/`ga` unchanged |
| S-CHANNELS-LINKS-REST | `/admin/links` retail + finance + auto (+ wholesale/logistics/construction/CRM) | [x] | 2026-11-06 — kit wrappers + hotel OpsShell SETTINGS + finance panels/i18n; mesh parity checklist closed |
| S-CHANNELS-RETAIL-GATE | Retail FOLIO_POST/SETTLEMENT fail-closed | [x] | 2026-11-06 — bridge + `/api/edition` + POS UI reads `folioPostEnabled`/`settlementEnabled` (parity with F&B OrdersPanel) |
| S-CHANNELS-REVENUE | `REVENUE_EVENT` fail-closed on finance dispatch | [x] | 2026-11-06 — assert before F&B CLOSE/Z-close + hub settlement-confirmed; retail PAID/return/hub-settle/Z-close + events/dispatch; clinic visit/procedure/lab/hub-settle + events/dispatch; room-charge skips revenue |
| S-CHANNELS-OPS-HANDOFF | `OPS_HANDOFF` wholesale→retail PLATFORM pair | [~] | Deferred honest: enum + desired edges landed; `assertChannelEnabled` waits first S2S call-site — do not invent consumers |
| S-CHANNELS-READ-LEGACY | `READ_STATUS` + UI `CODE_LEGACY` | [~] | Deferred honest: `CHANNEL_LEGACY_HINTS` UI only; `READ_STATUS` PLATFORM rows still none |
| S-DOC-REGISTER | Document register (CP-DOC-01) | [~] | 2026-11-10 cycle 4 — reply-to, file text before route start, template step edit blocked on an open route, ALL waiting list, reject can reopen an earlier step. API/SCREEN. Not Scaffold ✅, not SHIPPED, not Pilot |
| S-COMMS-HUB | Messaging Comms Hub (CP-COMMS-01) | [~] | 2026-11-06 — `comms_*` + `IN_APP` migrated on stand; Nest `/v1/comms/*` + Control Home inbox (create/reply/recipients); IN_APP outbox scoped to JWT user; orch image next ship; orch-only; COVERAGE SCREEN not SHIPPED (UAT open, not wave goal) |
| S-GUEST-APP | Guest phone brand + catalog + live preview + Expo shell (CP-GUEST-APP-01/02/03) | [~] | 2026-11-11 — OrgOwner Guest app + catalog + form-state phone preview; AC-CP-GUEST-APP + AC-CP-GUEST-APP-CATALOG + AC-CP-GUEST-APP-PREVIEW 🟡; COVERAGE API/SCREEN; not SHIPPED; gate/sell/`platform.yaml` unchanged; readiness-matrix N/A |

Markers: `[ ]` · `[~]` · `[x]` · `[blocked]` · Gate: `gate[x]`
