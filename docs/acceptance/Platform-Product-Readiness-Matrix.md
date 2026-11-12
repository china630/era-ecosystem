# Platform — Product Readiness Matrix (one screen)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.4  
**Purpose:** answer «readiness / can we show / sell?».  
**Not the same as** [`Platform-Implementation-Matrix.md`](./Platform-Implementation-Matrix.md) (= Scaffold BE / AC only).  
**Not** [`READINESS_MATRIX.md`](../READINESS_MATRIX.md) (engineering API/DELIVERY %).

**Sources:** Sprint-Index · Implementation-Matrix · UAT-SMOKE · COVERAGE · Pilot · [`docs/editions/platform.yaml`](../editions/platform.yaml)

**Legend:** ✅ · 🟡 · ❌/`[ ]` · ⏸ external · `n/a`  
**Row rollup** = worst(Gate, BE, UI, Demo/TE, Pilot lab, Pilot field) — not BE alone.  
**Closeout (2026-11-11):** guest app frame. AC-CP-GUEST-APP 🟡 out of BE rollup. CP-GUEST-APP-01 API/SCREEN. Gate ✅ / BE 🟡 / UI 🟡 / Demo ❌ / Pilot [ ] / Edition `mvp` / Sell unchanged. `platform.yaml` untouched. `READINESS_MATRIX` N/A. The line rollup stays the existing worst layer.

**Closeout (2026-11-11 catalog):** AC-CP-GUEST-APP-CATALOG 🟡 out of BE rollup. CP-GUEST-APP-02 API/SCREEN. Gate/Sell/`platform.yaml` unchanged. `era-readiness-matrix` N/A.

**Closeout (2026-11-11 guest app preview):** AC-CP-GUEST-APP-PREVIEW 🟡. CP-GUEST-APP-03 SCREEN. Gate ✅ / BE 🟡 / UI 🟡 / Demo ❌ / Pilot [ ] / Edition `mvp` / Sell unchanged. `platform.yaml` untouched.

**Closeout (2026-11-11 guest phone product polish):** Hotel `apps/guest-app` shell deepen only. CP-GUEST-APP-01…03 stay API/SCREEN; AC-CP-GUEST-APP* stay 🟡. Gate/BE/UI/Demo/Pilot/Edition/Sell/`platform.yaml` unchanged.

**Closeout (2026-11-11 catalog):** AC-CP-GUEST-APP-CATALOG 🟡. CP-GUEST-APP-02 API. Gate/BE/UI/Demo/Pilot/Edition/Sell unchanged. `platform.yaml` untouched.

**Closeout (2026-11-10 d):** org access keys tab. AC-CP-ACCESS 🟡 out of BE rollup. ORCH-ACCESS-01 API/SCREEN. Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `platform.yaml` untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-11-10 c):** CP-DOC-01 cycle 4 reply-to, file text, template step edit, ALL waiting list, return-to-step. AC-CP-DOC stays 🟡 out of BE rollup. Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `platform.yaml` untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-11-09):** CP-DOC-01 document register API+SCREEN. AC-CP-DOC 🟡 out of BE rollup. Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged. `platform.yaml` untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-10-31):** night-audit correlation ids enqueue. FIN-02 stays HEADLESS. Gate / BE / UI / Demo / Pilot / Sell unchanged. Edition stays `mvp`.

---

## Line summary (SSOT readiness)

| Edition | Gate | Scaffold BE | UI | Demo / TE | Pilot lab | Pilot field | Edition | Sell / show |
|---------|------|-------------|----|-----------|-----------|-------------|---------|-------------|
| **Platform** | ✅ | 🟡 | 🟡 | 🟡 | [ ] | [ ] | `mvp` | do not claim GA or SaaS pool — TOPO in BE rollup (code residual ≠ field hop / Scaffold ✅); migrate not sellable |

**Closeout (2026-08-18):** eight AC Scaffold ✅ with negatives; **AC-CP-TOPO in BE rollup** → Scaffold BE **🟡**. Return checklist: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md). Topology honesty: SHARED pool **Not built**; edition `mvp` / `pilot_ready: false`.

