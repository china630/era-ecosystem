# ADR: Clinic domain permissions and configurable RBAC (Variant A → C)

**Status:** Accepted — Phase A shipped (Waves 1–3)  
**Date:** 2026-09-01  
**Implementation:** Phase A complete — DB-authoritative API, CLINIC_ADMIN matrix enforcement, full staff ops API catalog (`opsApiRoutePermission`), nav without legacy `roles` fallback. Variant B/C (Orchestrator sync) remain out of scope.

**Related:**

- [cp-workforce-role-templates-and-security-admin.md](./cp-workforce-role-templates-and-security-admin.md) — CP layers 1–3 (hire, position → satellite role)
- [deployment-topology.md](./deployment-topology.md) — ONPREM / DEDICATED / SHARED
- [clinic-product-lines-and-presets.md](./clinic-product-lines-and-presets.md) — preset gating (`sanatorium_clinical`, …)
- [satellite-mutation-audit.md](./satellite-mutation-audit.md) — audit pattern for admin mutations
- Plan: [`.cursor/plans/clinic-domain-permissions-variant-a.plan.md`](../../.cursor/plans/clinic-domain-permissions-variant-a.plan.md)

---

## Context

ERA Clinic ops access is split across **three layers** today:

| Layer | Where | What it controls today |
|-------|--------|-------------------------|
| **CP Workforce** | Orchestrator `/workspace/workforce/security` | Position → satellite **role code** (`DOCTOR`, `RECEPTION`, …) via `SatelliteRoleTemplate` + bindings |
| **Preset / module gate** | Clinic `/admin/settings`, cookie + middleware | Whether whole product lines (e.g. `sanatorium_clinical`) are enabled |
| **Screen / API access** | **Hardcoded** in `clinic-nav.ts`, `middleware.ts`, `requireClinicRole()` | Which routes and APIs each role may use |

The Prisma `Role.permissionsJson` column is the satellite SoR for ops grants. Wave 1 reads it on every API `assertClinicPermission` and on `/api/auth/me`. JWT still snapshots the list for **page** middleware until `POST /api/auth/session/refresh-permissions` or re-login.

Nafta and ONPREM appliances must enforce access **locally** without a live Orchestrator on every request. CP Workforce answers *“which role does this employee get?”* — not *“which screens may RECEPTION open?”*.

Hotel (`era-hotel-pms`) has a partial precedent: string permissions + `permissionsJson` in DB, but API guards still use hardcoded `permissionsForRole()` and there is **no admin matrix UI**. Clinic should not copy that half-state.

Product ask: configurable **role × screen** (and API) matrix editable without code deploy — required for ONPREM and a prerequisite for a future CP-central UI (Variant C).

---

## Decision

### D1 — Phased roadmap: A first (clinic), then C (fleet)

| Phase | Scope | Owner of matrix UI | Runtime enforcement |
|-------|--------|--------------------|---------------------|
| **A (now)** | `era-clinic` only | Clinic SatAdmin `/admin/access` (new) | Clinic DB `Role.permissionsJson` + local guards |
| **B (later)** | Clinic + Orchestrator sync | CP UI for entitled SHARED orgs; ONPREM stays local-first | Same as A — satellite always enforces |
| **C (later)** | Hotel, F&B, … on shared contract | Per topology (see D5) | Each satellite DB; optional CP desired state |

**Phase A is mandatory** for ONPREM. Phase B/C **add** central management; they do **not** replace local enforcement.

### D2 — Domain permission stays in the satellite (Phase A)

1. Introduce a **clinic permission catalog** — stable string keys (`screen:*`, `api:*`).
2. Store effective grants per role in **`Role.permissionsJson`** (JSON array of permission codes).
3. Seed defaults from the **current hardcoded matrix** in `clinic-nav.ts` / middleware / API — zero behaviour change on upgrade until an admin edits a role.
4. Enforce uniformly:
   - **Nav** — `entryVisible` checks permission (no `seesAll` for CLINIC_ADMIN).
   - **Middleware** — page routes map to `screen:*` keys (including `/admin/*`).
   - **API** — `assertClinicPermission` / `assertClinicAdminRoute` + `adminApiRoutePermission`.
5. **Bypass policy:** platform super-admin and OrgOwner (`isOwner` / `BUSINESS_OWNER`) bypass all permission checks. **`CLINIC_ADMIN` does not bypass** — `Role.permissionsJson` is authoritative.

