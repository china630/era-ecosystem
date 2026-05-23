# 20. Seat licensing (ERA Core ↔ satellite)

> Монетизация лимитов пользователей отеля. Операционный RBAC остаётся **локально в сателлите** ([09-master-data.md](09-master-data.md) §9.6).

## Принцип

| Уровень | Где | Что |
|---------|-----|-----|
| Аутентификация | Сателлит | Логин/пароль, JWT, роли Receptionist, HK, … |
| Квоты мест | ERA Core | Сколько **ACTIVE** users может иметь организация по Tier |
| SSO | ERA Core → сателлит | Только `Financial_Auditor` (read-only), `isCrossSystem=true`, не считается в квоту |

## Check seat (перед create user)

**Request** `POST /v1/licensing/seats/check` (ядро) или mock `POST /api/integration/mock-licensing` (dev):

```json
{
  "organizationId": "nafta-sanatorium-org",
  "satelliteType": "hotel_pms"
}
```

**Response 200:**

```json
{
  "allowed": true,
  "tier": "Tier1",
  "seatsUsed": 4,
  "seatsLimit": 10
}
```

**Response 403:**

```json
{
  "allowed": false,
  "message": "Quota exceeded. Upgrade tier in ERA Finance."
}
```

## Env (сателлит)

- `ERA_CORE_LICENSING_URL` — URL ядра или local mock
- `ERA_CORE_API_KEY` — optional Bearer
- `LICENSING_SEAT_LIMIT` — fallback when URL empty (dev)

## Implementation

- [`src/lib/licensing/client.ts`](../../src/lib/licensing/client.ts)
- [`app/api/admin/users/route.ts`](../../app/api/admin/users/route.ts) — вызывает check перед `User.create`
- Cross-system users (`Financial_Auditor` via SSO) skip quota
