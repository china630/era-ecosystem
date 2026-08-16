# ERA Ecosystem — настройка и запуск

Инструкция по конфигурации и запуску каждого компонента umbrella-репозитория.  
Канонические хосты, порты и env: [`ECOSYSTEM_URLS.md`](./ECOSYSTEM_URLS.md) · Архитектура: [`DESIGN.md`](../DESIGN.md) · SSO и event bus: [`INTEGRATION_SSO_EVENTS.md`](./INTEGRATION_SSO_EVENTS.md)

---

## Содержание

1. [Требования](#1-требования)
2. [Первичная подготовка](#2-первичная-подготовка)
3. [Запуск всего стека в Docker (рекомендуется)](#3-запуск-всего-стека-в-docker-рекомендуется)
4. [Локальная разработка по сервисам](#4-локальная-разработка-по-сервисам)
5. [era-orchestrator (control plane)](#5-era-orchestrator-control-plane)
6. [era-finance-core (data plane)](#6-era-finance-core-data-plane)
7. [era-hotel-pms (satellite)](#7-era-hotel-pms-satellite)
8. [era-fnb-pos (satellite)](#8-era-fnb-pos-satellite)
9. [packages/era-contracts](#9-packagesera-contracts)
10. [SSO и шина событий](#10-sso-и-шина-событий)
11. [Проверка работоспособности](#11-проверка-работоспособности)
12. [Частые проблемы](#12-частые-проблемы)

---

## 1. Требования

| Инструмент | Версия |
|------------|--------|
| Git | 2.x+ |
| Node.js | 20+ (рекомендуется 22 для finance-core) |
| npm | 10+ |
| Docker + Docker Compose | v2+ |

**Порты по умолчанию (локально / Docker):**

| Сервис | Порт | Публичный хост (Traefik) |
|--------|------|--------------------------|
| Traefik dashboard | 8080 | — |
| Orchestrator Web | 3000 | `app.era-365.online` — **ecosystem entry (v1.0): login, industry launcher, SSO** |
| Orchestrator API | 4000 | `api.era-365.online` |
| Finance API | 4100 | **не публикуется** (прокси через Finance Web) |
| Finance Web | 3100 | `finance-core.era-365.online` |
| ERA Data Hub API | 4200 | `data.era-365.online` |
| Hotel PMS | 3201 | `hotel-pms.era-365.online` |
| F&B POS | 3202 | `fnb-pos.era-365.online` |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| Bank Core API | 4300 | `bank-api.era-365.online` (headless) |
| Bank ops satellite | 3210 | `bank.era-365.online` |
| Bank DBO channel | 3211 | `dbo.era-365.online` (planned host) |

> **Точка входа (v1.0):** откройте **Orchestrator Web** `http://127.0.0.1:3000` (или `app.era-365.online`). Industry launcher и регистрация — на Orch; Finance Web — `http://127.0.0.1:3100`; SSO в сателлиты: `node scripts/sso-launch-smoke.mjs` ([QUARTET_UAT.md](./QUARTET_UAT.md)). Finance tile uses JWT handoff (`/auth/cp-handoff`) — [ADR cp-finance-handoff](./adr/cp-finance-handoff.md).

---

## 2. Первичная подготовка

### Клонирование (flat monorepo)

```bash
git clone <url> era-ecosystem
cd era-ecosystem
```

Все приложения (`era-orchestrator`, `era-finance-core`, `era-hotel-pms`, …) — **подпапки одного репозитория**, без git submodules. Разработка из подпапки: [`LOCAL_FOLDER_DEV.md`](./LOCAL_FOLDER_DEV.md).

### Файл hosts (для Traefik-маршрутов)

Добавьте в `C:\Windows\System32\drivers\etc\hosts` (Windows) или `/etc/hosts` (Linux/macOS):

```
127.0.0.1 app.era-365.online api.era-365.online data.era-365.online finance-core.era-365.online hotel-pms.era-365.online fnb-pos.era-365.online
```

### Общий `.env` (корень umbrella)

```bash
cp .env.example .env
```

Отредактируйте секреты (`POSTGRES_PASSWORD`, `ERA_JWT_SECRET`, `AUTH_JWT_SECRET`, токены bridge и т.д.).

PostgreSQL при первом старте Docker создаёт **14** БД (см. `docker/postgres/init-databases.sql`), включая `era_bank_core`, `era_bank`, `era_bank_dbo`:

| Переменная | База данных |
|------------|-------------|
| `ORCHESTRATOR_DB` | `era_orchestrator` |
| `FINANCE_DB` | `era_finance` |
| `HOTEL_DB` | `era_hotel_pms` |
| `FNB_POS_DB` | `era_fnb_pos` |
| `RETAIL_POS_DB` … `CLINIC_DB` | остальные industry-сателлиты (см. `.env.example`) |

### i18n и юридические URL (все web-узлы)

| Переменная | Назначение |
|------------|------------|
| `DEFAULT_LOCALE` | `az` (по умолчанию для next-intl / публичных страниц) |
| `NEXT_PUBLIC_ERA_TERMS_URL_RU` / `_AZ` | Оферта (fallback: `NEXT_PUBLIC_ERA_TERMS_URL`) |
| `NEXT_PUBLIC_ERA_PRIVACY_URL_RU` / `_AZ` | Политика конфиденциальности |
| `NEXT_PUBLIC_ERA_STATUS_URL` | Статус-пейдж бренда |
| Cookie `era_i18n_lang` | `az` \| `ru` \| `en` — единый для экосистемы |

Finance legacy: `NEXT_PUBLIC_ERAFINANCE_*` и cookie `erafinance_i18n_lang` читаются с fallback. Подробнее: [SATELLITE_DOCUMENTATION.md § i18n stacks](./SATELLITE_DOCUMENTATION.md#i18n-stacks-ecosystem-contract).

### Auth UI и cross-app ссылки

| Переменная | Назначение |
|------------|------------|
| `NEXT_PUBLIC_ORCH_WEB_URL` | Базовый URL Orchestrator web (`http://127.0.0.1:3000` локально) — register, pricing, FAQ, terms |
| `NEXT_PUBLIC_ORCH_API_URL` | Orch API для клиентских fetch (`http://127.0.0.1:4000`) |
| `NEXT_PUBLIC_FINANCE_WEB_URL` | Finance ERP UI (`http://127.0.0.1:3100`) |

**Login UI:** все industry-сателлиты и Orchestrator используют `@era/satellite-kit/ui` → `AuthLoginCard` (DESIGN.md). Локальный вход: **login / email / phone** + пароль. Переключатель языка — справа от заголовка; `POST /api/locale` должен быть в public allowlist middleware.

**i18n sync:** после правок `packages/i18n-common/messages/common.*.json` — `node tools/sync-i18n-parity.mjs`.

---

## 3. Запуск всего стека в Docker (рекомендуется)

Из **корня** `era-ecosystem`:

```bash
cp .env.example .env
docker compose up -d --build
```

### Что поднимается

| Контейнер | Назначение |
|-----------|------------|
| `era-postgres` | PostgreSQL 16, 14 БД |
| `era-redis` | Redis 7 (очереди, кэш) |
| `era-traefik` | Reverse proxy (file provider) |
| `era-orchestrator` | Control plane API `:4000` + Web `:3000` |
| `era-finance-core` | Finance API `:4100` (внутри сети; `/api` через web) |
| `era-finance-web` | Finance ERP UI `:3100` |
| `era-hotel-pms` | Hotel PMS `:3201` |
| `era-fnb-pos` | F&B POS `:3202` |
| Industry satellites | `:3203`–`:3209` (clinic … wholesale) |

### URL после старта

| URL | Сервис |
|-----|--------|
| https://app.era-365.online | Orchestrator UI |
| https://api.era-365.online | Control plane API |
| https://finance-core.era-365.online | Finance ERP (Next.js; прокси `/api` → `finance-core:4100`) |
| https://hotel-pms.era-365.online | Hotel PMS |
| https://fnb-pos.era-365.online | F&B POS |
| http://localhost:8080 | Traefik dashboard |

Finance API напрямую с хоста не публикуется: `http://finance-core:4100` (Docker network). Для smoke с хоста: `curl https://finance-core.era-365.online/api/health` (через rewrites web).

**Публичный hub (Orchestrator web):** после старта проверьте `http://127.0.0.1:3000/pricing`, `/help`, `/terms`, `/register`. Finance `/pricing` и `/register*` редиректят на Orch (`NEXT_PUBLIC_ORCH_WEB_URL`).

### Shared packages (Docker)

Образ `era-ecosystem/packages:local` собирает `@era/i18n-common`, `@era/contracts`, `@era/storage`, `@era/satellite-kit`. При изменении shared-кода:

```bash
docker build -f docker/Dockerfile.packages -t era-ecosystem/packages:local .
docker compose build
```

### Полезные команды

```bash
docker compose ps
docker compose logs -f orchestrator
docker compose logs -f finance-core
docker compose down          # остановить
docker compose down -v       # остановить + удалить volumes (данные БД!)
```

### Первый запуск БД

После первого `docker compose up` выполните **единый bootstrap** с хоста (Postgres на `localhost:5432`):

```bash
# Из корня era-ecosystem (Orchestrator-first super-admin + Finance seed + satellite migrations)
npm run bootstrap:local
# С demo-организациями:
npm run bootstrap:local:demo
```

Учётные данные пишутся в `tmp/era-local-credentials.md` (gitignored).

**Orchestrator** — канонический IdP: login `:3000`, super-admin `:3000/super-admin`.  
**Finance data hub** (NAS, i18n, customs) — `:3100/admin/data` (не Orch).  
**Platform billing / MDM admin** — только Orch web.

Ручной режим (если bootstrap недоступен):

```bash
# Orchestrator
cd era-orchestrator
npm install
$env:DATABASE_URL="postgresql://era:<password>@localhost:5432/era_orchestrator"
npm run db:bootstrap-local

# Finance
cd era-finance-core
npm install
npm run db:bootstrap-local   # migrate + seed (dev)

# Hotel
cd era-hotel-pms
npx prisma migrate deploy   # includes Wave D2: 20260602120000_wave_d2_guest_res_submodals
npm run db:seed
# After pull with new UI keys: node scripts/apply-wave-d3-fo-i18n.mjs && npm run verify:i18n

# F&B POS
cd era-fnb-pos
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

---

## 4. Локальная разработка по сервисам

Общая схема:

1. Поднять **PostgreSQL + Redis** (из корневого `docker compose` или отдельно).
2. Создать `.env` / `.env.local` в нужной подпапке (`era-orchestrator`, `era-finance-core`, …).
3. Собрать shared packages при первом запуске (см. [`LOCAL_FOLDER_DEV.md`](./LOCAL_FOLDER_DEV.md)).
4. `npm install` → миграции → `npm run dev`.

Минимальная инфраструктура только Postgres + Redis:

```bash
# из корня era-ecosystem
docker compose up -d postgres redis
```

---

## 5. era-orchestrator (control plane)

**Роль:** IdP (JWT), billing, entitlements, ingress для satellite events.

| Компонент | Путь | Порт |
|-----------|------|------|
| API (NestJS) | `apps/api` | 4000 |
| Web (Next.js) | `apps/web` | 3000 |
| Prisma | `packages/database` | — |

### Настройка

```bash
cd era-orchestrator
cp .env.example .env
```

Пример `.env`:

```env
DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/era_orchestrator
PORT=4000
REDIS_URL=redis://127.0.0.1:6379/0
ERA_JWT_SECRET=change-me-shared-hs256-secret-min-32-chars
ERA_JWT_ISSUER=era-orchestrator
ERA_JWT_AUDIENCE_FINANCE=era-finance-core
ERA_SSO_SHARED_SECRET=change-me-sso-hmac-secret
SATELLITE_EVENT_SERVICE_TOKEN=dev-satellite-event-token
SATELLITE_EVENT_REDIS_URL=redis://127.0.0.1:6379/0
CONTROL_PLANE_SERVICE_TOKEN=dev-control-plane-token
```

> Для login через orchestrator таблица `users` должна существовать в БД orchestrator (общая с finance на этапе миграции или отдельная после переноса User).

### Запуск

```bash
npm install
npm run db:generate
npm run dev          # API :4000 + Web :3000 параллельно
# или отдельно:
npm run dev:api
npm run dev:web
```

### Основные эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/auth/login` | Выдача JWT (HS256) |
| POST | `/auth/token/refresh` | Обновление access token |
| POST | `/auth/sso/exchange` | SSO для satellites (HMAC) |
| POST | `/auth/join-org` | Запрос доступа к организации по VÖEN |
| GET | `/team/access-requests` | Pending join requests (OWNER/ADMIN) |
| POST | `/team/access-requests/:id/approve` | Одобрить запрос |
| POST | `/team/access-requests/:id/decline` | Отклонить запрос |
| POST | `/organizations/transfer-ownership` | Передача владения (OWNER) |
| POST | `/admin/organizations/:orgId/disputes` | Открыть ownership dispute (super-admin) |
| GET | `/.well-known/jwks.json` | JWKS stub (phase A+) |
| POST | `/internal/v1/entitlements/validate` | Billing / entitlements |
| POST | `/api/v1/satellite-events` | Ingress событий → BullMQ |

---

## 6. era-finance-core (data plane)

**Роль:** GL, транзакции, склад, payroll. **Не** публикуется через Traefik.

| Компонент | Путь | Порт (bare / Docker publish) |
|-----------|------|------------------------------|
| API (NestJS) | `apps/api` | **4100** |
| Web (Next.js) | `apps/web` | **3100** |
| Prisma | `packages/database` | — |

### Настройка

```bash
cd era-finance-core
cp .env.example .env
```

Дополните `.env` (минимум для dev):

```env
DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/era_finance
REDIS_URL=redis://127.0.0.1:6379/1
JWT_SECRET=dev-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=dev-refresh-secret-min-32-chars
API_PORT=4100
WEB_PORT=3100
NEXT_PUBLIC_API_URL=http://127.0.0.1:4100
CONTROL_PLANE_URL=http://127.0.0.1:4000
NEXT_PUBLIC_CONTROL_PLANE_URL=http://127.0.0.1:4000
CONTROL_PLANE_SERVICE_TOKEN=dev-control-plane-token

# Control-plane SSO (когда включите ERA_AUTH_MODE=control-plane)
ERA_JWT_SECRET=change-me-shared-hs256-secret-min-32-chars
ERA_JWT_ISSUER=era-orchestrator
ERA_JWT_AUDIENCE_FINANCE=era-finance-core
ERA_AUTH_MODE=legacy
# Проксировать RBAC-мутации (join-org, access-requests, transfer-ownership) на orchestrator
ERA_CONTROL_PLANE_RBAC_PROXY=true

# Satellite event worker
SATELLITE_EVENT_REDIS_URL=redis://127.0.0.1:6379/0
SATELLITE_EVENT_WORKER_DISABLED=0
```

Сборка `@era/contracts` (зависимость API):

```bash
cd ../packages/era-contracts
npm install && npm run build
cd ../../era-finance-core
```

### Запуск

```bash
npm install
npm run db:bootstrap-local   # первый раз: migrate + seed
npm run dev                  # API :4100 + Web :3100
```

**Demo BUDGET org (gov budget smoke):** seed creates **Demo Budget Agency (local)** (`OrganizationKind.BUDGET`, VÖEN `9900000003`) with owner `demo.owner@erafinance.local` / `DemoLocal#2026`. Enable `gov_budget_pro` on the org subscription, then open `/gov-budget` in Finance web.

**Control-plane auth cutover (dev):**

```env
ERA_AUTH_MODE=control-plane
ERA_CONTROL_PLANE_RBAC_PROXY=true   # default; Finance forwards join/access/transfer to orchestrator
ERA_JWT_SECRET=<same as orchestrator>
```

Login via orchestrator → use the same Bearer token on Finance API (`/api/billing/*`, `/api/contracts`, etc.) without Finance DB session lookup.

Отдельно:

```bash
npm run dev:api
npm run dev:web
```

### ERA Data Hub consumer flags (optional)

When finance reads reference data from the hub:

```env
ERA_DATA_HUB_ENABLED=true
ERA_DATA_HUB_URL=http://127.0.0.1:4200
DATA_HUB_SERVICE_TOKEN=dev-data-hub-service-token
ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED=true   # when hub owns CBAR (ERA_DATA_HUB_DATA_SOURCE=hub)
```

See [era-data-hub/doc/DATA-HUB-CONSUMER.md](../era-data-hub/doc/DATA-HUB-CONSUMER.md).

### Swagger / health

- API: http://localhost:4100/api/health  
- Web: http://localhost:3100  
- Swagger (dev): http://localhost:4100/docs  

Подробный deploy: umbrella — этот файл; Finance ERP only — [`era-finance-core/docs/deploy/FINANCE-ERP-DEPLOY.md`](../era-finance-core/docs/deploy/FINANCE-ERP-DEPLOY.md).

---

## 6b. era-data-hub (Reference Data / DaaS)

**Роль:** глобальные справочники (FX, календарь, HS, VÖEN, банки, гео, UoM, налоги, CoA). Публикуется на `data.era-365.online`.

| Компонент | Путь | Порт |
|-----------|------|------|
| API (NestJS) | `apps/api` | **4200** |
| Prisma | `packages/database` | DB `era_data_hub` |

### Настройка

```bash
cd era-data-hub
cp .env.example .env
```

```env
DATABASE_URL=postgresql://era:era_dev_password@127.0.0.1:5432/era_data_hub?schema=public
FINANCE_RO_DATABASE_URL=postgresql://era:era_dev_password@127.0.0.1:5432/era_finance?schema=public
ERA_DATA_HUB_DATA_SOURCE=finance_ro   # hub after cutover
REDIS_URL=redis://127.0.0.1:6379/4
DATA_HUB_SERVICE_TOKEN=dev-data-hub-service-token
DATA_HUB_DEV_API_KEYS=dev-data-hub-key
CONTROL_PLANE_URL=http://127.0.0.1:4000
CONTROL_PLANE_SERVICE_TOKEN=dev-control-plane-token
```

Finance must be seeded first (`cbar_official_rates`, banks, geo, tariffs).

### Запуск

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Phase 1 cutover (copy reference rows from finance RO):

```bash
npm run db:sync-from-finance
# then ERA_DATA_HUB_DATA_SOURCE=hub
```

Docker: `docker compose up -d data-hub` (depends on `finance-core` + `postgres` + `redis`).

Smoke: `node scripts/smoke-data-hub.mjs` from repo root.

Docs: [era-data-hub/README.md](../era-data-hub/README.md) · [DATA-HUB-CONSUMER.md](../era-data-hub/doc/DATA-HUB-CONSUMER.md).

---

## 7. era-hotel-pms (satellite)

**Роль:** PMS (бронирования, folio, night audit), outbound events в ERP.

| Стек | Порт (umbrella Docker) | Standalone compose |
|------|------------------------|--------------------|
| Next.js + Prisma | **3201** | **3000** |

### Настройка

```bash
cd era-hotel-pms
cp .env.example .env.local
```

Ключевые переменные — см. `.env.example`. Для интеграции с umbrella:

```env
DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/era_hotel_pms
REDIS_URL=redis://127.0.0.1:6379/2
AUTH_JWT_SECRET=change-me-min-32-chars
POS_BRIDGE_SECRET=dev-pos-bridge-secret
NEXT_PUBLIC_FNB_POS_URL=http://localhost:3200
FNB_POS_WEBHOOK_URL=http://localhost:3200/api/webhooks/pms/reservation-lifecycle

# Event bus через orchestrator (опционально)
ERA_EVENT_GATEWAY_MODE=orchestrator
ORCHESTRATOR_EVENT_URL=http://127.0.0.1:4000
SATELLITE_EVENT_SERVICE_TOKEN=dev-satellite-event-token
ERA_SATELLITE_ORGANIZATION_ID=<uuid-организации-в-finance>
```

### Запуск

**Docker (из папки hotel):**

```bash
docker compose up -d
```

**Локально:**

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

- UI: http://localhost:3000  
- Demo login: `admin` / `admin123`, `reception` / `reception123`

Документация: [`era-hotel-pms/README.md`](../era-hotel-pms/README.md), [`era-hotel-pms/doc/UAT-SMOKE.md`](../era-hotel-pms/doc/UAT-SMOKE.md).

---

## 8. era-fnb-pos (satellite)

**Роль:** floor plan, заказы, KDS, календарь; bridge к hotel PMS.

| Стек | Порт |
|------|------|
| Next.js + Prisma | 3200 |

### Настройка

```bash
cd era-fnb-pos
cp .env.example .env
```

```env
DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/era_fnb_pos
PMS_BRIDGE_URL=http://127.0.0.1:3000
POS_BRIDGE_SECRET=dev-pos-bridge-secret
FB_POS_WEBHOOK_SECRET=dev-fb-pos-webhook-secret
```

`POS_BRIDGE_SECRET` **должен совпадать** с hotel PMS.

### Запуск

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

- UI: http://localhost:3200  

Документация: [`era-fnb-pos/README.md`](../era-fnb-pos/README.md).

---

## 9. packages/era-contracts

**Роль:** общие TypeScript-типы и Zod-схемы событий (`@era/contracts`).

```bash
cd packages/era-contracts
npm install
npm run build
```

Подключение в монорепо (уже в `package.json`):

```json
"@era/contracts": "file:../packages/era-contracts"
```

После изменения контрактов пересоберите пакет и переустановите зависимости в потребителях:

```bash
npm run build
cd ../../era-orchestrator && npm install
cd ../era-finance-core && npm install
cd ../era-hotel-pms && npm install
```

---

## 10. SSO и шина событий

### SSO (control plane auth)

| Шаг | Действие |
|-----|----------|
| 1 | Одинаковый `ERA_JWT_SECRET` на orchestrator и finance-core |
| 2 | Login: `POST https://api.era-365.online/auth/login` → Bearer token |
| 3 | Finance: `ERA_AUTH_MODE=control-plane` — stateless JWT без lookup в БД |
| 4 | RBAC mutations: `ERA_CONTROL_PLANE_RBAC_PROXY=true` (default) — Finance proxies join/access/transfer to orchestrator |
| 4b | RBAC smoke: [UAT-SMOKE-RBAC.md](../era-orchestrator/doc/UAT-SMOKE-RBAC.md); Finance `GET /api/auth/me` + `POST /api/auth/switch` proxy memberships when `ERA_AUTH_MODE=control-plane` |
| 5 | Billing по-прежнему через `ControlPlaneEntitlementGuard` |

### Event bus (hotel → finance)

| Шаг | Действие |
|-----|----------|
| 1 | `ERA_SATELLITE_ORGANIZATION_ID` — UUID tenant в finance |
| 2 | Hotel: `ERA_EVENT_GATEWAY_MODE=orchestrator` |
| 3 | Общий `SATELLITE_EVENT_SERVICE_TOKEN` (hotel → orchestrator) |
| 4 | `SATELLITE_EVENT_REDIS_URL=redis://…/0` на orchestrator и finance worker |
| 5 | Checkout в hotel → job в BullMQ `era-satellite-events` → worker в finance |

Подробнее: [`INTEGRATION_SSO_EVENTS.md`](./INTEGRATION_SSO_EVENTS.md).

---

## 11. Проверка работоспособности

### Docker stack

```bash
docker compose ps                    # все сервисы healthy / up
curl https://api.era-365.online/auth/login    # 404/405 без body — маршрут жив
curl https://hotel-pms.era-365.online/login       # HTML hotel
curl https://fnb-pos.era-365.online               # HTML POS
```

### Orchestrator API

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"password\":\"secret\"}"
```

### Finance API

```bash
curl http://localhost:4100/api/health
```

### Hotel → Event bus (ручной smoke)

1. Установите `ERA_EVENT_GATEWAY_MODE=orchestrator` и `ERA_SATELLITE_ORGANIZATION_ID`.
2. Выполните checkout бронирования в hotel PMS.
3. Проверьте логи: `docker compose logs -f orchestrator finance-core` — enqueue + worker log.

---

## 9–15. Industry satellites (W1–W7)

Общий шаблон для каждого app:

```bash
cd era-{name}
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

| App | Dir | Port | Host | PRD |
|-----|-----|------|------|-----|
| Retail POS | `era-retail-pos` | [PRD](era-retail-pos/PRD.md) | retail-pos.era-365.online | 3204 | retail-pos.era-365.online | [PRD](../era-retail-pos/PRD.md) |
| Logistics | `era-logistics` | [PRD](era-logistics/PRD.md) | logistics.era-365.online | 3205 | logistics.era-365.online | [PRD](../era-logistics/PRD.md) |
| Construction | `era-construction` | [PRD](era-construction/PRD.md) | construction.era-365.online | 3206 | construction.era-365.online | [PRD](../era-construction/PRD.md) |
| CRM Field | `era-crm` | [PRD](era-crm/PRD.md) | crm.era-365.online | 3207 | crm.era-365.online | [PRD](../era-crm/PRD.md) |
| Auto STO | `era-auto-service` | [PRD](era-auto-service/PRD.md) | auto-service.era-365.online | 3208 | auto-service.era-365.online | [PRD](../era-auto-service/PRD.md) |
| Wholesale | `era-wholesale` | [PRD](era-wholesale/PRD.md) | wholesale.era-365.online | 3209 | wholesale.era-365.online | [PRD](../era-wholesale/PRD.md) |
| Clinic | `era-clinic` | [PRD](era-clinic/PRD.md) | clinic.era-365.online | 3203 | clinic.era-365.online | [PRD](../era-clinic/PRD.md) |

Retail presets: grocery, apparel, electronics, pharmacy — см. [`era-retail-pos/doc/presets/`](../era-retail-pos/doc/presets/).

**CRM Field:** не дублирует CRM контрагентов и WhatsApp-отправку инвойсов в Finance — только pre-sale ops.

Smoke all services: [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md).

---

## 12. Частые проблемы

| Симптом | Решение |
|---------|---------|
| `app.era-365.online` не открывается | Проверьте hosts, Traefik (`docker compose logs traefik`), порт 80 |
| Finance API недоступен снаружи | Ожидаемо — только internal `finance-core:4000` или `localhost:4000` локально |
| Конфликт порта 3000 | Не запускайте finance web и hotel одновременно на одном хосте |
| Orchestrator login 401 | БД без таблицы `users` / неверный `DATABASE_URL`; используйте finance DB на этапе миграции |
| Events не доходят до finance | Один `SATELLITE_EVENT_REDIS_URL` (db `0`); worker не disabled; token совпадает |
| Hotel bridge к POS 403 | `POS_BRIDGE_SECRET` одинаковый в hotel и fb-pos |
| Hotel: `Reservation.groupId` / `RoomChangePlan` does not exist | Не применены миграции Hotel. Из корня с паролем из `.env`: `cd era-hotel-pms` и `DATABASE_URL=postgresql://era:$POSTGRES_PASSWORD@localhost:5432/era_hotel_pms?schema=public npx prisma migrate deploy` — или `npm run bootstrap:local` (флаг `--migrate-satellites` по умолчанию). В Docker entrypoint вызывает `prisma migrate deploy`; при WARN в логах — выполните команду с хоста. |
| `[i18n] MISSING_MESSAGE: common.accessDenied` | Обновите образ `hotel-pms` и `packages/i18n-common` (`common.*.json` с ключом `accessDenied`). |
| `@era/contracts` not found | `npm run build` в `packages/era-contracts`, затем `npm install` в consumer |

---

## 13. Bank CBS (`era-bank-core`, `era-bank`, `era-bank-dbo`)

Ports: **4300** (engine), **3210** (ops satellite), **3211** (DBO channel). Env: [`ECOSYSTEM_URLS.md`](./ECOSYSTEM_URLS.md) § Bank.

### Docker (with full stack)

```bash
docker build -f docker/Dockerfile.packages -t era-ecosystem/packages:local .
docker compose up -d bank-core bank bank-dbo
bash docker/scripts/migrate-all.sh
```

### Local dev

```bash
# Engine
cd era-bank-core && cp .env.example .env && npm install
npm run db:migrate:deploy && npm run db:seed && npm run dev

# Ops satellite
cd era-bank && cp .env.example .env && npm install
npx prisma db push && npm run db:seed && npm run dev

# DBO channel
cd era-bank-dbo && cp .env.example .env && npm install
npx prisma db push && npm run db:seed && npm run dev
```

UAT: [era-bank-core/doc/UAT-SMOKE-FULL.md](../era-bank-core/doc/UAT-SMOKE-FULL.md) · Ops teller walkthrough: [era-bank/doc/UAT-SMOKE.md](../era-bank/doc/UAT-SMOKE.md) · Card stub: `node tools/card-acquiring-stub.mjs`

On-prem reference data (no live data-hub): set `ERA_DATA_HUB_ONPREM=true` in `era-bank-core/.env`, validate bundle with `npm run ref-data:load`. Hardening tools: `node era-bank-core/tools/load/posting-benchmark.mjs`, `node era-bank-core/tools/audit/replay-day.mjs <date>`.

---

## Связанные документы

| Документ | Описание |
|----------|----------|
| [`README.md`](../README.md) | Обзор umbrella |
| [`DESIGN.md`](../DESIGN.md) | UI/UX и архитектурные принципы |
| [`SATELLITE_DOCUMENTATION.md`](./SATELLITE_DOCUMENTATION.md) | Стандарт PRD/DELIVERY |
| [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md) | Smoke всех сервисов |
| [`era-finance-core/docs/README.md`](../era-finance-core/docs/README.md) | Finance docs index |
| [`era-finance-core/docs/deploy/`](../era-finance-core/docs/deploy/) | Production deploy finance |
| [`DEPLOY_DIGITALOCEAN.ru.md`](./DEPLOY_DIGITALOCEAN.ru.md) | Полный стек на DigitalOcean Droplet |
