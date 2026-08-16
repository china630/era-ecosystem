# ERA Ecosystem — деплой на DigitalOcean Droplet

Пошаговый runbook для **чистого** дроплета (демо клиенту). Стек: корневой `docker-compose.yml` + Traefik (file provider) + 11 PostgreSQL БД.

См. также: [`SETUP_AND_RUN.md`](./SETUP_AND_RUN.md) · [`ECOSYSTEM_URLS.md`](./ECOSYSTEM_URLS.md) · [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md)

---

## 0. Что нужно заранее

| Ресурс | Рекомендация |
|--------|----------------|
| Droplet | Ubuntu 22.04/24.04, **≥ 8 GB RAM**, **≥ 4 vCPU**, **≥ 80 GB** диск (полный стек — много Next.js-образов) |
| DNS | Зона `era-365.online` (или ваша) — **A-записи** на IP дроплета для всех хостов из §2 |
| Git | Доступ к репозиторию `era-ecosystem` (SSH deploy key или HTTPS + token) |
| Firewall | UFW: `22`, `80`, `443` (5432/6379 **не** открывать в интернет) |

**Точка входа для клиента:** `https://app.era-365.online` (или `http://` пока нет TLS — см. §8).

---

## 1. Очистка текущего дроплета (полный сброс)

Подключитесь по SSH:

```bash
ssh root@<DROPLET_IP>
```

### 1.1 Остановить и удалить старый Docker-стек

```bash
cd /opt/era-ecosystem   # или ваш путь к клону
docker compose down -v --remove-orphans 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true
```

### 1.2 Удалить данные Postgres/Redis на хосте

```bash
rm -rf /opt/era-ecosystem/docker-data
# если данные лежали в named volumes:
docker volume prune -f
```

### 1.3 (Опционально) удалить старый клон и образы

```bash
cd /opt
rm -rf era-ecosystem
docker system prune -af --volumes
```

После этого дроплет «чистый» с точки зрения ERA — можно клонировать заново.

---

## 2. DNS (обязательно до демо)

В панели домена создайте **A-записи** → IP дроплета:

```
era-365.online
app
api
finance-core
finance-api
hotel-pms
fnb-pos
clinic
retail-pos
logistics
construction
crm
auto-service
wholesale
```

Проверка с вашего ПК:

```bash
dig +short app.era-365.online
```

---

## 3. Подготовка нового / очищенного дроплета

### 3.1 Базовые пакеты

```bash
apt update && apt upgrade -y
apt install -y git curl ca-certificates
```

### 3.2 Docker (официальный скрипт)

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER   # если не root — перелогиниться
```

### 3.3 Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 3.4 Клон репозитория

```bash
mkdir -p /opt && cd /opt
git clone <REPO_URL> era-ecosystem
cd era-ecosystem
git checkout master
git pull
```

---

## 4. Production `.env`

```bash
cp .env.example .env
nano .env
```

Минимум для демо на `era-365.online`:

```env
POSTGRES_PASSWORD=<strong-random>
ERA_JWT_SECRET=<min-32-chars-random>
ERA_SSO_SHARED_SECRET=<random>
CONTROL_PLANE_SERVICE_TOKEN=<random>
ORCHESTRATOR_INTERNAL_SERVICE_TOKEN=<same-value-as-CONTROL_PLANE_SERVICE_TOKEN>
SATELLITE_EVENT_SERVICE_TOKEN=<random>
AUTH_JWT_SECRET=<min-32-chars>
POS_BRIDGE_SECRET=<random>
# Set once in this droplet .env (never commit). Used by bootstrap-local /
# prod-init to create Orchestrator + Finance + satellite local logins.
PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD=<demo-password-for-client>
PLATFORM_SUPER_ADMIN_EMAILS=inaram84@gmail.com,shirinov.chingiz@gmail.com,chingiz@era.com

ERA_APP_ORIGIN=https://app.era-365.online
ERA_API_ORIGIN=https://api.era-365.online
ERA_FINANCE_ORIGIN=https://finance-core.era-365.online
ERA_FINANCE_API_ORIGIN=https://finance-api.era-365.online

NEXT_PUBLIC_ORCH_API_URL=https://api.era-365.online
NEXT_PUBLIC_ORCH_WEB_URL=https://app.era-365.online
NEXT_PUBLIC_FINANCE_WEB_URL=https://finance-core.era-365.online
```

Остальные `ERA_*_ORIGIN` и `NEXT_PUBLIC_SATELLITE_*` — как в `.env.example` (уже на `https://*.era-365.online`).

**Не коммитьте** `.env` в git.

Для bootstrap с хоста (шаг 6) при необходимости:

```env
POSTGRES_HOST=127.0.0.1
POSTGRES_PUBLISH_PORT=5432
```

---

## 5. Сборка и запуск стека

На дроплете нужны **Node.js 20+** и npm только для bootstrap (миграции/сид), не для runtime контейнеров.

```bash
# Node 20 (пример через NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

cd /opt/era-ecosystem

# Shared packages image (обязательно перед compose)
docker build -f docker/Dockerfile.packages -t era-ecosystem/packages:local .

# Полный стек (первый раз 15–40 мин в зависимости от CPU)
docker compose up -d --build
docker compose ps
```

Дождитесь `healthy` у `postgres`, `redis`, `finance-core`.

---

