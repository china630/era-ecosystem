# UAT smoke — Control plane RBAC (§2.1)

Prerequisites: orchestrator API `:4100`, Finance API with `ERA_AUTH_MODE=control-plane`, `ERA_CONTROL_PLANE_RBAC_PROXY=true`.

## 1. Memberships and switch-org

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:4100/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo.owner@erafinance.local","password":"DemoLocal#2026"}' \
  | jq -r .accessToken)

curl -s http://127.0.0.1:4100/memberships -H "Authorization: Bearer $TOKEN" | jq .

ORG_ID=$(curl -s http://127.0.0.1:4100/memberships -H "Authorization: Bearer $TOKEN" | jq -r '.[0].organizationId')
curl -s -X POST http://127.0.0.1:4100/auth/switch-organization \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"organizationId\":\"$ORG_ID\"}" | jq -r .accessToken
```

Finance proxy (same Bearer):

```bash
curl -s http://127.0.0.1:4000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq .organizations
curl -s -X POST http://127.0.0.1:4000/api/auth/switch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"organizationId\":\"$ORG_ID\"}" | jq .user.organizationId
```

## 2. Join-org and access requests

```bash
curl -s -X POST http://127.0.0.1:4100/auth/join-org \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taxId":"9900000002","message":"RBAC smoke"}'

curl -s http://127.0.0.1:4100/team/access-requests -H "Authorization: Bearer $TOKEN" | jq .
```

## 3. Entitlements validate

```bash
curl -s -X POST http://127.0.0.1:4100/internal/v1/entitlements/validate \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId":"'"$ORG_ID"'","moduleKey":"industry_fnb_pos"}' | jq .
```

## Deny (Green Scaffold BE Wave 7 — AC-CP-AUTH)

Proof suites: `era-orchestrator/apps/api/src/auth/cp-auth-negative.spec.ts`.

1. `GET /memberships` **without** `Authorization: Bearer` → **401**.
2. `GET /memberships` with garbage Bearer → **401**.
3. `POST /auth/sso/exchange` with valid shape but **spoofed signature** → **401** (never trusts client role).

Optional curl:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4100/memberships
# expect 401

curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:4100/auth/sso/exchange \
  -H "Content-Type: application/json" \
  -d '{"email":"spoof@example.com","organizationId":"00000000-0000-4000-8000-000000000001","expiresAt":9999999999,"signature":"00"}'
# expect 401
```

## 4. Org permission matrix (Wave 4 — AC-CP-RBAC, not SHOW)

UI: `/settings/access` (Owner/Admin with `screen:settings.access`). ADR: `docs/adr/cp-domain-permissions-and-rbac.md`.

1. Open **Settings → Access**. Confirm system roles listed (OWNER…PARTNER).
2. Select **HR_MANAGER** → uncheck `api:workforce.hire` → Save. Confirm session refresh toast/token update.
3. As that HR user (or after re-login): `POST /platform/v1/workforce/employments/hire` → **403**. Re-check hire → 2xx.
4. Select **ADMIN** → uncheck all grants → Save. Admin screens/APIs **403** — must **not** fall back to full role template. **Reset to defaults** restores template.
5. PATCH with locked key `api:org.transfer_ownership` or `api:workforce.bootstrap` → **400**.
6. Clone role `CHIEF_HR` from `HR_MANAGER`; invite with `organizationRoleCode=CHIEF_HR`. JWT `role` donor remains `HR_MANAGER` (Finance until Wave 5).
7. Finance note: stripping `api:ledger.post` in CP matrix does **not** yet block Finance GL (Wave 5).
8. DEPARTMENT_HEAD: lists OK; `POST …/employments/hire` and `POST …/scope/bootstrap` → **403**.

Proof suites: `cp-rbac-wave4.spec.ts`, `cp-wf-negative.spec.ts` (deny by grant, not role name).

## Pass

- All calls return 2xx without 5xx
- Finance `switch` returns new `accessToken` with same `organizationId`
- Matrix §2.1 Orch + Fin RBAC rows → **Live**
- Deny steps above return 401 (not 5xx)
- Wave 4 matrix steps 2–5 behave as documented (SCREEN, not SHIPPED)