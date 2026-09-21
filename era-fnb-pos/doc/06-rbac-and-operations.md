# 06. RBAC and operations

**Canon:** [docs/adr/fnb-domain-permissions-and-rbac.md](../../docs/adr/fnb-domain-permissions-and-rbac.md)  
**SSOT keys:** `era-fnb-pos/src/lib/auth/permissions.ts`

## Model (Variant A)

| Layer | Rule |
|-------|------|
| Role | Package of grants (`Role.permissionsJson`). Name grants nothing. |
| Door | `api:*` / `screen:*` / `admin:*` via `denyUnlessPermission` / page middleware |
| Bypass | Platform super-admin + OrgOwner only — **never** PIN sessions; **FB_MANAGER does not bypass** |
| PIN | `StaffRoster.pinRole` → same FB_* package; requires bound `outletId` |
| Kafe | Waiter template omits `api:tickets.pay` |

## System roles

| Role | Code | Notes |
|------|------|-------|
| Waiter | `FB_WAITER` | Floor/orders; hotel may pay; kafe cannot |
| Cashier | `FB_CASHIER` | Till + pay |
| Kitchen | `FB_KITCHEN` | KDS only |
| Manager | `FB_MANAGER` | Ops + admin + matrix |

Custom roles: clone on `/admin/access` (e.g. head waiter). Doc-era `FB_HEAD` / `FB_VIEWER` are not seeded.

## Audit

| Event | Log |
|-------|-----|
| Void line/ticket | user, reason, before/after |
| Discount | user, %, amount |
| Z-close | snapshot totals |
| Role permissions PATCH | `ROLE_PERMISSIONS_PATCH` satellite audit |

## Operational day

| Time | Action |
|------|--------|
| Morning | Open POS shift (`api:shifts.open`) |
| Day | Tickets |
| Evening | Z-close (`api:shifts.close`) |
| Night | PMS night audit (block if POS shift open) |
