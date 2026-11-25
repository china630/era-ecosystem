# UAT smoke — era-construction





## SSO paths (platform entry � v1.0)

### Owner path (Orchestrator)
1. Login at Orchestrator web: `http://localhost:3000` ([QUARTET_UAT.md](../../docs/QUARTET_UAT.md)).
2. Home → industry tile → **Open** → satellite `/sso/callback` session.
3. Smoke: `node scripts/sso-launch-smoke.mjs` (`ERA_SSO_SHARED_SECRET` aligned).

### Ops path (local)
1. Use this app's `/login` and seed users in sections below.
2. Billing, team, register → Orchestrator only (no satellite `/register`).



- [ ] `GET /api/health` → 200
- [ ] Home page loads
- [ ] `POST /api/events/dispatch` (with orchestrator running)

## Wave 1 pilot path (lab; SCREEN deepen — not SHIPPED / Demo / Pilot / ga)

End-to-end lab contour on existing screens. Requires SKUs `construction_estimate_hierarchy` and `construction_smeta_rate_engine` (or TIER_3). Outside scope: DESN content, Forma PDF, CRM→project, commercial budget.

1. **Rate bases (SatAdmin):** nav **Rate bases** or `/admin/rate-bases` → create base (code/title/unit) → add item with **unit amount > 0** → list shows code, title, unit, amount, kind. With rate SKU off: page shows skuOff (not empty silence). Negatives: amount ≤ 0 refused (`con-smeta-rate-negative`).
2. **Estimate apply:** `/projects/[id]` hub **Estimate** → mode `ESTIMATE_HIERARCHY` → set/save **Finance contract id** (trim) → new package → leaf LCR/SC → **Apply rate** (item + qty) → line appears. If rate SKU off: muted SKU-off note (not silent hide). If bases empty: CTA to `/admin/rate-bases`.
3. **Approve package:** status buttons use i18n labels → INTERNAL_REVIEW → EXTERNAL_REVIEW → **Approve**. Success banner: BOQ / plan-fact refresh; with contract id — SOV seed eligible / Finance contract note; without — warning that SOV will not seed.
4. **BOQ / plan-fact:** Ops BOQ shows projected lines; Estimate **Plan vs actual** lists them after refresh.
5. **Progress act → Finance:** hub **Ops** → create draft act → add lines from BOQ → see **lines count + total** → **Save lines** → **Approve act**. UI shows Finance bridge key `construction:{actId}` (journal / WIP — not paid). APPROVED act: lines locked; mutate disabled.
6. **SKU gates check:** estimate hierarchy SKU off → Estimate gate copy; rate SKU off → admin skuOff + Estimate muted note.

Signed UAT / Demo/TE / Pilot-ready / edition `ga` are **not** claimed by this path alone — see **Finance bridge verify** + Pilot W2 signoff.

## Finance bridge verify (Pilot W2; SCREEN — not SHIPPED)

Requires orch + Finance workers. Lab URLs: Construction `:3302`, Finance web `:3100` ([ECOSYSTEM_URLS](../../docs/ECOSYSTEM_URLS.md)).

- [ ] Estimate approve with `financeContractId` → message shows `/contracts/{id}` SOV verify hint
- [ ] Finance `/contracts/{id}` SOV editor shows seeded lines (or empty + `sovSeedHint` if seed missed)
- [ ] Act approve → message shows `/reporting/journal` + reference `construction:{actId}`
- [ ] Finance `/reporting/journal` (period covering approve) lists a transaction with that reference; re-approve is idempotent
- [ ] Signoff: [`reports/construction-pilot-w2-lab-signoff.md`](../../reports/construction-pilot-w2-lab-signoff.md)

## Pilot W3 — PayApp / KS + materials soft-ref (SCREEN; not SHIPPED)

Requires SKU `contract_payapp_ks` on Finance org. After W2 bridge works:

- [ ] Approved act shows PayApp bridge hint; paste Finance PayApp id → **Save PayApp ref**
- [ ] Finance `/pay-applications` → create from contract SOV (`fromSov`) → detail lifecycle
- [ ] Open `/print/ks2/{payAppId}` and `/print/ks3/{payAppId}`
- [ ] `/admin/rate-bases`: item form **Hub material code** (SEARCHABLE); save persists `materialCode` (hub may be empty if gateway down)

## Pilot W4 — lab honesty (tenancy + RBAC + Demo TE)

- [ ] SHARED two-org: Org A project/estimate/act invisible to Org B (list + direct GET)
- [ ] Missing grant: Estimate approve / rate-bases / act approve → FORBIDDEN or `/access-denied` (not silent fail)
- [ ] Demo/TE package: [`doc/DEMO-TE-PILOT-W1-W3.md`](./DEMO-TE-PILOT-W1-W3.md) timed run
- [ ] Signoff notes: [`reports/construction-pilot-w4-lab-signoff.md`](../../reports/construction-pilot-w4-lab-signoff.md) — Pilot field / `ga` / SHOW **not** claimed by default

## Construction UI (modal CRUD)

- [ ] Login at `/login`
- [ ] `/projects` → **Add project** modal → create project with code, name, amount, optional BOQ line
- [ ] Open `/projects/[id]` → hub **Claims** tab → claim modal → VÖEN lookup + amount → save claim
- [ ] `/material-requisitions` — create requisition modal and verify it appears on project **Overview** with status control

## Wave 2 MVP vertical slice (SCREEN; not SHIPPED)

- [ ] `/projects/[id]` hub **Ops** tab: add BOQ line → create draft act → add lines → **Save lines** → **Approve act**
- [ ] Hub **Overview** plan vs actual shows **Actual qty (acts)** after approve
- [ ] `/field-ops`: pick project → daily log + punch create/status
- [ ] **Finance smoke (dev):** with orch + Finance workers up, approve once → journal `reference=construction:{actId}` (WIP/AR); re-approve / re-deliver event → same journal (`idempotent: true` meta). Boundary unchanged — no ledger in construction.

## Wave 3 depth (SCREEN; not SHIPPED)

- [ ] `/projects/[id]` hub **Depth** tab: add party → publish sheet (supersedes prior CURRENT) → create/answer RFI → submittal status cycle (incl. Reject / Revise→resubmit) → fail inspection (punch appears) → change request → Approve ops (Finance contract id is ref only)
- [ ] Hub **Ops** punch: pin to CURRENT sheet + x/y; daily log weather CatalogField + submit

## Estimate hierarchy M20 (SCREEN; not SHIPPED)

- [ ] `/projects/[id]` hub **Estimate** tab: set mode `ESTIMATE_HIERARCHY` → save **Finance contract id** → new package → add SSR/OCR/LCR → lines on LCR (or **Import CSV**) → INTERNAL_REVIEW → EXTERNAL_REVIEW → **Approve**
- [ ] After approve: Ops BOQ shows projected lines; Estimate **Plan vs actual** lists them
- [ ] Same org: second project stays `FLAT_BOQ` and uses Ops BOQ only
- [ ] Event `SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED` carries `lines[]`; Finance seeds Contract SOV when `financeContractId` set (empty SOV); replay is idempotent; manual SOV is not wiped

## CN-SMETA-RATE-01 — Rate engine (SCREEN; not SHIPPED)

Requires SKU `construction_smeta_rate_engine` (or TIER_3). Negatives: `__tests__/con-smeta-rate-negative.spec.ts`.

- [ ] SatAdmin `/admin/rate-bases`: create base → add COMPOSITE item with unit amount → list shows item
- [ ] Estimate hub (hierarchy pack, leaf LCR/SC): **Apply rate** picks item + qty → line appears with `qty × unitAmount`
- [ ] With SKU off: `/admin/rate-bases` shows skuOff; `POST /api/rate-engine/calc` → 403

## SHARED tenancy (AC-CON-TENANT; lab)

Construction defaults to **SHARED** (many orgs, one deployment). Kit Prisma tenant extension filters by session `organizationId`.