---

## UI (short)

**UI class rollup:** SCREEN — placement hop UI landed — [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md). This table is sell/show; «is there a screen?» lives on the board.

| Surface | Path | Level |
|---------|------|-------|
| Workspace / org hub | `/workspace, /organizations`, `/workspace/organization` | 🟡 — OrgOwner org profile (multi-contact/logo, `CatalogField` kinds): [ADR](../adr/cp-organization-profile-and-branding.md); CP-ORG-PROFILE-01 API/SCREEN; Finance Sync + hotel/clinic prefer CP; dual-edit closed; F&B/Retail pay `printChrome` + Outlet contact overlay; Finance→orch backfill ops script; UAT open; not sellable. Modules modal + workforce/connect (CP-BILL-OWNER-01): TIER_3; auto-Sync ([ADR](../adr/billing-module-change-satellite-sync.md)); `synced:false` toast; UAT E-C.7 open; not sellable |
| Workforce | `/workspace/workforce/*` | 🟡 SCREEN — request dates, hire date, and migration stamp render `дд.мм.гггг`. Floor and self-service dates are `DatePicker`. Does not move Gate, BE 🟡, UI 🟡, Demo 🟡, Pilot, or edition. Month timesheet harden + vacation multi-line; **not sell-ready** (no UAT-SMOKE). **BE:** hub AC-CP-WF ✅; job architecture **AC-CP-WF-JOB 🟡** out of BE rollup (`CP-WF-JOB-01` Status=API). **UI:** `/job-architecture`, `/org-chart` (package `org`), org-structure manager/`unitKind`, positions job/parent, employments reporting + hire managers, hr-settings new step kinds — SCREEN only ([ADR](../adr/cp-workforce-job-architecture.md)). **Demo/TE / Pilot / Edition / Sell:** unchanged 🟡 / [ ] / `mvp` / do not claim GA. 2026-10-26 grants: one active row per employment+satellite+role (409), Active filter is `revokedAt` null. 2026-10-27: satellite uncheck/disconnect revokes linked and orphan grants for that key; orphan grant bindings heal on reprovision; MANUAL_GRANT emits last. Evrostar: group HR (`CP-WF-GROUP-01` API), roster wave 2, orders/templates (`CP-WF-ORD-02` API); MGMT book wave 5; FaceID attendance (`CP-WF-ATT-01` API, not SHIPPED); live floor (`CP-WF-FLOOR-01` API); minute buckets (`CP-WF-MIN-01` API); Finance minute pricing (`FIN-HR-MIN-01` API); employee cabinet (`CP-WF-SELF-01` API); fitness files (`CP-WF-FIT-01` API) — [ADR](../adr/evrostar-workforce-pilot.md) / [floor ADR](../adr/cp-workforce-floor-attendance.md) |
| Super-admin | `platform.era-365.online` (`apps/platform-web`); `app` `/super-admin/*` redirects | 🟡 SCREEN — cutover redirects landed (CP-SA-CONSOLE-01); org shell one job per tab (card, structure, license, modules, addresses, payments, channels, Elektraweb, service placement); payment CRUD on `/payments` (CP-PAY-METHODS-01); UAT/SHOW open; not SHOW |
| Control Home / Structure | `/workspace` zones; `/workspace/structure`; `/workspace/comms-hub` inbox; `/workspace/documents` | 🟡 SCREEN — home org ★; Platform apps vs Systems; structure summary counts + Manage structure; hierarchical Structure (dept switch, CatalogField sat, outlet CRUD, Open sat SSO); Comms server inbox + recipients (not SHOW/SHIPPED); lab [`reports/platform-structure-owner-ux-signoff.md`](../../reports/platform-structure-owner-ux-signoff.md); CP→sat materialize open; UAT/SHOW open; not sellable |
| Integration channels | `platform…/orgs/[id]/channels` Channels+Resync; shared kit `/admin/links` (hotel OpsShell SETTINGS); F&B+retail+clinic pre-mutate money assert | 🟡 SCREEN — harden + second-pass lab; human UAT open; not sellable |
| Owner invoices | `/settings/invoices` | 🟡 SCREEN — Org→Sat→Outlet line tree (CP-BILL-LINES-01); UAT open; not sellable |
| Reference settings | `platform…/reference` (after MDM; app path redirects) | 🟡 SCREEN — hub fetch switches and per-org hub/Excel; UAT open; not SHOW |
| MDM persons | `platform…/mdm/persons`, `…/persons/dedup` | 🟡 SCREEN — directory plus suspected-person queue (ORCH-MDM-04). Phone polish on resolve. UAT open; not SHOW. AC-CP-MDM-DEDUP 🟡 out of BE rollup |
| Org access keys | `platform…/orgs/:id/access` | 🟡 SCREEN — org enters id + secret (ORCH-ACCESS-01). Check does not call the bank or portal. Unibank / Access / Bank of Baku closed. Not SHOW. AC-CP-ACCESS 🟡 out of BE rollup |
| Placement hop / freeze | `platform…/orgs/[orgId]/placement` (app path redirects) | 🟡 SCREEN — Start→DONE + OrgFullSliceV2 hotel/clinic + migrate banner + rollback; AC-CP-TOPO still 🟡 ([return playbook](./BE-OPEN-AND-TOPO-RETURN.md)) |

