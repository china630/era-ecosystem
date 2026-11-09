# Platform — Implementation Matrix (AC / Scaffold BE)

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md) §3.2  
**Not readiness:** for sell/show/UI use [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**Coverage facts:** [`COVERAGE_MATRIX.md`](../COVERAGE_MATRIX.md)

**Legend:** Scaffold ✅ / 🟡 / `[ ]` · Pilot-ready `[x]` / `[ ]` / ⏸  
**Scaffold ✅** only with PRD wording + negative path + no Critical residual + not field-intent.

**BE deepen (2026-08-17):** Green Scaffold BE Wave 7 — `era-orchestrator/apps/api/src/**/cp-*-negative.spec.ts` (AUTH/BILL/MDM/WF/SA/INT/BIND/CFG).  
**Night-audit enqueue (2026-10-31):** BullMQ job id replaces `:`, including clinic and staff fan-out. Not a new AC row and not Scaffold ✅. FIN-02 stays HEADLESS. Does not change the BE rollup.  
**Wave 8 (2026-08-18):** TOPO briefly excluded; **reverted same day** — owner: TOPO stays **in** BE rollup as 🟡. Playbook: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md).

---

## AC rollup

| AC ID | Intent (PRD) | Scaffold | Pilot-ready | Proof | Notes / COVERAGE |
|-------|--------------|----------|-------------|-------|------------------|
| AC-CP-AUTH | Auth / SSO / hybrid RBAC | ✅ | [ ] | `cp-auth-negative.spec.ts`; UAT-SMOKE-RBAC § Deny | Negative: missing/invalid Bearer 401; spoofed SSO signature 401. Launch URL (CP-LAUNCH-01) still API / no UAT SHIPPED |
| AC-CP-RBAC | Org-scoped Variant A permission matrix (CP doors) | 🟡 | [ ] | `cp-rbac-wave4.spec.ts`; UAT-SMOKE-RBAC §4; ADR cp-domain-permissions | **Out of BE rollup** (like HOT/CLI-RBAC). SCREEN until field UAT. Do not flip AC-CP-AUTH. |
| AC-CP-BILL | Billing / entitlements / subscription | ✅ | [ ] | `cp-bill-negative.spec.ts`; `billing-toggle-tier.spec.ts`; `billing-satellite-notify.spec.ts`; `pricing-catalog-canon.spec.ts`; `entitlements.service.spec.ts`; `admin-billing.coverage.spec.ts`; kit `satellite-billing-gate.test.ts`; `module-grace.service.spec.ts`; CP-BILLING | Negative: SUBSCRIPTION_MISSING 403; foreign invoice 403; non-owner billing 403; HARD_BLOCK write 402 (orch matrix + kit satellite gate, CP-BILL-BLOCK-01); coverage date in the past 400 (CP-BILL-COVER-01). Catalog XOR 2026-09. TIER_3 does not block à-la-carte. Module-change → best-effort `syncForOrg` ([ADR](../adr/billing-module-change-satellite-sync.md)). **2026-11-03:** lifetime 7d SKU grace + late-month confirm + structured invoice dims (CP-GRACE-01 / CP-BILL-LINES-01) — deepen only; does **not** reopen Scaffold; UAT open |
| AC-CP-MDM | MDM natural person identity | ✅ | [ ] | `cp-mdm-negative.spec.ts`; ORCH-MDM-* | Negative: missing/wrong internal service token → 401. **2026-11-10** phone polish + dedup queue are **AC-CP-MDM-DEDUP** and do not reopen this ✅ |
| AC-CP-WF | Workforce hub (hire, absence, seats, security) | ✅ | [ ] | `cp-wf-negative.spec.ts`; `workforce-timesheets.month.spec.ts`; `workforce-provision.reprovision.spec.ts`; `roster-cycle.util.spec.ts`; `workforce-roster.materialize.spec.ts`; `workforce-holding.spec.ts`; `workforce-personnel-orders.wave4.spec.ts`; `workforce-attendance.wave6.spec.ts`; `workforce-attendance.wave9.spec.ts`; `workforce-attendance.wave10.spec.ts`; `attendance-minute-buckets.util.spec.ts`; `workforce-self.wave12.spec.ts`; `workforce-fitness.wave13.spec.ts`; `workforce-migration.service.spec.ts`; `workforce-manual-grant.service.spec.ts`; CP-WF-* | Negative: hire role deny 403; PLATFORM_WORKFORCE_REQUIRED 403; second active manual grant 409 `GRANT_ALREADY_ACTIVE`. Unchecking a satellite revokes linked and orphan grants for that key; reprovision heals an orphan active grant and emits MANUAL_GRANT last. **Evrostar wave 3** federated HR (`CP-WF-GROUP-01` = API); **wave 4** order templates (`CP-WF-ORD-02` = API); **wave 6** attendance FaceID ingest (`CP-WF-ATT-01` = API, not SHIPPED); **wave 9** live floor (`CP-WF-FLOOR-01` = API); **wave 10** minute buckets (`CP-WF-MIN-01` = API); **wave 12** employee cabinet (`CP-WF-SELF-01` = API) — [evrostar-wave-12.md](../runbooks/evrostar-wave-12.md); **wave 13** fitness files (`CP-WF-FIT-01` = API) — [evrostar-wave-13.md](../runbooks/evrostar-wave-13.md); **CP-WF-MIG-01** migration wizard API+SCREEN (not SHIPPED) — [evrostar-wave-6.md](../runbooks/evrostar-wave-6.md). **Job architecture** deepen = separate **AC-CP-WF-JOB** 🟡 (does not reopen hub Scaffold ✅) |
| AC-CP-WF-JOB | Job architecture (grades/jobs, position parent, solid/matrix managers, org-chart, extended approval step kinds) | 🟡 | [ ] | `workforce-reporting.resolve.spec.ts`; `workforce-reporting.assignees.spec.ts`; `workforce-jobs.service.spec.ts`; `workforce-positions.service.spec.ts` (parent cycle / self-parent); `workforce-employments.reporting.spec.ts` (self-manager); ADR [cp-workforce-job-architecture](../adr/cp-workforce-job-architecture.md); CP-WF-JOB-01 | **Out of BE rollup** until UAT-SMOKE. Negatives: `GRADE_IN_USE` on archive; position parent cycle / self-parent 400; employment cannot manage itself; hire/org-unit manager must be ACTIVE in scope. OrgOwner SCREEN `/job-architecture` + `/org-chart` + positions/employments (hire+card reporting)/hr-settings/org-structure; nav paths gated workforce package `org`. Not Scaffold ✅; not Pilot; COVERAGE Status=**API** |
| AC-CP-SA | Super-admin platform ops | ✅ | [ ] | `cp-sa-negative.spec.ts`; UAT-SMOKE-PLATFORM § Deny | Negative: non-super-admin → 403. **2026-11-03:** canonical UI = `platform.era-365.online`; client `app` `/super-admin/*` redirects (CP-SA-CONSOLE-01 cutover). API negatives unchanged; does not reopen Scaffold; Pilot still open |
| AC-CP-INT | Integration audit boundaries (MDM/hub/events) | ✅ | [ ] | `cp-int-negative.spec.ts` + `npm run audit:integration:strict` | Negative: catalog gateway wrong/missing token 401; CI audit gate |
| AC-CP-BIND | Satellite org UUID bind + sync endpoints | ✅ | [ ] | `cp-bind-negative.spec.ts`; ADR satellite-organization-bind | Negative: POST organization/bind bad/missing Bearer → 401 |
| AC-CP-CFG | Desired-state runtime config push (SSO secret, PSA, event URL/token) | ✅ | [ ] | `cp-cfg-negative.spec.ts`; CP-CFG-01 | Negative: runtime-config without Bearer 401; short SSO (<16) 400; Sync omits short/folklore secret; **self `publicBaseUrl` = SatelliteEndpoint** (not orch public). CP-PEER-01 (`peer-endpoint`) API deepen 2026-10-27 — does not reopen Scaffold; Pilot open |
| AC-CP-TOPO | SHARED/DEDICATED/ONPREM placement + org slice + hops | 🟡 | [ ] | ADR §4–§5; SuperAdmin `platform…/orgs/{id}/placement` (table + next-step UI; create modal; i18n); SHARED↔ONPREM reject; Wave 7 lab hop; Wave 11 hotel curated JSON slice | **In BE rollup.** Lab: [`reports/placement-lab-hop-signoff.md`](../../reports/placement-lab-hop-signoff.md). Not Scaffold ✅ (host apply + field UAT open). Not SaaS pool sellable. [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md) |
| AC-CP-ORG-PROFILE | Org legal/branding profile (multi-contact, logo; Sync to satellites) | 🟡 | [ ] | ADR [cp-organization-profile-and-branding.md](../adr/cp-organization-profile-and-branding.md); `organization-profile.service.spec.ts`; kit `org-profile.test.ts`; CP-ORG-PROFILE-01; backfill; F&B/Retail `org-print-contacts` + Outlet contact columns | **Out of BE rollup** until Pilot UAT. Negatives: duplicate primary PHONE 400; invalid +994 400; non-member 403; DEPARTMENT inherits parent phone when empty / own phone wins. Finance legal PATCH/logo → `ORG_PROFILE_MOVED_TO_CONTROL_PLANE`; primary bank → orch `bankLine`; hotel/clinic header locks when CP Sync present; F&B/Retail pay `printChrome` + outlet overlay. Not Scaffold ✅. |
| AC-CP-CHANNELS | Satellite integration channels (folio/settlement/revenue/ops-handoff policy graph) | 🟡 | [ ] | ADR [satellite-integration-channels.md](../adr/satellite-integration-channels.md); `cp-channels-negative.spec.ts`; kit `satellite-channels.test.ts`; CP-CHANNELS-01; [`reports/platform-channels-harden-signoff.md`](../../reports/platform-channels-harden-signoff.md); hotel `hotel-page-route-inventory` `/admin/links`→SETTINGS | **Out of BE rollup** until human UAT-SMOKE signed. Negatives: acceptor-only; missing row; OWN self REVENUE; PARENT no self; ACCEPTOR survives; finance suspend drops PLATFORM revenue; OPS_HANDOFF wholesale→retail. Peer-links parity 2026-11-06: 10 mesh `/admin/links`; retail POS edition folio/settlement UI; money assert **before** F&B CLOSE/Z-close/**hub settle** (SHARED tenant enter); retail PAID/return/hub-settle/Z-close + `events/dispatch`; clinic visit/procedure/lab/hub-settle + `events/dispatch`; room-charge skips revenue; hotel OpsShell links + channel-disabled 403. Call-site OPS_HANDOFF gate TBD. CP-COMMS separate. Not Scaffold ✅; not Pilot. |
| AC-CP-DOC | Organization document register + position route | 🟡 | [ ] | ADR [cp-document-register.md](../adr/cp-document-register.md); `documents.service.spec.ts`; `documents-route.util.spec.ts`; CP-DOC-01 | **Out of BE rollup.** Negatives: second start; empty seat waits for assign; wrong seat; register non-draft; skip below amount; chain hole `DOC_ROUTE_GAP`; layout point for an unknown step `DOC_LAYOUT_STEP`; file add or replace after start `DOC_FILE_LOCKED`; reply to self or a draft `DOC_REPLY_SELF` / `DOC_REPLY_UNREGISTERED`; return to a later step `DOC_RETURN_STEP`; step edit while an OPEN route uses the template `DOC_TEMPLATE_IN_USE`. Canvas does not redefine the route. Not Scaffold ✅. Not Pilot. |
| AC-CP-PAY-METHODS | Org payment methods SoR (KKM-adjacent catalog; Sync to satellites) | 🟡 | [ ] | ADR [managed-lists-vs-enums.md](../adr/managed-lists-vs-enums.md) A3; CP-PAY-METHODS-01; kit `payment-method-catalog`; Finance tenders PUT 410; hotel/clinic/F&B `GET /api/payment-methods` | **Out of BE rollup.** API+SCREEN on SuperAdmin `platform…/orgs/[id]/payments` ModalShell CRUD. **No dedicated negative suite yet** — not Scaffold ✅. DEPARTMENT `fiscalRouting=PARENT` inherits parent methods+devices (banner; no local CRUD). Consumers: hotel desks + clinic settle assert + F&B floor/orders; Finance code-only. Not Pilot. |
| AC-CP-MDM-DEDUP | MDM phone polish + suspected-person queue | 🟡 | [ ] | ADR [era-mdm-natural-person-identity.md](../adr/era-mdm-natural-person-identity.md); kit `normalize-person-phone.test.ts` + `person-name-match`; ORCH-MDM-04 | **Out of BE rollup.** Resolve stores `normalizePersonPhone`; `conflict`/`invalid` reject. Queue: ten hotel keys, dismiss pair, merge button on `platform…/mdm/persons/dedup`. No MDM negative suite for reject/dismiss yet — not Scaffold ✅. Does not reopen AC-CP-MDM. Not Pilot. |
| AC-CP-ACCESS | Org access-key vault | 🟡 | [ ] | ADR [org-access-credentials.md](../adr/org-access-credentials.md); `org-access-credential.service.spec.ts`; ORCH-ACCESS-01 | **Out of BE rollup.** Catalog stores org id + encrypted secret. Empty save is refused. Audit records the connector and whether the secret changed, never the secret. Check returns `calledExternal: false`. Unibank, Access Bank, Bank of Baku refuse save (`CONNECTOR_INACTIVE`). No HTTP negative suite — not Scaffold ✅. Finance/ƏMAS adapters are not switched onto this table. Not Pilot. |

**Edition / wave rollup (BE only)** = worst(AUTH, BILL, MDM, WF, SA, INT, BIND, CFG, TOPO) → **🟡** (TOPO).  
AC-CP-TOPO is **in Scaffold BE rollup** (owner 2026-08-18). Do **not** mark TOPO Scaffold ✅ from API scaffold alone. TOPO ✅ (later) still ≠ SaaS pool sellable.  
**AC-CP-RBAC is out of BE rollup** (matrix SCREEN / field UAT open) — does not darken Scaffold BE.  
**AC-CP-ORG-PROFILE is out of BE rollup** until Pilot UAT (API+SCREEN + negatives landed; not Scaffold ✅).  
**AC-CP-WF-JOB is out of BE rollup** (job architecture API+SCREEN; UAT open; not Scaffold ✅) — does not darken hub AC-CP-WF ✅.  
**AC-CP-CHANNELS is out of BE rollup** (API+SCREEN + negatives; UAT open; not Scaffold ✅) — does not darken BE.  
**AC-CP-DOC is out of BE rollup** (document register API+SCREEN; UAT open; not Scaffold ✅) — does not darken BE.  
**AC-CP-PAY-METHODS is out of BE rollup** (API+SCREEN; negatives + UAT open; not Scaffold ✅) — does not darken BE.

**Civil date labels (2026-10-30, controls 2026-10-31):** Workforce request intervals, the read-only hire date, and the migration “last updated” label render `дд.мм.гггг` via `bakuDateDisplay`. Floor, self-service absence, subscription coverage, and MDM birth-date fields are kit `DatePicker`. Values stay `YYYY-MM-DD`. No Scaffold ✅ / Pilot change.

**Kit CatalogField combobox dismiss (2026-11-02):** SEARCHABLE/ENTITY_REF list portals close on outside `pointerdown`/`focusin`, Escape, and clear (no sticky reopen after ×; `disabled` closes). CLI-37 SHIPPED deepen; not a new AC row; does **not** reopen any Scaffold ✅ / Pilot.

**Kit FieldGroupBox + 1px density (2026-11-02):** `FieldGroupBox`/`FieldPanel` legend-on-border; global label→control 1px; `OPS_HOT` uses `CHIP_*`. CLI-37 SHIPPED deepen; not a new AC; Scaffold/Pilot untouched.  
Do not call this table «product readiness».

### Residual register

| AC | Residual | Severity | Status |
|----|----------|----------|--------|
| AC-CP-AUTH | UAT RBAC lab signoff + launch-url SHIPPED | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-RBAC | Field UAT matrix (Finance Wave 5 grant consume landed — AC-FIN-RBAC) | Code | Out of BE rollup (🟡 SCREEN) |
| AC-CP-BILL | Field / owner billing UAT signoff; UAT-SMOKE UI for satellite HARD_BLOCK banner + 402 and super-admin "covered until"; TIER_3 Buffet toggle **without** manual Sync (E-C.7 + FB-5) — `synced` + F&B CP-first gate | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-MDM | UAT MDM depth / companies UI | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-WF | UAT-SMOKE workforce screens | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-WF-JOB | UAT-SMOKE job-architecture / org-chart / reporting managers / grade-rank routes | Code | Out of BE rollup; API+SCREEN 2026-10-30; not Scaffold ✅ |
| AC-CP-ORG-PROFILE | UAT-SMOKE OrgOwner profile + satellite print prefer CP; dual-edit cutover + F&B/Retail chrome | Code | Out of BE rollup; API+SCREEN 2026-10-27; Track A/C 2026-10-28; not Scaffold ✅ |
| AC-CP-SA | UAT-SMOKE-PLATFORM lab signoff | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-SA | Reference settings screen UAT (`/super-admin/reference` + `platform…/reference`) | Code | Same SuperAdmin guard; no separate negative spec; not SHIPPED |
| AC-CP-SA | Vendor console host cutover (`CP-SA-CONSOLE-01`) | Code | **2026-11-03:** app redirects to platform landed; UAT-SMOKE / SHOW still open (not SHIPPED) |
| AC-CP-BILL | SKU grace + structured lines + operator Finance bridge (CP-GRACE/BILL-LINES/OP-FIN) | Code | Grace unit specs; owner invoice Org→Sat→Outlet tree landed; live operator AR still open; not new Scaffold row |
| AC-CP-HOME | Control Home + Structure + Comms inbox (CP-HOME/STRUCTURE/OUTLET/COMMS) | Code | **Out of BE rollup as separate AC** — API+SCREEN; `cp-structure-negative.spec.ts` + `comms-negative.spec.ts` (empty recipients 400; cross-org 403); Comms persist+notify + IN_APP bell scoped to JWT user 2026-11-06; stand `comms_*` migrated (orch image next ship); structure lab [`reports/platform-structure-owner-ux-signoff.md`](../../reports/platform-structure-owner-ux-signoff.md); Comms UAT open → not Scaffold ✅ / not SHIPPED |
| AC-CP-CHANNELS | UAT-SMOKE SA Channels + `/admin/links` + bridge off on hotel | Code | Out of BE rollup; AC 🟡; not Scaffold ✅ |
| AC-CP-PAY-METHODS | Negative suite (disabled/unknown code refuse; PARENT inherit; Finance 410) + UAT org-hub CRUD + satellite desk pick | Code | Out of BE rollup; AC 🟡; COVERAGE API; not Scaffold ✅ |
| AC-CP-INT | Integration audit residual shrink (ongoing) | Code | Gate G1 + negative suite |
| AC-CP-BIND | UAT bind smoke / field isolation | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-CFG | UAT runtime-config signoff | Code | Out of Scaffold ✅ (Pilot) |
| AC-CP-TOPO | Live slice dump + host apply + field migrate UAT (pool ops = later sell) | Code | Wave 7 hop + Wave 11 hotel JSON lab; residual = host apply + field |

### Negative-path proof index

| Suite | AC |
|-------|----|
| `era-orchestrator/apps/api/src/auth/cp-auth-negative.spec.ts` | AC-CP-AUTH |
| `era-orchestrator/apps/api/src/billing/cp-bill-negative.spec.ts` | AC-CP-BILL |
| `era-orchestrator/apps/api/src/billing/module-grace.service.spec.ts` | AC-CP-BILL (CP-GRACE-01 deepen; late-month / trial skip) |
| `era-orchestrator/apps/api/src/channels/cp-channels-negative.spec.ts` | AC-CP-CHANNELS (acceptor-only; missing row; OWN self REVENUE; PARENT no self; ACCEPTOR survives; finance suspend drops PLATFORM revenue; OPS_HANDOFF wholesale→retail) |
| `packages/satellite-kit/src/integration/satellite-channels.test.ts` | AC-CP-CHANNELS (`assertRevenueEventForPublish` unknown skip / money fail-closed) |
| `era-orchestrator/apps/api/src/billing/billing-satellite-notify.spec.ts` | AC-CP-CHANNELS (module-change best-effort channel sync) |
| `reports/platform-channels-harden-signoff.md` | AC-CP-CHANNELS lab evidence (human UAT still open) |
| `era-orchestrator/apps/api/src/structure/cp-structure-negative.spec.ts` | AC-CP-HOME / Structure (owner/member/foreign outlet) |
| `era-orchestrator/apps/api/src/comms/comms-negative.spec.ts` | AC-CP-HOME / Comms (empty recipients 400; cross-org recipient 403; non-participant 403) |
| `era-orchestrator/apps/api/src/admin/cp-cfg-negative.spec.ts` | AC-CP-CFG (folklore omit; self `publicBaseUrl` ≠ orch public) |
| `era-orchestrator/apps/api/src/billing/billing-toggle-tier.spec.ts` | AC-CP-BILL (TIER_3 toggle allowed; fnb_* pass-through) |
| `era-orchestrator/apps/api/src/billing/billing-satellite-notify.spec.ts` | AC-CP-BILL (Sync after module change; fail → synced false) |
| `era-fnb-pos/__tests__/fnb-buffet-planner.spec.ts` | AC-CP-BILL / F&B (CP-first submodule; partial snapshot → local) |
| `packages/satellite-kit/src/tenancy/desired-state-pull.test.ts` | AC-CP-CFG adjacent (pull `onSharedOrgSnapshot`) |
| `era-orchestrator/apps/api/src/billing/pricing-catalog-canon.spec.ts` | AC-CP-BILL (catalog XOR / Resort 188.70) |
| `era-orchestrator/apps/api/src/entitlements/entitlements.service.spec.ts` | AC-CP-BILL (SOFT/HARD matrix 402) |
| `era-orchestrator/apps/api/src/admin/admin-billing.coverage.spec.ts` | AC-CP-BILL (covered until: past date 400, lifts block) |
| `packages/satellite-kit/src/billing/satellite-billing-gate.test.ts` | AC-CP-BILL (satellite gate 402 / 503 fail-closed writes) |
| `era-orchestrator/apps/api/src/mdm/cp-mdm-negative.spec.ts` | AC-CP-MDM |
| `era-orchestrator/apps/api/src/platform/workforce/cp-wf-negative.spec.ts` | AC-CP-WF |
| `era-orchestrator/apps/api/src/platform/workforce/workforce-manual-grant.service.spec.ts` | AC-CP-WF (duplicate grant 409; `revoked=false` stays false) |
| `era-orchestrator/apps/api/src/platform/workforce/workforce-provision.reprovision.spec.ts` | AC-CP-WF (satellite uncheck revokes linked + orphan grants; heal; MANUAL_GRANT emits last) |
| `era-orchestrator/apps/api/src/platform/workforce/workforce-reporting.resolve.spec.ts` | AC-CP-WF-JOB (lineManager / chain / matrix / skip-self) |
| `era-orchestrator/apps/api/src/platform/workforce/workforce-reporting.assignees.spec.ts` | AC-CP-WF-JOB (step kind assignees) |
| `era-orchestrator/apps/api/src/platform/workforce/workforce-jobs.service.spec.ts` | AC-CP-WF-JOB (`GRADE_IN_USE`; org-chart nodes) |
| `era-orchestrator/apps/api/src/platform/workforce/workforce-positions.service.spec.ts` | AC-CP-WF-JOB (parent cycle / self-parent) |
| `era-orchestrator/apps/api/src/platform/workforce/workforce-employments.reporting.spec.ts` | AC-CP-WF-JOB (self-manager) |
| `era-orchestrator/apps/api/src/organization/organization-profile.service.spec.ts` | AC-CP-ORG-PROFILE (duplicate primary; +994; DEPARTMENT inherit / own phone) |
| `packages/satellite-kit/src/organization/org-profile.test.ts` | AC-CP-ORG-PROFILE (print keys + outlet overlay) |
| `era-orchestrator/scripts/lib/org-profile-backfill.spec.ts` | AC-CP-ORG-PROFILE (Finance→orch fill helpers; skip data-URL logo; no overwrite) |
| `era-finance-core/apps/api/src/control-plane/org-profile-bankline.publisher.spec.ts` | AC-CP-ORG-PROFILE (primary bank → orch `bankLine` format) |
| `era-fnb-pos/__tests__/org-print-contacts.spec.ts`, `era-retail-pos/__tests__/org-print-contacts.spec.ts` | AC-CP-ORG-PROFILE (Outlet contact overlay mapper) |
| `era-orchestrator/apps/api/src/admin/cp-sa-negative.spec.ts` | AC-CP-SA |
| `era-orchestrator/apps/api/src/platform/catalog/cp-int-negative.spec.ts` | AC-CP-INT |
| `era-orchestrator/apps/api/src/admin/cp-bind-negative.spec.ts` | AC-CP-BIND |
| `era-orchestrator/apps/api/src/admin/cp-cfg-negative.spec.ts` | AC-CP-CFG |
| `era-orchestrator/apps/api/src/placement/placement-job.service.spec.ts` (SHARED↔ONPREM + Wave 7 advance chain) | AC-CP-TOPO (still 🟡) |

| 2026-11-05 | AC-CP-HOME residual deepen + second-pass (still out of BE, not Scaffold ✅): Structure owner UX + Home summary; token/label/create guards; UAT-SMOKE UI rows; negatives unchanged. No Scaffold ✅ / Pilot / edition change. |
| 2026-11-05 | AC-CP-CHANNELS spine deepen (still 🟡 out of BE): same-org REVENUE_EVENT; revenue publish gates; retail+clinic guest fail-closed; links on finance+retail+ops sats. Negatives extended. No Scaffold ✅ / Pilot / edition change. |
| 2026-11-05 | AC-CP-CHANNELS second-pass (still 🟡): clinic day-doc + hotel money siblings; connect→channel sync; retail edition AUTH_ONLY; module-maps/i18n. No Scaffold ✅ / Pilot / edition change. |
| 2026-11-05 | AC-CP-CHANNELS harden (still 🟡): sync hooks; Resync; money allowlist; shared links; OPS_HANDOFF edges; lab signoff. No Scaffold ✅ / Pilot / edition change. |
| 2026-11-05 | Acceptance closeout checklist (harden): COVERAGE actors; AC 🟡; PRM unchanged; Sprint synced; editions untouched; evidence suites linked. No Scaffold ✅ / Pilot / `ga`. |
| 2026-11-05 | Harden second-pass closeout: connect idempotent channel sync; ModuleRef null-safe; kindOpsHandoff i18n; module-map resync. AC-CP-CHANNELS stays 🟡. No Scaffold ✅ / Pilot / `ga`. |
| 2026-11-06 | AC-CP-CHANNELS thin-spot closeout (still 🟡): F&B/retail money assert before mutate; hotel OpsShell links + SETTINGS inventory; channel-disabled 403; legacy i18n. No Scaffold ✅ / Pilot / `ga`. |
| 2026-11-06 | AC-CP-CHANNELS second-pass closeout (still 🟡): retail shift allowlist + return/hub-settle/Z-close; clinic visit/procedure/lab/hub-settle preflight. No Scaffold ✅ / Pilot / `ga`. |
| 2026-11-06 | Channels+Comms+pool self-URL: `publicBaseUrl`=endpoint; ChannelEdgeCard UX; Comms inbox API+SCREEN (`comms-negative`). AC-CP-CHANNELS/HOME still 🟡; no Scaffold ✅ / Pilot / `ga`. |
| 2026-11-06 | Sat peer-links parity + second-pass closeout (still 🟡): mesh links; retail POS edition UI; F&B hub settle tenant+assert; dispatch asserts; Comms IN_APP user-scoped bell. AC-CP-CHANNELS/HOME 🟡; no Scaffold ✅ / Pilot / `ga`. |
| 2026-11-03 | Control Home wave + closeout: CP-HOME/STRUCTURE/OUTLET/GRACE/BILL-LINES/OP-FIN/COMMS + SA cutover redirects. Second-pass: launch suspend no env fallback; late-month on WorkforceGate/employments; retail CP outlet upsert. AC-CP-BILL/SA stay Scaffold ✅ (deepen only). No new AC Scaffold ✅; TOPO still paints BE 🟡. Pilot/edition unchanged. |
| 2026-11-03 | AC-CP-CHANNELS 🟡 (out of BE rollup): channels API+SCREEN + negatives + bridge gates; second-pass F&B SETTLEMENT + fail-closed edition UI flags; invoice tree deepen on AC-CP-BILL residual; structure negatives on AC-CP-HOME residual. No Scaffold ✅ / Pilot / edition change. |
| 2026-11-03 | Channels UI polish (`ChannelEdgeCard`) + F&B `/admin/links`; deferred debts ADR § + Sprint `S-CHANNELS-*` / `S-COMMS-HUB`. Still AC 🟡; no sell/ga. |
| 2026-11-03 | Channels second-pass: kit export rebuild; ChannelEdgeCard i18n; invoice sat labels; internal `check` route order. AC-CP-CHANNELS still 🟡 out of BE; no sell/ga. |
| 2026-10-30 | AC-CP-WF-JOB 🟡 (out of BE rollup): job architecture API+SCREEN — grades/jobs, position parent/job, employment reporting + hire managers, org-chart, extended route kinds; nav `org` gate; negatives landed; CP-WF-JOB-01 Status=API; Pilot [ ]; does not reopen AC-CP-WF ✅ / Gate / sell. |
| 2026-09-21 | Workforce UI/API hygiene wave: server list q; i18n Group/Roster/Attendance; ModalShell for import/bulk/materialize; nested shifts/attendance. Scaffold stays 🟡 / Pilot [ ] — no UAT-SMOKE claim. |
