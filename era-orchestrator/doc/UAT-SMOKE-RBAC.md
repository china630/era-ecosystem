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

## Pass

- All calls return 2xx without 5xx
- Finance `switch` returns new `accessToken` with same `organizationId`
- Matrix §2.1 Orch + Fin RBAC rows → **Live**
- Deny steps above return 401 (not 5xx)