Routes added 2026-08-17 (still 🟡 / not sell-ready): org catalog, referrals, landing, owner invoices/orders, workforce vacation/orders/ştat/timesheets.  
**Closeout (2026-11-01):** vendor console `platform.era-365.online` parallel to `app` `/super-admin/*` (CP-SA-CONSOLE-01 API). Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-03):** Control Home (home org, Structure, Platform apps), 7-day SKU grace, structured invoice dims, commercial outlets, operator Finance bridge stub, app `/super-admin` redirect to platform, Comms Hub stub. Second-pass (launch suspend, late-month workforce siblings, retail→CP outlet) does not move sell layers. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-03 b):** CP-CHANNELS-01 (integration channels + `/admin/links` + bridge gates) + owner invoice tree. Messaging CP-COMMS remains stub. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-03 c):** Second-pass — F&B `SETTLEMENT` fail-closed + edition `folioPostEnabled`/`settlementEnabled` UI hide; channel error → 403. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-03 d):** Channels UI polish (`ChannelEdgeCard`) + F&B `/admin/links`; deferred debts in ADR/Sprint (`S-CHANNELS-*`, `S-COMMS-HUB`). Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-03 e):** Channels second-pass — kit rebuild for new exports; ChannelEdgeCard kind/sat/managed i18n (en/az/ru); invoice sat labels; Nest `GET …/channels/check` static before `:channelId`. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-10 c):** MDM phone polish on resolve and suspected-person queue (`/mdm/persons/dedup`). ORCH-MDM-04 stays **API**. AC-CP-MDM-DEDUP **🟡** out of BE rollup; AC-CP-MDM ✅ not reopened. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched. READINESS_MATRIX N/A (no DELIVERY % change).

**Closeout (2026-11-10 b):** Platform operator stub `/structure` removed. Owner tree stays `/workspace/structure`. CP-STRUCTURE-01 SuperAdmin column cleared; status stays **API** / **SCREEN**. AC-CP-HOME stays out of BE rollup and not Scaffold ✅ (owner UAT open). Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched. READINESS_MATRIX N/A.

**Closeout (2026-11-10 full-org g3 / second-pass) — Acceptance checklist:** COVERAGE CP-PLACE-01 SuperAdmin Y / **API**; AC-CP-TOPO Scaffold **🟡**; PRM Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**; UI-BOARD **SCREEN**; Sprint `S-4` / `platform.yaml` notes already OrgFullSliceV2 (`pilot_ready: false`). Second-pass: UAT-SMOKE + ADR honesty; curated v1 deprecated; import fail-closed empty modelOrder/checksum. Lab: [`reports/placement-lab-hop-signoff.md`](../../reports/placement-lab-hop-signoff.md). Engineering `READINESS_MATRIX` N/A (CP-PLACE stays API; no DELIVERY % change). No SHIPPED / no SHOW / no `ga`.