## 6. Bootstrap БД и демо-данные

Postgres должен слушать на `localhost:5432` (порт из compose).

```bash
cd /opt/era-ecosystem
npm install   # только devDependencies корня + скрипты tools/
npm run bootstrap:local:demo
```

Скрипт: миграции Orch/Finance/сателлитов, platform super-admin, demo-организации, hotel/fnb seed.

Учётки для демо (не в git): после bootstrap смотрите на сервере `tmp/era-local-credentials.md` или используйте emails из `PLATFORM_SUPER_ADMIN_EMAILS` + `PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD`.

**Hotel seed в контейнере** (если пустая БД hotel):

```bash
docker exec era-hotel-pms npm run db:seed
```

---

## 7. Smoke-проверка

```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://app.era-365.online/
curl -sS -o /dev/null -w "%{http_code}\n" http://api.era-365.online/auth/login
curl -sS http://finance-core.era-365.online/api/health
curl -sS -o /dev/null -w "%{http_code}\n" http://hotel-pms.era-365.online/login
```

Полный чеклист: [`SMOKE_ALL_SERVICES.md`](./SMOKE_ALL_SERVICES.md).

**Клиенту показать:** `https://app.era-365.online` → login → industry launcher → Hotel / Finance.

### Привязка org UUID к сателлитам (без правки `.env`)

1. Super-admin → org hub → создать org / departments (F&B, Clinic).
2. Connect satellites + сохранить **Satellite endpoints** (HTTPS base URLs hotel/fnb/clinic).
3. Кнопка **Sync satellite bindings** → Orchestrator шлёт `POST /api/internal/v1/organization/bind` на каждый enabled industry endpoint.
4. Hotel получает UUID родителя; F&B/Clinic — UUID department по имени (или endpoint, зарегистрированный на department).

Не нужно вручную прописывать `ERA_SATELLITE_ORGANIZATION_ID` в compose после Sync (см. ADR `satellite-organization-bind`). Требуются образы с bind-route.

---

## 8. HTTPS (Let's Encrypt)

Traefik ACME (`certificatesResolvers.letsencrypt`, HTTP-01 on entryPoint `web`) выдаёт сертификаты в `docker-data/letsencrypt/acme.json`.

**Не** включайте глобальный redirect `web` → `websecure` в `traefik.yml` — он ломает HTTP-01 (остаётся `TRAEFIK DEFAULT CERT` в браузере). Redirect HTTP→HTTPS — middleware `http-to-https` в `traefik/dynamic.yml` с исключением `/.well-known/acme-challenge/`.

После wipe `docker-data` сертификаты нужно выписать заново: `docker compose … up -d traefik`, затем открыть `https://app.…` / дождаться ACME в логах (`docker logs era-traefik`).

Все `ERA_*_ORIGIN` в prod — `https://`.

---

## 9. Обновление после `git pull`

```bash
cd /opt/era-ecosystem
git pull
docker build -f docker/Dockerfile.packages -t era-ecosystem/packages:local .
# Finance SSO: обязательно пересобрать эти три сервиса
docker compose up -d --build orchestrator finance-core finance-web
docker compose up -d --build
# при новых миграциях:
npm run bootstrap:local -- --skip-finance  # или полный bootstrap по ситуации
```

В `.env` на дроплете `ORCHESTRATOR_INTERNAL_SERVICE_TOKEN` должен совпадать с `CONTROL_PLANE_SERVICE_TOKEN`. Затем:

```bash
docker compose up -d orchestrator finance-core finance-web
```

---

## 10. Бэкап перед экспериментами

```bash
docker exec era-postgres pg_dumpall -U era > /root/era-pg-backup-$(date +%F).sql
tar czf /root/era-docker-data.tgz -C /opt/era-ecosystem docker-data
```

---

## 11. Типичные проблемы

| Симптом | Действие |
|---------|----------|
| 502 / connection refused | `docker compose logs traefik orchestrator` |
| OOM при build | увеличить droplet или `DOCKER_BUILDKIT=1` и сборка по одному сервису |
| Login 401 | повторить `npm run bootstrap:local:demo` |
| Finance `Session invalid — use Orchestrator login` | `ORCHESTRATOR_INTERNAL_SERVICE_TOKEN` = `CONTROL_PLANE_SERVICE_TOKEN` в `.env`; пересобрать `orchestrator` + `finance-core` + `finance-web`. Вход только с `https://app.era-365.online` → workspace → Open Finance. |
| Deploy `ghcr.io/v2/: denied` | Логин в GHCR идёт в `docker/scripts/deploy-droplet.sh`. В inline-скрипте appleboy/ssh-action нельзя ставить pipe — drone-ssh выкидывает такие строки и `docker login` не выполняется. |
| Hotel Prisma errors | `docker exec era-hotel-pms` логи; `npx prisma migrate deploy` с хоста |
| Старые данные после «очистки» | убедиться что удалён `docker-data/` и `docker compose down -v` |

---

## 12. Чеклист «готово к демо клиенту»

- [ ] DNS всех поддоменов → IP дроплета
- [ ] `docker compose ps` — все сервисы up
- [ ] `bootstrap:local:demo` без ошибок
- [ ] Вход на `app.era-365.online` super-admin / demo owner
- [ ] Hotel PMS открывается, SSO с Orch работает
- [ ] Секреты в `.env` не dev-значения из example