Workforce Security (CP) continues to assign **role codes only**; it does not store screen matrices in Phase A.

### D3 — Permission key convention (clinic namespace)

All keys are lowercase, colon-separated, ASCII:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `screen:` | UI route (App Router page) | `screen:sanatorium.resources` |
| `api:` | API capability (may gate multiple routes) | `api:cashier.settle` |
| `admin:` | SatAdmin screens (alias of `screen:admin.*` for grouping) | `admin:catalog` |

Rules:

- Keys are **product-scoped by repo** (no `industry_clinic:` prefix in JSON — clinic DB is already clinic-only).
- New screens/APIs **must** add a catalog entry before shipping; orphan routes forbidden in module-map.
- **Preset gating is orthogonal** — a permission may exist but nav stays hidden when preset is off (existing `presetEnabled` logic).
- Phase A scope is **screen-level** only; action-level (`api:*:write`) is deferred unless a route already has distinct roles.

Canonical catalog lives in code: `era-clinic/src/lib/auth/clinic-permissions.ts` (SSOT for labels + defaults + nav/API mapping).

### D4 — Default matrix (Phase A baseline)

Defaults mirror [`clinic-nav.ts`](../../era-clinic/src/domain/nav/clinic-nav.ts) and middleware as of 2026-09-01. Summary:

| Role | Typical screens (non-exhaustive) |
|------|--------------------------------|
| `RECEPTION` | appointments, queue, cashier, sanatorium list, resource matrix, … |
| `DOCTOR` | doctor workspace, sanatorium list, nurse roster, lab orders, reports, … |
| `NURSE` | nurse, check-in, lab orders, procedure report, … |
| `FLOOR` | check-in |
| `LAB_TECH` | lab orders |
| `CLINIC_ADMIN` | all ops + `/admin/*` via admin gate |

Top nav (`/`, `/patients`) — all authenticated roles unless explicitly revoked in a custom matrix.

Full key list and role mapping: see plan file § Catalog.

### D5 — Future Variant C sync rules (design now, implement later)

When CP storage is added:

| Topology | Matrix master | Satellite behaviour |
|----------|---------------|---------------------|
| **SHARED** (SaaS pool) | Orchestrator desired state | Pull on login/reprovision; local UI read-only or “managed in workspace” |
| **ONPREM / offline** | Clinic local DB | Optional push to CP when tunnel up; CP never blocks login |
| **Conflict** | Higher `policyVersion` wins | Audit row on both sides |

CP **`Permission` / `RolePermission`** tables are for **platform** identity (orchestrator/finance) — **not** clinic ops keys. Future CP model: `SatelliteDomainPermissionPolicy` scoped by `satelliteKey = industry_clinic` (separate ADR amendment when Phase B starts).

Do **not** extend `STAFF_PROVISIONED` payload with screen lists in Phase A or B-v1; sync uses a dedicated GET (+ optional event `CLINIC_PERMISSION_POLICY_UPDATED`).

### D6 — Admin UI (Phase A)

- Route: **`/admin/access`** (SatAdmin only, same gate as `/admin/settings`).
- Matrix: rows = permission groups (Front desk, Clinical, Sanatorium, Admin, …); columns = clinic roles (`RECEPTION`, `DOCTOR`, …).
- Edit: `CLINIC_ADMIN` or owner; mutations audited via `SatelliteAuditLog` (`entityType: Role`, action `PERMISSIONS_UPDATE`).
- API: `GET/PATCH /api/admin/roles/[code]/permissions` — whitelist keys against catalog; reject unknown codes.
- i18n: `messages/{en,az,ru}.json` for group labels and permission descriptions.

### D7 — Session / performance

- `/api/auth/me` returns `permissions: string[]` from DB for ops roles (incl. CLINIC_ADMIN). OrgOwner / platform super-admin receive `ALL_CLINIC_PERMISSIONS`. `canViewClinicAdmin` = bypass OR any `screen:admin.*`.
- **API handlers** load permissions from DB (`permissionsForUser`) — matrix PATCH is effective immediately.
- **Page middleware** uses JWT `permissions[]`. After `/admin/access` Save, clinic calls `POST /api/auth/session/refresh-permissions` for the current session; other users re-login.
- Middleware edge may cache permission list in JWT only if size stays bounded (<64 keys Phase A).

### Enforcement layers (Waves 1–2)