**Closeout (2026-11-10 full-org P0–P3) — Acceptance checklist:** COVERAGE CP-PLACE-01 SuperAdmin Y (platform + legacy) / **API** (OrgFullSliceV2 hotel+clinic; other sats fail-closed); AC-CP-TOPO Scaffold **🟡** (field UAT / blob copy / other sat routes open → not ✅); PRM Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**; UI-BOARD **SCREEN**; Sprint `S-4` + `platform.yaml` notes synced (`pilot_ready: false`). Lab: [`reports/placement-lab-hop-signoff.md`](../../reports/placement-lab-hop-signoff.md). Engineering `READINESS_MATRIX` note only (CP-PLACE stays API; no DELIVERY % / consumer level change). No SHIPPED / no SHOW / no `ga`.

**Closeout (2026-11-10 g2) — Acceptance checklist (after second-pass):** COVERAGE CP-PLACE-01 SuperAdmin Y (platform + legacy placement) / **API**; AC-CP-TOPO Scaffold **🟡** (field UAT open → not ✅); PRM Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**; UI-BOARD **SCREEN**; Sprint `S-4` / `platform.yaml` notes synced (`pilot_ready: false`). Second-pass: legacy banner/rollback parity + hotel mock/module-maps. Engineering `READINESS_MATRIX` N/A (no DELIVERY % / consumer API level change).

**Closeout (2026-11-10 g) — Acceptance checklist:** COVERAGE CP-PLACE-01 SuperAdmin Y / **API**; AC-CP-TOPO Scaffold **🟡** (negatives + lab evidence; field UAT open → not ✅); PRM Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged; UI-BOARD **SCREEN** (banner+rollback); Sprint `S-4` synced; `platform.yaml` notes only (`mvp`, `pilot_ready: false`). Residual code: hash/disk preflight; hotel room/rate + clinic patientRef; cron freeze skip; smoke login; prod inline-lab opt-in. Engineering `READINESS_MATRIX` note only (CP-PLACE stays API; no DELIVERY % / consumer level change).

**Closeout (2026-11-10 f):** Placement A–F engineering — composeYaml + configure Sync + freeze 423 + autopilot EXPORT→DONE (lab). CP-PLACE-01 stays **API** / **SCREEN**. AC-CP-TOPO stays Scaffold 🟡. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-10 e):** Placement Wave 2 — recipeJson + process log + agent report-provision → CONFIGURE. CP-PLACE-01 stays **API** / **SCREEN**. AC-CP-TOPO stays Scaffold 🟡. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-10):** Placement Wave 1 skeleton — PlacementBatch Start→PROVISION; clone-then-freeze advance order; platform Start wizard. CP-PLACE-01 stays **API** / **SCREEN**. AC-CP-TOPO stays Scaffold 🟡. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-10):** Org console IA split — card / structure / license / modules / addresses / payments / channels / Elektraweb / service placement. CP-SA-CONSOLE-01 / CP-LIC-01 / CP-PAY-METHODS-01 / CP-CHANNELS-01 / CP-PLACE-01 stay **API** and **SCREEN**. AC-CP-PAY-METHODS and AC-CP-TOPO stay Scaffold 🟡. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched. READINESS_MATRIX N/A (no API level or DELIVERY % change).

**Closeout (2026-11-06):** Platform org console UX — org shell tabs; `/connections` payment ModalShell CRUD; list filters; placement next-step UI. CP-SA-CONSOLE-01 / CP-PAY-METHODS-01 / CP-PLACE-01 stay **API**; AC-CP-PAY-METHODS + AC-CP-TOPO stay Scaffold 🟡. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-05):** CP-PAY-METHODS-01 org payment methods on SuperAdmin org hub + Sync to hotel/clinic/F&B; Finance tenders PUT 410. AC-CP-PAY-METHODS 🟡 out of BE rollup. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-05 b):** CP-CHANNELS spine (same-org REVENUE, revenue+guest gates, links on finance/retail/ops). AC-CP-CHANNELS stays 🟡 out of BE; UAT open. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-05 c):** CP-CHANNELS second-pass (clinic/hotel money siblings, connect sync, retail edition AUTH_ONLY, module-maps/i18n). AC-CP-CHANNELS stays 🟡; UAT open. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-05 d):** CP-CHANNELS harden (sync hooks, Resync, money gate, shared links, OPS_HANDOFF edges, Comms shell). AC-CP-CHANNELS stays 🟡; lab evidence only. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**.