- [ ] Org A: create project `TEN-A-1`. Org B session: `/projects` does **not** list `TEN-A-1`; direct GET by id → not found / empty.
- [ ] Org B: create project `TEN-B-1`. Org A cannot see it on list or hub.
- [ ] Estimate / act / punch created under A stay invisible to B.
- [ ] Unit: `__tests__/con-tenant-shared.spec.ts` (extension + schema org unique).

## Wave 4 product hub (SCREEN; not SHIPPED)

- [ ] Hub tabs: Overview · Estimate · Ops · Depth · Structure · Schedule · Equipment · Claims
- [ ] **Structure:** add phase + location; soft-delete
- [ ] **Schedule:** add task with DatePicker start/end; delete
- [ ] **Equipment:** log hours; list refreshes
- [ ] Claim / requisition status CatalogField only offers legal next steps; amount ≤0 refused
- [ ] Missing grant mutation shows FORBIDDEN copy (not silent fail)

## CN-BIM-01 — BIM lite SKU gate (SCREEN; not SHIPPED)

1. With `construction_bim_lite` (or TIER_3) active: Ops punch, `/field-ops` punch modal, and Depth RFI show IFC + viewer URL fields; chips render on saved rows.
2. Enter a non-http(s) viewer URL → client refuses with `bimViewerInvalid` copy.
3. With BIM SKU off: fields/chips hidden; create punch/RFI still works without BIM props.

## CN-STAFF-01 — CP hire → construction `/login` (SCREEN; not SHIPPED)

Prerequisite: org has `industry_construction`; orch `CONSTRUCTION_API_URL` + `SATELLITE_BRIDGE_SECRET` aligned; construction Nest up.

1. Workspace → Workforce → Employments → Hire (or Login & access): tick **Construction**, set login/`0000` PIN → Save.
2. Fan-out applies `STAFF_PROVISIONED` → construction `POST /api/integration/staff-provision` returns `satelliteUserId`.
3. Open construction `/login` with that `emp-*` login + PIN → staff session works.
4. Untick Construction / deactivate employment → `STAFF_DEACTIVATED` disables the User (idempotent re-run OK).

Evidence: unsigned — **API/SCREEN; not SHIPPED** until field UAT.

## Deny (Scaffold BE negative paths)

1. **Module off → 403:** With `industry_construction` inactive for the session org, `getSatelliteSession()` / `requireConstructionSatellite(org)` fail closed → **403**. Proof: `__tests__/con-prj-negative.spec.ts` (+ mat/plat suites).
2. **Foreign / empty org:** Unbound satellite does not leak cross-org projects/requisitions; gate returns inactive before domain work.
3. **Domain denies:** APPROVED progress act cannot be reopened; material requisition without project → **404**; platform cron secret missing/wrong → unauthorized.

## CN-RBAC-01 — access matrix (SCREEN; not SHIPPED)

ADR: [construction-domain-permissions-and-rbac.md](../../docs/adr/construction-domain-permissions-and-rbac.md). Proof: `__tests__/construction-rbac*.spec.ts`.

- [ ] Log in as `PROJECT_MANAGER` → nav shows **Access** → `/admin/access` lists the six system packages (`SITE_MANAGER`, `ESTIMATOR`, `PROJECT_MANAGER`, `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`).
- [ ] Log in as `ESTIMATOR` → nav has Projects, Field ops and Material requisitions, no Settings / Access; opening `/admin/settings` lands on `/login` with the "no access" message.
- [ ] As `PROJECT_MANAGER`: untick `api:acts.approve` on `SITE_MANAGER` → Save → a site manager's act approve returns 403; **Reset to defaults** restores it.
- [ ] Clone `ESTIMATOR` as `QS_JUNIOR`, untick `api:acts.approve` → assign an estimator user to it in **Assign a role to a user** → that user's approve returns 403; delete `QS_JUNIOR` is refused while the user holds it.
- [ ] `PROJECT_MANAGER` cannot assign `BUSINESS_OWNER` (403); SSO owner can.