| Layer | Source | Updates when |
|-------|--------|--------------|
| API | DB `Role.permissionsJson` via `permissionsForUser` | Immediately after matrix PATCH |
| Admin API | `adminApiRoutePermission(pathname)` → screen key | Same as API |
| Nav (`GET /api/auth/me`) | DB (no `seesAll`) | Immediately (admin UI also dispatches `clinic-auth-refresh`) |
| Page middleware | JWT snapshot + `routePermission` (incl. `/admin/*`) | Login / SSO / refresh-permissions |

**Bypass (Wave 2):**

| Actor | Bypass all permissions? |
|-------|-------------------------|
| Platform super-admin | Yes |
| OrgOwner / `BUSINESS_OWNER` | Yes |
| `CLINIC_ADMIN` | **No** — matrix applies |
| Other ops roles | No |

**Wave 1 shipped:** `api:sanatorium.episodes.read` + write on episodes list/detail/schedule/program-templates; `POST /api/procedures` requires `api:procedures.reception`; RECEPTION has `api:sanatorium.staff_absences`.

**Wave 2 shipped:** CLINIC_ADMIN matrix authoritative for nav, `/admin/*` pages, and admin APIs (`assertClinicAdminRoute`); residual clinical `hasClinicAdminRole` overrides replaced with permission keys.

**Wave 3 shipped:** coarse staff API keys + `opsApiRoutePermission` / `assertOpsApiPermission`; appointments/queue/patients/lab/visits/inpatient/MDM/ICD/ops catalogs guarded; `navEntryPermission`; no `roles` fallback in `entryVisible`; i18n permission labels on `/admin/access` (keys escape `.` → `_` for next-intl nesting); Implementation-Matrix `AC-CLI-RBAC` 🟡 (out of BE rollup until field UAT).

**Gap closeout (post–Wave 3):** orphan aliases `/api/lab/import`, `/api/imaging-phrases`, `/api/templates` gated; ops mapper covers cashier/nurse/sanatorium resource paths + procedures fallback; full `app/api` grep allowlist; `assertClinicAdminRead/Write` require `Request` (no binary no-arg path); `requireClinicRole` removed. Customized `Role.permissionsJson` rows do **not** auto-gain new keys — use Reset to defaults or manual grant after upgrade.

---

## Consequences

### Positive

- ONPREM and dedicated Nafta can tune access without redeploy.
- Single catalog enables honest COVERAGE / UAT role scripts.
- Phase B CP sync becomes import/export of existing JSON — no guard rewrite.
- Aligns with ADR workforce layer 4 (“Domain permission — Satellite”).

### Negative / cost

- One-time migration: ~30 screen keys + ~25 API groups + tests.
- Admins can misconfigure (lock out RECEPTION from cashier) — need “Reset to defaults” per role.
- Dual UI risk when Phase B ships — mitigate with master/slave rules (D5).

### Out of scope — Phase A

- Per-user overrides (use CP ManualGrant + role change today).
- Custom roles beyond fixed `CLINIC_ROLE` enum.
- Orchestrator UI or bidirectional sync (Phase B/C).
- Hotel / F&B / retail satellites (separate waves after clinic proves pattern).
- Action-level CRUD matrix (`create` vs `read`) — Phase A.1 optional.

---

## Compliance

- Mutations: `SatelliteAuditLog` on PATCH permissions.
- Security: API catalog whitelist; no arbitrary JSON keys; admin-only write.
- Tenancy: `Role` is org-global today on dedicated appliance; when SHARED multi-org roles exist, extend to `organizationId` on role or overlay table (note in plan, not Phase A blocker for Nafta dedicated).

---

## Acceptance (Phase A done when)

1. Defaults reproduce current nav + middleware + API behaviour (automated matrix test). ✅
2. `/admin/access` edits persist and affect nav + blocked routes + API 403. ✅ (JWT refresh for pages; DB for API)
3. UAT-SMOKE: RECEPTION denied `screen:sanatorium.nurse_roster`; DOCTOR denied `screen:sanatorium.resources` if unchecked; Wave 2/3 admin + patients/appointments hide. ✅ documented
4. `era-clinic/.cursor/rules/era-clinic-module-map.mdc` lists `/admin/access` + permission API + `opsApiRoutePermission`. ✅
5. `npm run check:acceptance` PASS after COVERAGE row update (SatAdmin + OpsUI). ✅