**Closeout (2026-11-05 e) — Acceptance checklist:** COVERAGE CP-CHANNELS-01 / CP-COMMS-01 actor rows synced; AC-CP-CHANNELS Scaffold **🟡** (negatives + lab evidence; human UAT open → not ✅); PRM rollup Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell unchanged; Sprint `S-CHANNELS*` / `S-COMMS-HUB` synced; `platform.yaml` `mvp` / `pilot_ready: false` untouched (no gate/sell claim). Engineering `READINESS_MATRIX` N/A (no DELIVERY % / consumer API level change).

**Closeout (2026-11-05 f) — Harden second-pass checklist:** idempotent connect channel sync + ModuleRef null-safe + `kindOpsHandoff` i18n + module-map/ADR docs. AC-CP-CHANNELS stays 🟡; Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot / Edition `mvp` / Sell **unchanged**. `READINESS_MATRIX` N/A.

**Closeout (2026-11-05 g) — Structure / Control Home owner UX:** hierarchical `/workspace/structure` + Home summary strip; AC-CP-HOME residual deepen (not Scaffold ✅); lab evidence only. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched. `READINESS_MATRIX` N/A (no DELIVERY % / consumer API level change).

**Closeout (2026-11-05 h) — Structure second-pass checklist:** token-after-switch + sat title i18n + suspended-sat create guard; ADR/module-map/UAT-SMOKE UI table. AC-CP-HOME still not Scaffold ✅; UI stays SCREEN. Gate / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**. Editions yaml untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-11-06) — CP-CHANNELS thin-spot checklist:** hotel OpsShell `/admin/links` + SETTINGS; F&B/retail money assert before mutate; retail room-charge skips revenue event; hotel channel-disabled 403; finance+sat legacy i18n. AC-CP-CHANNELS Scaffold **🟡**; Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched. `READINESS_MATRIX` N/A (no DELIVERY % / consumer API level change).

**Closeout (2026-11-06 i) — CP-CHANNELS second-pass checklist:** `SATELLITE_RETAIL_SHIFT_CLOSED` allowlist; retail return/hub-settle/Z-close + clinic visit/procedure/lab/hub-settle assert before mutate; ADR/module-map/UAT-SMOKE synced. AC-CP-CHANNELS Scaffold **🟡**; Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-11-06 j) — Channels + Comms + pool self-URL:** SHARED `publicBaseUrl` = `SatelliteEndpoint.baseUrl`; ChannelEdgeCard kind/flow + peer grouping; Comms Hub product inbox (`/v1/comms/*` + UI + IN_APP/EMAIL). Second-pass: sibling sat + Finance links i18n/enable; Comms unread/author i18n; CP-CFG-01 self-URL note. CP-COMMS-01 **API/SCREEN** (not SHIPPED); AC-CP-CHANNELS Scaffold **🟡**; Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched. `READINESS_MATRIX` N/A.

**Closeout (2026-11-06 k) — Sat peer-links parity (no UAT):** mesh `/admin/links` parity + retail POS edition UI; revenue asserts on clinic/F&B/retail money paths; Comms stand migration + orch inbox runtime only. UAT/SHOW/SHIPPED/Pilot/`ga` **not** claimed. AC-CP-CHANNELS Scaffold **🟡**; Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**. `platform.yaml` untouched.

