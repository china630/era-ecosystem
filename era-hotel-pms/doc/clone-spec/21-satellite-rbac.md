# 21. Satellite RBAC (реализация era-hotel-pms)

> Операционные пользователи отеля **только в БД сателлита**. Квоты мест и SSO бухгалтера — через ERA Core ([20-seat-licensing.md](20-seat-licensing.md), §18.11 ниже).
>
> **Variant A (2026-09):** system roles + `/settings/access` matrix; API guards use DB/JWT grants (not role-name templates); `Hotel_Admin` does **not** bypass. Canon: [hotel-domain-permissions-and-rbac.md](../../../docs/adr/hotel-domain-permissions-and-rbac.md).

## Принцип

| Уровень | Механизм |
|---------|----------|
| Аутентификация | Логин + пароль (scrypt), JWT 12h |
| Сессия | httpOnly cookie `era_session` или `Authorization: Bearer` |
| Авторизация | `Role.permissionsJson` (valid JSON array is authoritative, incl. empty) + session grants |
| Квоты | `POST /api/admin/users` → licensing check |
| SSO | `POST /api/auth/sso/exchange` → `Financial_Auditor`, `isCrossSystem=true` |
| Access matrix | `/settings/access` (`admin:access_manage`); clone custom roles |

ERP **не хранит** пароли портье и горничных.

## Роли сателлита (маппинг со спеки §9.6)

| Код в коде | Назначение | База Elektraweb |
|------------|------------|-----------------|
| `Hotel_Admin` | Справочники, users, все модули | Admin |
| `Manager` | Void, cancel, night audit, master data | Manager |
| `Receptionist` | Бронь, check-in/out, folio, касса | Reception |
| `NightAuditor` | Night audit, no-show, отчёты | Night Auditor |
| `Housekeeper` | HK tasks, статусы номеров | HK Supervisor |
| `Doctor` | Medical contour | Doctor |
| `CRM` | Channel, read reservations | CRM |
| `Financial_Auditor` | Read-only folio/reports (SSO) | исключение |

Матрица в коде: [`src/lib/auth/permissions.ts`](../../src/lib/auth/permissions.ts).

## Permissions (кратко)

Fleet-canon keys (Wave 2). Map: `src/lib/auth/hotel-permission-rename.ts`.

| Permission | Типичные роли |
|------------|---------------|
| `api:reservations.read/write/checkin/checkout/cancel` | Reception, Manager, NightAuditor |
| `api:folio.read/charge/payment` | Reception, Manager |
| `api:folio.void` | Manager, Hotel_Admin |
| `api:rooms.status` | Reception, Housekeeper, Manager |
| `api:housekeeping.manage` | Housekeeper, Manager |
| `api:medical.manage` | Doctor |
| `api:channel.manage` | CRM, Manager |
| `api:night_audit.run` | NightAuditor, Manager |
| `admin:master_data` | Hotel_Admin, Manager |
| `admin:users` | Hotel_Admin |
| `admin:access_manage` | Hotel_Admin (matrix UI `/settings/access`) |
| `api:reports.read` | NightAuditor, Financial_Auditor |
| `api:cash.shift` | Reception, NightAuditor, Financial_Auditor |
| `api:import.elektraweb` | Hotel_Admin, Manager (+ SKU) |
| `api:integration.elektraweb_bridge` | Hotel_Admin, Manager, Reception, NightAuditor |

## API auth

| Method | Path | Публичный |
|--------|------|-----------|
| POST | `/api/auth/login` | да |
| POST | `/api/auth/logout` | JWT |
| GET | `/api/auth/me` | JWT |
| POST | `/api/auth/sso/exchange` | да (подпись HMAC) |
| POST | `/api/admin/users` | `admin:users` + seat check |
| POST | `/api/folios/charges/:chargeId/void` | `api:folio.void` |

Middleware ([`middleware.ts`](../../middleware.ts)): все `/api/*` кроме login, sso/exchange, `mock-receiver`, `mock-licensing` требуют JWT. Route handlers дополнительно вызывают `assertPermission`.

## SSO exchange (POST, не GET)

**Request:**

```json
{
  "email": "auditor@era.az",
  "fullName": "GL Auditor",
  "organizationId": "nafta-sanatorium-org",
  "expiresAt": 1717000000,
  "signature": "<hex hmac-sha256>"
}
```

**Подпись:** `HMAC-SHA256(ERA_SSO_SHARED_SECRET, "{email}|{organizationId}|{expiresAt}")` → hex.

**Response:** JWT + cookie, роль `Financial_Auditor`. Пользователь `isCrossSystem=true` — не учитывается в seat quota.

## UI (защищённые страницы)

| Path | Permission |
|------|------------|
| `/login` | публичный |
| `/` | chessboard |
| `/bookings/new` | `api:reservations.write` |
| `/folio/[reservationId]` | `api:folio.read` |
| `/admin/users` | `admin:users` |
| `/admin/master-data` | `admin:master_data` |
| `/housekeeping` | `api:housekeeping.manage` |
| `/operations` | `api:night_audit.run` |
| `/channel` | `api:channel.manage` |
| `/medical` | `api:medical.manage` |
| `/room-plan` | `api:reservations.read` |
| `/reports/occupancy` | `api:reports.read` |

## Env

| Variable | Назначение |
|----------|------------|
| `AUTH_JWT_SECRET` | min 16 chars |
| `AUTH_COOKIE_NAME` | default `era_session` |
| `ERA_CORE_LICENSING_URL` | mock or core |
| `LICENSING_SEAT_LIMIT` | dev fallback |
| `ERA_SSO_SHARED_SECRET` | SSO HMAC |

## Demo users (seed)

| Login | Password | Role |
|-------|----------|------|
| `admin` | `admin123` | Hotel_Admin |
| `reception` | `reception123` | Receptionist |

## Вне scope фазы 1

- 2FA, IP whitelist (WA0341)
- Полная матрица WA0103 notifications
- JWKS для SSO (только shared secret)

## Реализация в репозитории

- [`src/lib/auth/`](../../src/lib/auth/)
- [`app/api/auth/`](../../app/api/auth/)
- [`app/api/admin/users/`](../../app/api/admin/users/)
- Миграция `prisma/migrations/20260523100000_auth_rbac`
