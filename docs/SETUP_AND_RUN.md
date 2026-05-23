# ERA Ecosystem — настройка и запуск

Инструкция по конфигурации и запуску каждого компонента umbrella-репозитория.  
Архитектура: [`DESIGN.md`](../DESIGN.md) · SSO и event bus: [`INTEGRATION_SSO_EVENTS.md`](./INTEGRATION_SSO_EVENTS.md)

---

## Содержание

1. [Требования](#1-требования)
2. [Первичная подготовка](#2-первичная-подготовка)
3. [Запуск всего стека в Docker (рекомендуется)](#3-запуск-всего-стека-в-docker-рекомендуется)
4. [Локальная разработка по сервисам](#4-локальная-разработка-по-сервисам)
5. [era-365-orchestrator (control plane)](#5-era-365-orchestrator-control-plane)
6. [era-finance-core (data plane)](#6-era-finance-core-data-plane)
7. [era-hotel-pms (satellite)](#7-era-hotel-pms-satellite)
8. [era-fb-pos (satellite)](#8-era-fb-pos-satellite)
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
| Orchestrator Web | 3100 | `app.era.az` |
| Orchestrator API | 4100 | `api.era.az` |
| Finance API | 4000 | **не публикуется** |
| Finance Web (локально) | 3000 | — |
| Hotel PMS | 3000 | `hotel.era.az` |
| F&B POS | 3200 | `pos.era.az` |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |

> При одновременном локальном запуске **finance web** и **hotel PMS** оба используют `:3000` — запускайте только один из них или смените порт.

---

## 2. Первичная подготовка

### Клонирование с submodules

```bash
git clone <url> era-ecosystem
cd era-ecosystem
git submodule update --init --recursive
```

### Файл hosts (для Traefik-маршрутов)

Добавьте в `C:\Windows\System32\drivers\etc\hosts` (Windows) или `/etc/hosts` (Linux/macOS):

```
127.0.0.1 app.era.az api.era.az hotel.era.az pos.era.az
```

### Общий `.env` (корень umbrella)

```bash
cp .env.example .env
```

Отредактируйте секреты (`POSTGRES_PASSWORD`, `ERA_JWT_SECRET`, `AUTH_JWT_SECRET`, токены bridge и т.д.).

PostgreSQL при первом старте Docker создаёт четыре БД (см. `docker/postgres/init-databases.sql`):

| Переменная | База данных |
|------------|-------------|
| `ORCHESTRATOR_DB` | `era_orchestrator` |
| `FINANCE_DB` | `era_finance` |
| `HOTEL_DB` | `era_hotel_pms` |
| `FB_POS_DB` | `era_fb_pos` |

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
| `era-postgres` | PostgreSQL 16, 4 БД |
| `era-redis` | Redis 7 (очереди, кэш) |
| `era-traefik` | Reverse proxy (file provider) |
| `era-orchestrator` | Control plane API `:4100` + Web `:3100` |
| `era-finance-core` | Data plane API `:4000` (только внутри сети) |
| `era-hotel-pms` | Hotel PMS `:3000` |
| `era-fb-pos` | F&B POS `:3200` |

### URL после старта

| URL | Сервис |
|-----|--------|
| http://app.era.az | Orchestrator UI |
| http://api.era.az | Control plane API |
| http://hotel.era.az | Hotel PMS |
| http://pos.era.az | F&B POS |
| http://localhost:8080 | Traefik dashboard |

Finance-core доступен **только** из Docker-сети: `http://finance-core:4000`.

### Полезные команды

```bash
docker compose ps
docker compose logs -f orchestrator
docker compose logs -f finance-core
docker compose down          # остановить
docker compose down -v       # остановить + удалить volumes (данные БД!)
```

### Первый запуск БД

После первого `docker compose up` выполните миграции **внутри** контейнеров или локально, указав `DATABASE_URL` на `localhost:5432`:

```bash
# Orchestrator
cd era-365-orchestrator
npm install
$env:DATABASE_URL="postgresql://era:<password>@localhost:5432/era_orchestrator"
npm run db:generate

# Finance
cd era-finance-core
npm install
# скопируйте/дополните .env (DATABASE_URL, JWT_SECRET, REDIS_URL, CONTROL_PLANE_URL)
npm run db:bootstrap-local   # migrate + seed (dev)

# Hotel
cd era-hotel-pms
npm install
npx prisma migrate deploy
npm run db:seed

# F&B POS
cd era-fb-pos
npm install
npx prisma db push
npx tsx prisma/seed.ts
```

---

## 4. Локальная разработка по сервисам

Общая схема:

1. Поднять **PostgreSQL + Redis** (из корневого `docker compose` или отдельно).
2. Создать `.env` / `.env.local` в submodule.
3. `npm install` → миграции → `npm run dev`.

Минимальная инфраструктура только Postgres + Redis:

```bash
# из корня era-ecosystem
docker compose up -d postgres redis
```

---

## 5. era-365-orchestrator (control plane)

**Роль:** IdP (JWT), billing, entitlements, ingress для satellite events.

| Компонент | Путь | Порт |
|-----------|------|------|
| API (NestJS) | `apps/api` | 4100 |
| Web (Next.js) | `apps/web` | 3100 |
| Prisma | `packages/database` | — |

### Настройка

```bash
cd era-365-orchestrator
cp .env.example .env
```

Пример `.env`:

```env
DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/era_orchestrator
PORT=4100
REDIS_URL=redis://127.0.0.1:6379/0
ERA_JWT_SECRET=change-me-shared-hs256-secret-min-32-chars
ERA_JWT_ISSUER=era-365-orchestrator
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
npm run dev          # API :4100 + Web :3100 параллельно
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
| GET | `/.well-known/jwks.json` | JWKS stub (phase A+) |
| POST | `/internal/v1/entitlements/validate` | Billing / entitlements |
| POST | `/api/v1/satellite-events` | Ingress событий → BullMQ |

---

## 6. era-finance-core (data plane)

**Роль:** GL, транзакции, склад, payroll. **Не** публикуется через Traefik.

| Компонент | Путь | Порт |
|-----------|------|------|
| API (NestJS) | `apps/api` | 4000 |
| Web (Next.js) | `apps/web` | 3000 |
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
API_PORT=4000
CONTROL_PLANE_URL=http://127.0.0.1:4100
CONTROL_PLANE_SERVICE_TOKEN=dev-control-plane-token

# Control-plane SSO (когда включите ERA_AUTH_MODE=control-plane)
ERA_JWT_SECRET=change-me-shared-hs256-secret-min-32-chars
ERA_JWT_ISSUER=era-365-orchestrator
ERA_JWT_AUDIENCE_FINANCE=era-finance-core
ERA_AUTH_MODE=legacy

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
npm run dev                  # API :4000 + Web :3000
```

Отдельно:

```bash
npm run dev:api
npm run dev:web
```

### Swagger / health

- API: http://localhost:4000/api/health  
- Swagger (dev): http://localhost:4000/docs  

Подробный production deploy: [`era-finance-core/docs/deploy/README.md`](../era-finance-core/docs/deploy/README.md).

---

## 7. era-hotel-pms (satellite)

**Роль:** PMS (бронирования, folio, night audit), outbound events в ERP.

| Стек | Порт |
|------|------|
| Next.js + Prisma | 3000 |

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
NEXT_PUBLIC_FB_POS_URL=http://localhost:3200
FB_POS_WEBHOOK_URL=http://localhost:3200/api/webhooks/pms/reservation-lifecycle

# Event bus через orchestrator (опционально)
ERA_EVENT_GATEWAY_MODE=orchestrator
ORCHESTRATOR_EVENT_URL=http://127.0.0.1:4100
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

## 8. era-fb-pos (satellite)

**Роль:** floor plan, заказы, KDS, календарь; bridge к hotel PMS.

| Стек | Порт |
|------|------|
| Next.js + Prisma | 3200 |

### Настройка

```bash
cd era-fb-pos
cp .env.example .env
```

```env
DATABASE_URL=postgresql://era:era_dev_password@localhost:5432/era_fb_pos
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

Документация: [`era-fb-pos/README.md`](../era-fb-pos/README.md).

---

## 9. packages/era-contracts

**Роль:** общие TypeScript-типы и Zod-схемы событий (`@era/contracts`).

```bash
cd packages/era-contracts
npm install
npm run build
```

Подключение в submodule (уже в `package.json`):

```json
"@era/contracts": "file:../packages/era-contracts"
```

После изменения контрактов пересоберите пакет и переустановите зависимости в потребителях:

```bash
npm run build
cd ../../era-365-orchestrator && npm install
cd ../era-finance-core && npm install
cd ../era-hotel-pms && npm install
```

---

## 10. SSO и шина событий

### SSO (control plane auth)

| Шаг | Действие |
|-----|----------|
| 1 | Одинаковый `ERA_JWT_SECRET` на orchestrator и finance-core |
| 2 | Login: `POST http://api.era.az/auth/login` → Bearer token |
| 3 | Finance: `ERA_AUTH_MODE=control-plane` — stateless JWT без lookup в БД |
| 4 | Billing по-прежнему через `ControlPlaneEntitlementGuard` |

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
curl http://api.era.az/auth/login    # 404/405 без body — маршрут жив
curl http://hotel.era.az/login       # HTML hotel
curl http://pos.era.az               # HTML POS
```

### Orchestrator API

```bash
curl -X POST http://localhost:4100/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"user@example.com\",\"password\":\"secret\"}"
```

### Finance API

```bash
curl http://localhost:4000/api/health
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
| Retail POS | `era-retail-pos` | 3300 | retail.era.az | [PRD](../era-retail-pos/PRD.md) |
| Logistics | `era-logistics` | 3301 | logistics.era.az | [PRD](../era-logistics/PRD.md) |
| Construction | `era-construction` | 3302 | construction.era.az | [PRD](../era-construction/PRD.md) |
| CRM Field | `era-crm-field` | 3303 | crm.era.az | [PRD](../era-crm-field/PRD.md) |
| Auto STO | `era-auto-sto` | 3304 | auto.era.az | [PRD](../era-auto-sto/PRD.md) |
| Wholesale | `era-wholesale` | 3305 | wholesale.era.az | [PRD](../era-wholesale/PRD.md) |
| Clinic | `era-clinic` | 3306 | clinic.era.az | [PRD](../era-clinic/PRD.md) |

Retail presets: grocery, apparel, electronics, pharmacy — см. [`era-retail-pos/doc/presets/`](../era-retail-pos/doc/presets/).

**CRM Field:** не дублирует CRM контрагентов и WhatsApp-отправку инвойсов в Finance — только pre-sale ops.

Smoke all services: [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md).

---

## 12. Частые проблемы

| Симптом | Решение |
|---------|---------|
| `app.era.az` не открывается | Проверьте hosts, Traefik (`docker compose logs traefik`), порт 80 |
| Finance API недоступен снаружи | Ожидаемо — только internal `finance-core:4000` или `localhost:4000` локально |
| Конфликт порта 3000 | Не запускайте finance web и hotel одновременно на одном хосте |
| Orchestrator login 401 | БД без таблицы `users` / неверный `DATABASE_URL`; используйте finance DB на этапе миграции |
| Events не доходят до finance | Один `SATELLITE_EVENT_REDIS_URL` (db `0`); worker не disabled; token совпадает |
| Hotel bridge к POS 403 | `POS_BRIDGE_SECRET` одинаковый в hotel и fb-pos |
| `@era/contracts` not found | `npm run build` в `packages/era-contracts`, затем `npm install` в consumer |

---

## Связанные документы

| Документ | Описание |
|----------|----------|
| [`README.md`](../README.md) | Обзор umbrella |
| [`DESIGN.md`](../DESIGN.md) | UI/UX и архитектурные принципы |
| [`SATELLITE_DOCUMENTATION.md`](./SATELLITE_DOCUMENTATION.md) | Стандарт PRD/DELIVERY |
| [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md) | Smoke всех сервисов |
| [`era-finance-core/docs/deploy/`](../era-finance-core/docs/deploy/) | Production deploy finance |