**Closeout (2026-11-06 l) — Acceptance checklist (peer-links + second-pass):** COVERAGE CP-CHANNELS-01 / CP-COMMS-01 actors synced; AC-CP-CHANNELS Scaffold **🟡** (out of BE; human UAT open → not ✅); AC-CP-HOME residual Comms deepen (IN_APP bell user-scope; not Scaffold ✅); UI-BOARD stays **SCREEN**; Sprint `S-CHANNELS*` / `S-COMMS-HUB` synced; Gate ✅ / BE 🟡 / UI 🟡 / Demo 🟡 / Pilot [ ] / Edition `mvp` / Sell **unchanged**. `platform.yaml` `mvp` / `pilot_ready: false` untouched. Engineering `READINESS_MATRIX` N/A (no DELIVERY % / consumer API level change).

**Having routes ≠ UI ready for sell.** Demo/TE stays 🟡 until live sign-off.

---

## Pilot / field

| Item | Status | Evidence |
|------|--------|----------|
| Lab RT (UAT-SMOKE) | [ ] | `era-orchestrator/doc/UAT-SMOKE-PLATFORM.md`, `UAT-SMOKE-RBAC.md` |
| Field checklist | [ ] | — |
| Partner / customer sign-off | [ ] | — |

---

## Architecture residual (honesty)

| Claim | Reality |
|-------|---------|
| One HTTP framework for all industry satellite APIs | **Code cutover** — industry HTTP is Nest (`nest/main.ts`); Next keeps the UI and proxies. Not a BE/UI/Demo/Pilot/Sell change. Gate and rollup stay as they were. No Scaffold ✅ from the move. [industry-satellite-api-nest-migration](../adr/industry-satellite-api-nest-migration.md). |

## Topology / tenancy (honesty)

| Claim | Reality |
|-------|---------|
| SHARED SaaS pool (many orgs, one clinic/hotel DB) | **Not built** (schema-ready + kit filter + two-org UAT outline; pool ops open) — Nafta = DEDICATED/ONPREM; AC-CP-TOPO 🟡 **in BE rollup** (not Scaffold ✅); still not sellable |
| Automated SHARED ⇄ DEDICATED ⇄ ONPREM | **API scaffold only** — PlacementBatch Wave 2 Start→CONFIGURE (recipe + agent lab/compose probe + process log) + SHARED↔ONPREM reject; **not sellable** live migrate |
| Org UUID bind from Super-admin | **API** (CP-BIND-01 / AC-CP-BIND ✅ Scaffold BE) — Sync + kit boot; deny bad token 401; not Pilot / not sell |
| Desired-state runtime config (SSO / PSA / event) | **API** (CP-CFG-01 / AC-CP-CFG ✅ Scaffold BE) via Sync → industry + Finance Nest; deny missing Bearer / short SSO; not Pilot |
| Additive `organizationId` on satellite tenant rows | **API** (CP-TENANT-01) — clinic/hotel/fnb/retail roots + kit filter; UAT outline in clinic UAT-SMOKE (pending field); not a live SHARED pool |
| Mix hotel DEDICATED + clinic SHARED | Allowed **sales shape** after endpoints+events; not Nafta default; not demoable as one DB |
| Source license SKU | Commercial offer, not a topology — not in edition yaml yet |
| License term by topology | **API + SuperAdmin UI** (CP-LIC-01) — SHARED=system trial; DEDICATED/ONPREM=no trial + perpetual until admin sets a date. Not a SHARED pool. ONPREM remote term only while cloud CP is reachable |

Canon: [`docs/adr/deployment-topology.md`](../adr/deployment-topology.md).

## Sell / show rules

- Edition column copies `docs/editions/platform.yaml`.
- Sell text must not contradict the worst layer above.
- Forbidden: «ready» / «GA» while Pilot field open or Demo ❌.
- Forbidden: «SaaS multi-tenant» / «one-click on-prem migrate» while AC-CP-TOPO is not Scaffold ✅ / Pilot-ready. Later TOPO ✅ still does **not** sell the pool without a separate sell claim.
- Forbidden: treating CP-BIND/CFG/TENANT/PLACE API as Pilot-ready SHARED pool.
