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

## Construction UI (modal CRUD)

- [ ] Login at `/login`
- [ ] `/projects` → **Add project** modal → create project with code, name, amount, optional BOQ line
- [ ] Open `/projects/[id]` → **Subcontractor claim** modal → VÖEN lookup + amount → save claim
- [ ] `/material-requisitions` — create requisition modal and verify it appears on project detail

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
