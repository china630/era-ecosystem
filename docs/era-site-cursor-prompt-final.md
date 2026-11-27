# Публичный сайт ERA 365: задание для Cursor

Скопируй этот текст целиком и работай по нему. Документ самодостаточный: все решения, таблицы, пути файлов и критерии уже внутри. Ничего дополнительно искать у автора не нужно. Репозиторий: `D:\My Projects\era-ecosystem`, публичный сайт — пакет `@era365/web` в `era-orchestrator/apps/web` (Next.js 15 App Router, React 19, Tailwind 4, next-intl, lucide-react, `output: standalone`). Дизайн-система: корневой `DESIGN.md` и токены `@era/satellite-kit/ui` (`packages/satellite-kit/src/ui/tokens`). Палитра `#34495E`, `#2980B9`, `#7F8C8D`, `#EBEDF0`, `#D5DADF`; карточки `rounded-2xl`, кнопки `rounded-lg`.

---

## 0. Что уже изучено и собрано

Просмотрен сайт конкурента Mews (mews.com): два входа в мега-меню — «Solutions» (что делает система) и «Industries» (для кого); главная CTA «Request a demo» плюс мягкая вторая; единые шаблоны страницы продукта и страницы отрасли с якорной навигацией; футер как карта сайта; карточка-витрина в меню; отдельная строка на инструмент (ROI calculator); размеченные CTA; SEO-гигиена (уникальные title/description, canonical, hreflang, sitemap, JSON-LD, меню в серверном HTML); страница контактов по целям обращения. Перенимаем структуру и информационную архитектуру, не визуальный стиль Mews.

Просмотрен наш живой сайт и код.

Проблемы живого сайта:
- `https://era-365.online` отвечает 308 на `https://app.era-365.online` (любой путь). Маркетинговая часть и кабинет живут в одном Next-приложении (`orchestrator-web`, порт 3000).
- Лендинг в серверном HTML — только «Yüklənir…»: `home-page-client.tsx` ждёт `useAuth().ready`.
- У всех публичных страниц один `<title>ERA 365 Orchestrator` и админский description. Нет canonical, hreflang, Open Graph, JSON-LD, `/sitemap.xml`, `/robots.txt`.
- Шапка без мега-меню, скопирована в трёх файлах: `landing-chrome.tsx`, `calc-page-view.tsx`, `pricing-page-view.tsx`. Калькулятор в меню есть, но обычной серой кнопкой.
- Страниц `/demo`, `/contact`, `/industries` нет (404).
- Аналитики нет.

Где задан редирект apex → app (проверено по коду и `curl -sI` на IP сервера `164.92.151.56`):
- Единственный источник — `traefik/dynamic.yml`: роутер `apex-redirect` (Host `era-365.online`, entryPoint `websecure`, priority 100) и middleware `apex-to-app` (`redirectRegex` `^https?://era-365\.online/(.*)` → `https://app.era-365.online/${1}`, `permanent: true`). Сервис за роутером — `orchestrator-web`.
- В `docs/ECOSYSTEM_URLS.md` строка «ERA (apex) … redirect → app».
- В `next.config.ts` и `middleware.ts` этого редиректа нет (`next.config.ts` редиректит только `/industry/fb-pos`, `/industry/auto`, `/super-admin*`).
- HTTP→HTTPS на обоих хостах уже есть. `https://app.era-365.online` отдаёт 200.

DNS (проверено 27.11.2026 с компьютера владельца, Asia/Baku, через `nslookup`):
- `www.era-365.online` A `164.92.151.56` (ответы `8.8.8.8` и `1.1.1.1`). CNAME нет, запись прямая A. TTL у резолверов около 1800 с.
- `era-365.online` и `app.era-365.online` тоже A `164.92.151.56`. NS: `ns1/ns2/ns3.digitalocean.com`.
- Запись `www` владелец уже создал. В этом задании её заводить не нужно.

Языки сейчас: `messages/{az,ru,en}.json` (~2520 ключей) закрывают в основном кабинет. Публичные тексты сайта лежат в TS-модулях и только на az/ru (`landing-copy.ts`, `landing-ecosystem-data.ts`, `satellite-page-copy.ts`, `pricing-storefront-copy.ts`, `pricing-meters-copy.ts`). EN есть только у `calc-copy.ts`. `resolvePublicAzRuLocale()` исключает `en`. Язык в cookie `era_i18n_lang`, не в URL.

Каталог коммерческих ключей уже живёт в БД оркестратора, не на сайте. Сайт сегодня читает статичный `apps/web/lib/satellites/public-satellite-catalog.ts` — это нужно заменить.

Приём заявок: публичного API в orchestrator нет. В era-crm уже есть `POST /api/integrations/hooks/form_generic/:publicId` (`era-crm/nest/integrations-routes.ts`), адаптер `packages/integrations-kit/src/providers/form_generic.ts`, нормализатор `era-crm/src/lib/integrations/normalizer.service.ts` создаёт настоящий Lead. Новый `POST /v1/public/demo-requests` не нужен.

---

## 1. Принятые решения владельца

1. Сайт открывается на apex `era-365.online` без редиректа на app. Кабинет, вход и регистрация остаются на `app.era-365.online`. `www` редиректит на apex. Canonical и sitemap — на apex.
2. Модель: **сателлит = продукт** (меню «Решения», URL `/satellites/…`); **индустрия = набор из 5–6 сателлитов** (меню «Отрасли», URL `/industries/[slug]`). В публичных подписях писать «продукт» или «решение», не «спутник / сателлит / peyk». В коде, ключах БД и URL слово satellite сохраняется.
3. Каталог сайт читает **из БД оркестратора**, а не из статичного `site-catalog.ts` / `public-satellite-catalog.ts`. Новый сателлит или модуль в БД сам появляется в «Решениях» и в меню, без пересборки сайта.
4. Публичные описания, тексты az/ru/en, порядок, видимость, статус Pilot/prod и картинки редактируются в оркестраторе (Super-Admin). Черновики и скрытые ключи наружу не попадают. Если описание не заполнено — минимальная карточка: название и список модулей.
5. Всё, что в разработке, показываем с бейджем «Pilot». Банк, лизинг и НБКО, строительство, больница, санаторий видны (флаг скрытия убран).
6. Конфигурация живёт в настройках БД (`system_config`), **не в `.env`**. Туда же: origin сайта и app, адрес CRM, id и секрет демо-формы, контакты, адрес/юрлицо/VÖEN, флаги. Секреты шифруются тем же механизмом, что и остальные секреты оркестратора.
7. Подключение `form_generic` для организации ERA в CRM создаёт этот же агент: идемпотентный сид или скрипт, ключи пишет в `system_config`.
8. Полная английская версия публичной части, префиксы `/az`, `/ru`, `/en`, hreflang и 308 со старых URL — в основном плане, не во второй очереди.
9. Заявка на демо становится лидом в era-crm через существующий `form_generic`. Антиспам и rate limit — на серверном маршруте сайта.
10. Контакты: корпоративный e-mail основной, телефон и WhatsApp (`wa.me`). Личный e-mail не публикуется. Адрес, юрлицо и VÖEN — поля настроек с пустым значением; блок на сайте скрыт, пока они не заполнены.
11. Калькулятор: `/calc` остаётся, логика не меняется, предвыбор набора — через существующий `?q=`. Повсеместная акцентная кнопка и лёгкая страница `/calculator`.
12. Дизайн не меняется. `/industry/[vertical]`, авторизацию и поддомены сателлитов не трогаем. Блоки доверия выключены флагом, пока нет реальных данных.
13. Запись DNS `www` уже сделана — не создавать её заново.
14. Оставшиеся хвосты (статусы, допущения в бандлах, Traefik, KEK, блоки доверия, пустые юрполя) — задачи этого задания, не «чеклист для владельца». Владельцу оставь только то, что ты не можешь сделать сам: деплой через skill «ship + push».

---

## 2. Жёсткие правила

- Дизайн, цвета, шрифты, радиусы, фон `LandingPageShell` не менять. Новые компоненты — из тех же токенов. Бейдж «Pilot» собрать из существующих chip-токенов, новый цвет не вводить.
- Публичный HTML (шапка, меню, H1, футер, карточки каталога) должен приходить с сервера на apex, без «Yüklənir…».
- Не выдумывать клиентов, кейсы, награды, цифры, адрес, юрлицо, VÖEN, личный e-mail.
- Не добавлять новые переменные в `.env`, `.env.production.example`, `Dockerfile` и `build-images.yml` «для сайта». Не описывать владельцу шаги «пропиши в env».
- Не создавать `POST /v1/public/demo-requests`. Не менять логику калькулятора (`quote-*`, `quote-calculator.ts`, `calc-page-view.tsx` кроме шапки) и `packages/satellite-kit`.
- `syncPricingModuleCatalog` не должен затирать публичный контент (описания, статусы, видимость, картинки).
- Новые ключи `workforce` / `data-hub` не добавлять в `INDUSTRY_SATELLITE_KEYS` и в поток Connect/trial, если это сломает биллинг. Подробности в §5.
- Не пушь в production и не запускай «ship + push» сам — это шаг владельца после твоей работы.

---

## 3. Домен: сайт на apex, кабинет на app

### 3.1 Что изменить

`traefik/dynamic.yml` (file provider, `watch: true`; статическая конфигурация в `traefik/traefik.yml`: `:80`/`:443`, Let's Encrypt HTTP-01):

- Роутер `apex-redirect` переименуй в `site-apex`: Host `era-365.online`, entryPoints `websecure`, `tls.certResolver: letsencrypt`, **без middleware**, `service: orchestrator-web`.
- Middleware `apex-to-app` удали.
- Добавь middleware `www-to-apex`: `redirectRegex` с `www.era-365.online` → `https://era-365.online/${1}`, `permanent: true`.
- Добавь роутер `site-www`: Host `www.era-365.online`, websecure, tls letsencrypt, middleware `www-to-apex`, service `noop` или `orchestrator-web`, приоритет выше.
- HTTP→HTTPS не ломай. Роутеры app не трогай.
- Обнови `docs/ECOSYSTEM_URLS.md`: apex больше не «redirect → app», а публичный сайт.

То же Next-приложение обслуживает оба хоста. В `era-orchestrator/apps/web/middleware.ts` введи разделение по `host` (сейчас host-логики нет):

- На apex `era-365.online` публичные пути отдаются как есть. Пути кабинета (`/login`, `/register-org`, `/workspace`, `/partner`, `/holdings`, `/super-admin` и остальные закрытые) — 308 на тот же путь на `app.era-365.online`.
- На `app.era-365.online` пути кабинета как есть. Публичные пути (`/`, `/az|/ru|/en/…`, `/satellites`, `/industries`, `/pricing`, `/calc`, `/calculator`, `/demo`, `/contact`, `/help`, `/terms`, `/privacy` и их локализованные варианты) — 308 на apex.
- Коррень app `/`: не делай серверный 308 на apex (сломает вход). Оставь клиентский редирект: авторизован → workspace, гость → apex.
- Ссылки «Войти» и «Регистрация» — абсолютные на app. Токены кабинета в `localStorage` (`lib/auth-context.tsx`, `lib/orch-api.ts`), к origin `app` уже привязаны, вход только там. Кука `era_i18n_lang` (`lib/locale-client.ts`) должна ставиться с `Domain=.era-365.online`, Secure, Path=/, SameSite=Lax, чтобы язык был общим. В `lib/platform-origin.ts` проверка `host.endsWith(".era-365.online")` не захватывает apex — поправь: apex это сайт, не platform console.

Хосты в коде держи константами (`era-365.online`, `app.era-365.online`) плюс значения из `system_config` (см. §4) для canonical, ссылок и CRM. Middleware может использовать константы: middleware не обязана ходить в БД на каждый запрос. Не заводи `NEXT_PUBLIC_SITE_ORIGIN` / `NEXT_PUBLIC_APP_ORIGIN`.

Критерии: `https://era-365.online/` и `https://era-365.online/az` отдают 200 и серверный HTML сайта, не 308 на app. `https://www.era-365.online/…` — 308 на apex. `https://app.era-365.online/login` — 200. `https://app.era-365.online/az` (и другие публичные) — 308 на apex. Вход и сессия на app не ломаются. Куки сайта не протекают в кабинет как auth.

---

## 4. Настройки в БД, без `.env`

### 4.1 Механизм, который уже есть

Таблица `system_config` и модель Prisma `SystemConfig` в `era-orchestrator/packages/database/prisma/schema.prisma` (поля `id`, уникальный `key`, `value` типа Json, `updatedAt`). Сервис: `era-orchestrator/apps/api/src/system-config/system-config.service.ts`, модуль глобальный — `system-config.module.ts`. Базовые методы: `getJson(key)`, `setJson(key, value)`, плюс типизированные геттеры для биллинга и квот. Белый список ключей Super-Admin — `adminSystemConfigDefinitions()`.

HTTP для этого сервиса уже есть в finance-core: `era-finance-core/apps/api/src/admin/admin.controller.ts` (`GET/PUT /system-config`, `POST /system-config/:key/reset`). В оркестраторе тех же роутов нет — добавь эквивалент под Super-Admin (`JwtAuthGuard` + `SuperAdminGuard` + `ADMIN_PLATFORM`), например `GET/PUT /v1/admin/system-config` и reset. Страница настроек сайта — в существующем Super-Admin (`apps/web/app/super-admin/…`; уже есть `landing/page.tsx` и `billing/settings/page.tsx`).

Секреты в оркестраторе шифруются через `encryptText` / `decryptText` в `era-orchestrator/apps/api/src/security/pii-crypto.util.ts` (AES-256-GCM, формат `v1.iv.ciphertext.tag`). Так уже хранятся секреты фискальных устройств и платёжных методов (`fiscal-hardware-device.service.ts`, `org-payment-method.service.ts`, `org-access-credential.service.ts`). Ключ шифрования процесса — `PII_ENCRYPTION_KEY` (уже требуется процессу, это не настройка сайта). **Не клади секреты в `system_config.value` открытым текстом.** Для секретных ключей храни шифротекст (строка от `encryptText`) и в админке показывай только маску.

### 4.2 Ключи, которые нужно завести

Добавь их в `adminSystemConfigDefinitions()` с подходящими `valueKind` (при необходимости расширь типы: `url`, `string`, `secret`, `boolean`). Сид/миграция записывает стартовые значения идемпотентно (`upsert` только если ключа ещё нет, заполненные человеком значения не затирай).

| key | Стартовое значение | Примечание |
|---|---|---|
| `site.origin` | `https://era-365.online` | Публичный сайт |
| `site.app_origin` | `https://app.era-365.online` | Кабинет |
| `site.crm_origin` | `https://crm.era-365.online` | Публичный origin CRM |
| `site.crm_internal_url` | внутренний URL CRM, если в docker он отличается; иначе тот же origin | Серверный POST формы |
| `site.demo_form_public_id` | пишет сид из §9 | Не секрет |
| `site.demo_form_webhook_secret` | пишет сид, **encryptText** | Секрет |
| `site.crm_organization_id` | пишет сид, uuid/cuid организации ERA | Чтобы сид был идемпотентным |
| `site.contact_phone` | `+994 77 350 70 70` | |
| `site.contact_phone_e164` | `+994773507070` | для `tel:` и `wa.me` |
| `site.contact_email` | `chingiz@era-365.online` | Корпоративный, основной контакт |
| `site.contact_address` | `""` | Пусто |
| `site.legal_name` | `""` | Пусто |
| `site.voen` | `""` | Пусто |
| `site.trust_blocks_enabled` | `false` | Блоки доверия скрыты |
| `site.catalog_cache_version` | число, по умолчанию 0 | Бамп при изменении публичного каталога |

Адрес, юрлицо и VÖEN не выдумывать. Пока `site.contact_address`, `site.legal_name` и `site.voen` пустые — блок адреса / JSON-LD Organization с адресом на сайте скрыт. Телефон, WhatsApp и e-mail показываются.

### 4.3 KEK CRM

`CRM_INTEGRATIONS_KEK` сегодня читается из `process.env` в `packages/integrations-kit/src/crypto.ts` (`resolveKek()`, fail-closed, без fallback на JWT_SECRET). Им шифруется `IntegrationConnection.secretsEnc`. Включение подключения без KEK в `connections.service.ts` уже запрещено.

Задача: перестать требовать KEK «из .env файла». Сделай резолв в таком порядке:

1. Если в БД CRM уже есть сохранённый KEK — использовать его.
2. Если в процессе случайно задан `process.env.CRM_INTEGRATIONS_KEK` (deploy/secret, не файл репозитория) и в БД пусто — один раз перенести значение в БД и дальше читать оттуда.
3. Если нет ни там, ни там — в идемпотентном сиде §9 сгенерировать криптостойкое значение, сохранить в БД и использовать. На последующих стартах, если в БД пусто, по-прежнему fail-closed.

Где хранить в CRM: отдельной универсальной KV-таблицы нет (`CrmOrgSettings` содержит только `convertSideEffectsJson`). Добавь простую таблицу настроек CRM (например `crm_system_config` с `key` + `value`, по аналогии с `system_config` оркестратора) или расширь схему минимально. Само значение KEK — секрет; если кладёшь копию и в `system_config` оркестратора, только через `encryptText`. Не логируй и не отдавай KEK в Super-Admin API открытым текстом. Существующие `secretsEnc` должны продолжать расшифровываться: если KEK уже был задан в runtime, его и персистируй, новый не генерируй поверх.

`PII_ENCRYPTION_KEY` не переноси в каталог сайта: это ключ процесса, им как раз шифруются секреты в БД. Его не документируй как «пропиши в .env» и не добавляй в `.env.production.example`.

Приложение (сайт, API) читает origin, контакты и id формы через `SystemConfigService`, а не через `process.env`.

---

## 5. Каталог с сайта = каталог оркестратора в БД

### 5.1 Где лежат ключи (уже есть)

Коммерческие ключи сателлитов и модулей:

- Таблица `satellites`, модель `Satellite` (`key` PK, `name`, `verticalSlug`, `sortOrder`). Комментарий в схеме: «Industry satellite metadata (app gate keys `industry_*`)».
- Таблица `pricing_modules`, модель `PricingModule` (`key` unique, `name`, `pricePerMonth`, `isPremium`, `sortOrder`, `catalogKind`, `satelliteKey` → `satellites.key`, `trialEligibleInTrial`).
- Сид: `era-orchestrator/packages/database/prisma/lib/core/pricing-module-seed.ts`. Функция `ensureSatellites()` создаёт `finance_core` (`verticalSlug: "finance"`) и строки из `INDUSTRY_SATELLITE_SEED`. Экспорты: `seedPricingModuleIfEmpty`, `ensureMissingPricingModules`, `syncPricingModuleCatalog` (реэкспорт в `packages/database/index.ts`).
- Канон и вывод ключа сателлита: `pricing-catalog-canon.ts`, `pricing-module-keys.ts`, `hotel-module-keys.ts`.
- Константы гейтов: `era-orchestrator/apps/api/src/subscription/satellite-keys.constants.ts` (`FINANCE_CORE_SATELLITE_KEY = "finance_core"`, `INDUSTRY_SATELLITE_KEYS`).
- Маркетинг карточек лендинга (старый HubGrid, только az/ru, слаги вроде `finance`, `manufacturing_wip`, `fixed_assets`, `industry_solutions`): таблица `landing_module_marketing`, сид `landing-modules.ts` / `landing-modules-seed.ts`. Публичный API: `GET /v1/public/landing-modules` (`apps/api/src/admin/public-landing.controller.ts`, сервис `landing-marketing.service.ts`). Админка: `GET/PATCH /v1/admin/landing-modules`, UI `apps/web/app/super-admin/landing/page.tsx`. DTO сейчас без `en` — расширь до az/ru/en, но **это не замена каталога продуктов**.
- Публичные цены: `GET /v1/public/pricing` (`public-pricing.controller.ts`), прокси в next.config `/api/public/pricing`, клиент `apps/web/lib/pricing/fetch-public-pricing.ts`.
- Статичный справочник сайта, который нужно перестать считать источником правды: `apps/web/lib/satellites/public-satellite-catalog.ts` (слиги `finance`, `hotel`, … `data-hub` и соответствие `industry_hotel_pms` → `hotel`). Файл можно оставить на время как fallback, но страницы, меню и sitemap должны идти из API.

`PricingBundle` / `pricing_bundles` — это коммерческие пакеты биллинга (`moduleKeys`, trial default), **не** отраслевые бандлы сайта. Их не переиспользуй как «Отрасли».

Сейчас в `satellites` нет строк для Workforce и Data HUB: они живут только как модули `platform_workforce_*` и `platform_reference_data` / `platform_datahub_silver` / `platform_datahub_gold`.

### 5.2 Чего не хватает и что добавить

У `Satellite` и `PricingModule` нет полей публичного контента, видимости, зрелости и картинки. Не раздувай биллинговые таблицы. Сделай отдельные таблицы профиля (имена можно уточнить, смысл такой):

- `SatellitePublicProfile` — `satelliteKey` PK (FK на `satellites.key`), `publicSlug` unique (URL), `visibility` (`VISIBLE` | `HIDDEN` | `DRAFT`), `maturity` (`prod` | `pilot`), `sortOrder`, JSON `names` / `descriptions` / `tagline` / `body` в виде `{az, ru, en}`, поле изображения (id ассета или URL из уже принятого в проекте хранилища), флаги вроде `showOnSite`.
- `PricingModulePublicProfile` — то же для `pricing_modules.key`: видимость, зрелость (можно переопределить модуль, например `banking_dbo` = Pilot при общем уровне), тексты az/ru/en, картинка, `sortOrder`, опционально «показывать как подраздел страницы продукта».
- `SiteIndustry` и `SiteIndustryItem` — отрасли и состав, см. §6.

Миграция Prisma в `era-orchestrator/packages/database/prisma/migrations/`. Сид профилей идемпотентный, рядом с `pricing-module-seed.ts` / `landing-modules-seed.ts`. Стартовые `publicSlug` возьми из сегодняшних URL: `finance`, `hotel`, `clinic`, `fnb`, `retail`, `auto`, `logistics`, `construction`, `wholesale`, `crm`, `banking`, `data-hub`, плюс `workforce`.

Для Workforce и Data HUB добавь строки в `satellites` (например ключи `platform_workforce` и `platform_datahub`, `verticalSlug` `workforce` / `data-hub`), **не** вноси их в `INDUSTRY_SATELLITE_KEYS` и не подключай к Connect/trial без отдельной явной необходимости. `syncPricingModuleCatalog` должен связать существующие platform-модули с этими ключами через `satelliteKey`, не ломая цены.

После сида профилей `ensureSatellites` / `ensureMissingPricingModules` должны также создавать «пустой» публичный профиль для нового ключа: `visibility=VISIBLE` (или `DRAFT`, если ключ ещё не для витрины — по умолчанию для новых коммерческих industry/core ключей лучше `VISIBLE` с пустым описанием, чтобы страница появилась сама; platform-черновики оставляй `DRAFT`, пока явно не открыты). Решение зафиксируй в коде одним правилом и следуй ему.

### 5.3 Статусы, которые нужно записать в сид (задача, не «открытый вопрос»)

Формально все 14 редакций в `docs/editions/*.yaml` имеют `status: mvp`, `pilot_ready: false`, в `docs/acceptance/*-Product-Readiness-Matrix.md` везде «do not claim GA». Ниже — рабочие значения, выведенные из матриц и аудитов. Запиши их в публичные профили. Меняться они должны в админке, одной записью БД, без деплоя.

Продукты, `maturity = prod` (бейджа нет):

| publicSlug | satellite.key | Основание |
|---|---|---|
| `finance` | `finance_core` | Gate и BE в порядке, UI 🟡; допущение |
| `hotel` | `industry_hotel_pms` | UI/Demo ✅, «mvp showable; KKM STUB» |
| `fnb` | `industry_fnb_pos` | BE ✅ UI 🟡; допущение |
| `auto` | `industry_auto_service` | BE ✅ UI 🟡; допущение |
| `logistics` | `industry_logistics` | BE ✅ UI 🟡; допущение |
| `wholesale` | `industry_wholesale` | BE ✅ UI 🟡; допущение |
| `crm` | `industry_crm` | BE ✅; аудит CRM v5: 33 из 56; допущение |
| `workforce` | `platform_workforce` (новая строка) | допущение |

Продукты, `maturity = pilot` (бейдж «Pilot»):

| publicSlug | satellite.key | Основание |
|---|---|---|
| `clinic` | `industry_clinic` | UI 🟡, fiscal/HL7 STUB; аудит: 1 готово / 15 частично / 13 нет |
| `retail` | `industry_retail` | fiscal/marketplace field open |
| `construction` | `industry_construction` | lab templates open; gap-анализ: 5 есть / 20 частично / 7 нет |
| `banking` | `industry_banking` | Full CBS, Pilot field ⏸ partner; аудит банка v4: 2 готово / 20 частично / 2 нет |
| `data-hub` | `platform_datahub` (новая строка) | BE 🟡, API product |

На уровне модулей поставь Pilot как минимум: `clinic_sanatorium`, `clinic_inpatient`, `clinic_telehealth`, `hotel_medical_sanatorium`, `banking_dbo`, `banking_loans`, `banking_collections`. Остальные модули наследуют зрелость сателлита, пока не переопределены.

Бейдж «Pilot» на карточке, в меню и в H1 страницы. Если у отрасли хотя бы один продукт с ролью C (ядро) в статусе Pilot — отрасль тоже Pilot (можно переопределить в `SiteIndustry`).

### 5.4 Публичный API, кэш, страницы без пересборки

Добавь публичный read-only API оркестратора, например:

- `GET /v1/public/site-catalog` — видимые продукты, модули, отрасли, тексты текущим языком или всеми локалями, статусы, slugs, картинки, состав бандлов, порядок.
- `GET /v1/public/site-catalog/satellites/:publicSlug` — карточка продукта + видимые модули.
- `GET /v1/public/site-catalog/industries/:slug` — отрасль и состав.

Черновики (`DRAFT`) и `HIDDEN` в ответ не попадают. Цены по-прежнему можно брать из `/v1/public/pricing` (не дублируй биллинг в маркетинговом API).

Сайт (`apps/web`):

- Серверные страницы и меню получают каталог с этого API.
- Кэш: `unstable_cache` / ISR / `revalidateTag` (тег вроде `site-catalog`). При сохранении профиля в админке бампай `site.catalog_cache_version` и вызывай `revalidateTag` (или эквивалент). TTL на крайний случай (например 60–300 с), чтобы новый ключ всё равно появился без деплоя.
- `app/sitemap.ts` строится динамически из видимого каталога + статические страницы, с alternates az/ru/en.
- Маршруты: `/{locale}/satellites/[slug]` и подраздел модуля `/{locale}/satellites/[slug]/[moduleKey]` (или якорь `#{moduleKey}`, если отдельная страница избыточна — но у модуля с собственным текстом должна быть своя страница или устойчивый якорь, попадающий в меню и sitemap).
- `publicSlug` — то, что в URL. Старые адреса `/satellites/hotel` и т. д. сохраняются. Если кто-то откроет коммерческий ключ (`/satellites/industry_hotel_pms`), сделай 308 на `publicSlug`.
- Нет описания — рендери минимальную карточку: локализованное имя (или `Satellite.name` / `PricingModule.name` как fallback) и список видимых модулей. Не подставляй выдуманный маркетинговый текст.
- Админка Super-Admin: расширь `super-admin/landing` (или соседний раздел) редактированием профилей сателлита, модуля и отрасли — az/ru/en, порядок, видимость, Pilot/prod, картинка. Это единственное место, где контент меняется после запуска.

---

## 6. Отрасли (бандлы) в БД

Таблица `SiteIndustry` (`slug`, тексты az/ru/en, `sortOrder`, `visibility`, опционально `maturityOverride`, картинка, калькуляторные ключи/ёмкости для `?q=`) и `SiteIndustryItem` (`industrySlug`, `satelliteKey`, роль `C` | `I` | `O`, флаг `assumed` для допущений, `sortOrder`). Ссылки только на реальные `satellites.key`.

Сид — из таблицы ниже, идемпотентно. Строки с ⚑ запиши с `assumed=true`. Статус отрасли = Pilot, если Pilot у любого элемента с ролью C (если нет `maturityOverride`).

Роли: C = ядро, I = входит, O = опционально. ⚑ = допущение, которое нужно оставить явным в админке (фильтр «допущения»), но на публичной витрине не писать слово «допущение»; просто показывать состав.

| Отрасль | slug | Состав | Статус |
|---|---|---|---|
| Отели | `hotels` | Hotel PMS (C), F&B POS (I), ERA Core (I), Workforce (I), CRM (I), Retail POS (O, Pilot) ⚑ | prod |
| Санатории | `sanatoriums` | Hotel PMS + модуль `hotel_medical_sanatorium` (C), Clinic (C, Pilot), F&B POS (I), Retail POS (I, Pilot), ERA Core (I), Workforce (I), CRM (O) | Pilot |
| Клиники | `clinics` | Clinic (C, Pilot), ERA Core (I), Workforce (I), CRM (I), Retail POS (O, Pilot, аптечный киоск ⚑) | Pilot |
| Больницы | `hospitals` | Clinic + `clinic_inpatient` + `clinic_nurse_roster` (C, Pilot), ERA Core (I), Workforce (I), F&B POS (I, столовая ⚑), Retail POS (O, аптека ⚑), CRM (O) | Pilot |
| Рестораны и кафе | `restaurants` | F&B POS (C), ERA Core (I), Workforce (I), CRM (I), Retail POS (O, Pilot) ⚑ | prod |
| Банки | `banks` | Bank CBS (C, Pilot), Bank CBS · ДБО `banking_dbo` (C, Pilot), Workforce (I), ERA Core (I), CRM (I), Data HUB (O, Pilot) ⚑ | Pilot |
| Лизинг и НБКО | `leasing-nbco` | Bank CBS · кредиты и лизинг `banking_loans` / `banking_collections` (C, Pilot), Bank CBS · ДБО, кабинет заёмщика (I, Pilot), ERA Core (I), Workforce (I), CRM (I), Data HUB (O, Pilot) | Pilot |
| Розница | `retail` | Retail POS (C, Pilot), ERA Core (I), CRM (I), Workforce (I), Wholesale (O), Data HUB (O, Pilot) ⚑ | Pilot |
| Опт | `wholesale` | Wholesale (C), ERA Core (I), Logistics (I), CRM (I), Workforce (I), Retail POS (O, Pilot) ⚑ | prod |
| Автосервис | `auto-service` | Auto Service (C), ERA Core (I), CRM (I), Workforce (I), Retail POS (O, Pilot, магазин запчастей ⚑) | prod |
| Логистика | `logistics` | Logistics (C), ERA Core (I), Workforce (I), CRM (I), Wholesale (O), Auto Service (O) ⚑ | prod |
| Строительство | `construction` | Construction (C, Pilot), CRM (I), ERA Core (I), Workforce (I), Logistics (I) ⚑, Wholesale (O) ⚑ | Pilot |

В меню «Отрасли» у каждой отрасли показывай превью состава (5–6 продуктов с ролями и бейджем Pilot). На странице отрасли состав обязателен, каждый элемент ведёт на страницу продукта (и на модуль, если роль завязана на конкретный ключ вроде `banking_dbo`).

Ключи модулей для предвыбора калькулятора и якорей сверь с `pricing-module-seed.ts`. Известные: `hotel_medical_sanatorium`, `clinic_sanatorium`, `clinic_inpatient`, `clinic_nurse_roster`, `clinic_registry_emr`, `clinic_telehealth`, `banking_dbo`, `banking_loans`, `banking_collections`, `construction_boq`. Неуверенные помечай TODO в сиде и проверь по сиду, не выдумывай ключи.

`/kafe` оставь как быстрый старт кафе и используй как подпункт «Рестораны и кафе», если страница живая.

---

## 7. Языки: AZ / RU / EN в URL

Сделай полное покрытие публичной части на трёх языках. Переведи пять TS-модулей (`landing-copy.ts`, `landing-ecosystem-data.ts`, `satellite-page-copy.ts`, `pricing-storefront-copy.ts`, `pricing-meters-copy.ts`; EN уже есть у `calc-copy.ts`) и вынеси новые строки сайта в пространство next-intl `site` в `messages/{az,ru,en}.json`. Маркетинговые тексты продуктов и отраслей — в профилях БД (az/ru/en), не в статическом TS.

Маршруты: `app/[locale]/…` с `locale` ∈ {`az`,`ru`,`en`}. Cookie `era_i18n_lang` сохрани, но канонический URL всегда с префиксом. Определение языка при входе на `/`: cookie, затем `Accept-Language`, иначе `az` (текущий публичный дефолт), затем 308 на `/{locale}/…`.

Редиректы 308 со старых адресов (без префикса): `/` → `/{locale}` (через определение языка), `/satellites`, `/satellites/:slug`, `/pricing`, `/calc`, `/calculator`, `/demo`, `/contact`, `/help`, `/terms`, `/privacy` и якоря. Сохрани рабочие `/login`, `/register-org` на app без префикса, если так сейчас.

hreflang x-default — `az`. Canonical на apex с префиксом локали. Скрипт проверки паритета ключей `site` во всех трёх файлах messages и в JSON профилей БД (отсутствие en в профиле не ошибка, если есть fallback на имя из каталога).

### Глоссарий для английской версии (единые термины)
Бренд и имена продуктов не переводятся: ERA 365, ERA Core, Hotel PMS, Clinic, F&B POS, Retail POS, Auto Service (в старых строках «Auto STO», в EN писать **Auto Service**), Logistics, Construction, Wholesale, CRM (в старых строках «CRM Field», в EN **CRM**), Bank CBS, Data HUB, Workforce, Foundation, Gate, Trial, VÖEN, NAS/MMUS, IFRS, e-qaimə, e-taxes, Tax Pro, Trade Pro, Compliance Pro, 1C, AzeriCard, AZIPS, PIN, KDS, SKU, SSO, AML, OCR, API.

| ru | az | en |
|---|---|---|
| Решения | Həllər | Solutions |
| Отрасли / Отраслевые решения | Sənaye həlləri | Industries |
| продукт (бывш. спутник) | məhsul (bu mənada «peyk» yazma) | product |
| Тарифы | Tariflər | Pricing |
| Калькулятор | Kalkulyator | Calculator |
| Запросить демо | Demo sifariş et | Request a demo |
| Начать 3 месяца бесплатно | 3 ay tam pulsuz başla | Start 3 months free |
| Войти | Daxil ol | Sign in |
| Регистрация | Qeydiyyat | Sign up |
| Пилот (бейдж) | Pilot | Pilot |
| Учёт (бухгалтерский) | Uçot | Accounting |
| Касса и банк | Kassa və bank | Cash and bank |
| Склад | Anbar | Warehouse |
| Производство и НЗП | İstehsalat və NAT | Manufacturing and work in progress (WIP) |
| Основные средства | Əsas vəsaitlər | Fixed assets |
| Кадры и зарплата | Kadr və əməkhaqqı | HR and payroll |
| НДС | ƏDV | VAT |
| Нац. стандарты бух. учёта | Milli Mühasibat Uçotu Standartları | National Accounting Standards (NAS / MMUS) |
| Модуль | Modul | Module |
| Пакет | Paket | Bundle |
| Платформенные add-on | Platforma add-on | Platform add-ons |
| Справочники и обмен | Soraqçalar və mübadilə | Reference data and exchange |
| Бронь / шахматка | Rezervasiya / şahmat cədvəli | Reservation / room chart |
| Фолио гостя | Qonaq folio | Guest folio |
| Ночной аудит | Gecə auditi | Night audit |
| Уборка (HK) | Otaq təmizliyi (HK) | Housekeeping (HK) |
| Канал-менеджер / дистрибуция | Distribusiya | Channel manager / distribution |
| Санаторий | Sanatoriya | Sanatorium |
| Стационар / койки | Stasionar / çarpayı | Inpatient / beds |
| Больница | Xəstəxana | Hospital |
| Клиника | Klinika | Clinic |
| ЭМК | EMR (elektron tibbi qeyd) | EMR (electronic medical record) |
| Лаборатория | Laboratoriya | Laboratory |
| Страхование (медицинское) | Sığorta | Insurance |
| График медсестёр | Tibb bacıları cədvəli | Nurse roster |
| Кабинет (врача) | Kabinet | Room (treatment room) |
| Зал, кухня KDS | Zal, KDS mətbəx | Dining room, kitchen display (KDS) |
| Касса (POS) | Kassa (POS) | Register (POS terminal) |
| Точка доставки | Çatdırılma | Delivery hub |
| Пост (автосервис) | Post | Service bay |
| Заказ-наряд | İş əmri | Work order |
| Путевой лист | Yol vərəqəsi | Waybill |
| Водитель, POD | Sürücü, POD | Driver, proof of delivery (POD) |
| Площадка / объект | Obyekt | Site |
| Смета | Smeta | Estimate (BOQ) |
| Акт выполненных работ | Görülmüş işlərin aktı | Completion certificate |
| Субподряд | Subpodrat | Subcontracting |
| Опт / дистрибуция | Topdan satış | Wholesale / distribution |
| Кредитный лимит | Kredit limiti | Credit limit |
| Лид | Lead | Lead |
| Полевые визиты | Sahə vizitləri | Field visits |
| Единый инбокс | Omni inbox | Omnichannel inbox |
| Банк (CBS/АБС) | Bank (CBS) | Core banking system (CBS) |
| ДБО | DBO (rəqəmsal bank) | Digital banking (online and mobile banking) |
| НБКО | BOKT (bank olmayan kredit təşkilatı) | Non-bank credit organization (NBCO) |
| Лизинг | Lizinq | Leasing |
| Кредиты, депозиты, платежи | Kreditlər, depozitlər, ödənişlər | Loans, deposits, payments |
| Регуляторная отчётность | Tənzimləyici hesabatlar | Regulatory reporting |
| Филиал | Filial | Branch |
| Sandbox / Pilot | Sandbox / Pilot | Sandbox / Pilot |
| Шифрование на клиенте, нулевой доступ | Lokal şifrələnmə, sıfır giriş | Client-side encryption, zero access (Zero-Knowledge) |
| Заявка на демо | Demo sorğusu | Demo request |
| Вопросы и ответы | Tez-tez verilən suallar | FAQ |
| Условия / Конфиденциальность / Статус | Şərtlər / Məxfilik / Status | Terms / Privacy / Status |
| в месяц | ay | per month |

Стиль EN: короткие деловые фразы, заголовки в sentence case, без рекламных превосходных степеней, сумма как `29 AZN / month`, форматирование чисел через `Intl.NumberFormat("en")`. Существующие английские строки калькулятора (`calc-copy.ts`) считай эталоном терминов.


---

## 8. Мега-меню и информационная архитектура

Одна шапка `SiteHeader` (вместо трёх копий) и мобильное меню. Desktop слева направо:

- Логотип → `/{locale}`
- «Решения» — мега-меню продуктов из API, сгруппированных по kind (ядро / отраслевые / платформенные). Пункты с бейджем Pilot. Справа карточка-витрина калькулятора (акцент, не кейс). Состав обновляется из каталога, без хардкода списка.
- «Отрасли» — мега-меню 12 отраслей из API; при наведении (и в панели справа) превью состава бандла, каждый продукт кликабелен. Бейдж Pilot у отрасли по правилу §5.3.
- «Ресурсы»: Калькулятор (акцент), Тарифы, Помощь, Контакты.
- Переключатель языка az | ru | en (сохраняет путь, меняет префикс).
- «Войти» — абсолютная ссылка на `site.app_origin` `/login`.
- «Регистрация» — абсолютная ссылка на app `/register-org`.
- Primary CTA «Запросить демо» → `/{locale}/demo`.
- Акцентная (не серая) кнопка «Калькулятор» → `/{locale}/calculator` или сразу `/{locale}/calc`.

Тексты навигации — из глоссария. Мобильное меню: те же разделы аккордеоном, состав бандла раскрывается.

---

## 9. Шаблоны страниц

Дизайн текущий. Якорная навигация на длинных страницах.

`/{locale}/satellites/[slug]` — страница продукта (развивай `satellite-page-view.tsx`): H1, бейдж Pilot, краткое описание, список модулей (ссылки на подразделы), для чего подходит (отрасли, где продукт входит в бандл), CTA демо / калькулятор / тарифы, блок «связанные отрасли». Нет текста — минимальная карточка.

`/{locale}/satellites/[slug]/[moduleKey]` — страница или устойчивый якорь модуля из профиля. 404, если модуль скрыт или не принадлежит этому продукту.

`/{locale}/industries/[slug]` — страница отрасли: H1, бейдж, описание, обязательный блок состава 5–6 продуктов (роль C/I/O, Pilot, ссылка), CTA «Рассчитать для этой отрасли» (deep link калькулятора), «Запросить демо», связанные продукты.

`/{locale}/industries` — индекс всех видимых отраслей.

`/{locale}/demo` и `/{locale}/contact` — см. §11–§12.

`/{locale}/calculator` — лёгкий SSR-лендинг (H1 и 3 шага из `calc-copy.ts`, выбор отрасли как набор ссылок `calcHrefForIndustry`, кнопка «Открыть калькулятор» → `/{locale}/calc`, CTA демо). Сам калькулятор не оптимизировать.

Главная `/{locale}`: Hero (H1 в духе текущего «Учёт и отраслевые продукты — одна платформа», CTA «Запросить демо», «Калькулятор», «Начать 3 месяца бесплатно»), Trial 0 AZN, каталог продуктов из API (живые цены из `/v1/public/pricing`), блок отраслей, FAQ, нижняя CTA, футер. Всё SSR.

---

## 10. Калькулятор: вход и предвыбор

Рабочий калькулятор остаётся на `/calc` (`app/calc/page.tsx`, `components/calc/calc-page-view.tsx`, состояние в `?q=` как JSON `CalcState`: `moduleKeys` + `capacity`). Параметра `preset` в URL нет, `applyPreset` из URL не вызывается. Логику не менять.

Собери хелпер `calcHrefForIndustry(locale, industrySlug)`: читает из профиля отрасли (или, пока поле пустое, из сидовых ключей) набор `moduleKeys` и ёмкостей и строит `/{locale}/calc?q=…`. Пресеты `core`, `hotel_city`, `hotel_resort`, `sanatorium`, `clinic`, `kafe`, `retail` используй как источник ключей: отели — набор городского отеля, санатории — `HOTEL_SANATORIUM` + `clinic_sanatorium`, клиники — `clinic_registry_emr`, кафе — `industry_fnb_pos`. Для отраслей без пресета бери gate-ключи продуктов бандла и модули из §6. Перед сборкой `q` сверь ключи с `snapshot.pricingModules` / `pricing-module-seed.ts`. Если набор выразить нельзя — ссылка просто на `/{locale}/calc` без параметров.

Кнопки калькулятора — в шапке (акцент), меню, hero, страницах продукта и отрасли, футере.

---

## 11. Заявка на демо и сид form_generic

Форма (`/{locale}/demo`, также укороченная на `/contact` и в нижних CTA) поля: имя, компания, телефон, e-mail, отрасль (из каталога), сообщение, источник (скрытое), honeypot, время начала заполнения. Серверный маршрут сайта, например `apps/web/app/api/demo-request/route.ts` (или route внутри `[locale]`), **на сервере** читает `site.demo_form_public_id`, расшифрованный `site.demo_form_webhook_secret`, `site.crm_internal_url` / `site.crm_origin` из `SystemConfig` и делает POST на `POST {crm}/api/integrations/hooks/form_generic/{publicId}` с заголовком `x-webhook-secret` и полями адаптера (`name`, `phone`, `email`, `utm_*`, …). Секрет на клиент не попадает.

Антиспам на маршруте сайта: honeypot, минимальное время заполнения, rate limit по IP, проверка Origin/Host. В CRM уже есть rate limit и математическая капча виджета (`public-hook-guard.ts`) — не ломай их.

Сид (идемпотентный скрипт, например `era-crm/prisma/scripts/ensure-site-demo-form.ts`, плюс вызов из общего seed, если это принято в репозитории):

1. Определи организацию ERA: возьми `site.crm_organization_id`, если уже есть; иначе найди организацию в БД оркестратора по корпоративному e-mail владельца `chingiz@era-365.online` (или явно платформенную org, не demo). Демо-идентификаторы `demo-org`, `demo-clinic-org`, `demo-bank-org-001` запрещены (так уже сделано в `era-crm/prisma/scripts/upsert-ecosystem-demo-user.ts`). Запиши найденный id в `site.crm_organization_id`.
2. Обеспечь KEK по §4.3.
3. Если у этой организации уже есть `IntegrationConnection` с `providerKey="form_generic"` и устойчивым маркером (например `displayName="ERA 365 public site demo"` или запись в config) — переиспользуй `publicId` и секрет (`createConnection` в `era-crm/src/lib/integrations/connections.service.ts`; секрет живёт в `secretsEnc` через `encryptSecretsJson`, колонка `webhookSecret` должна оставаться пустой).
4. Иначе вызови `createConnection({ organizationId, providerKey: "form_generic", displayName: "ERA 365 public site demo" })` и включи подключение (`enabled=true`, статус не DRAFT).
5. Запиши `publicId` и секрет (в оркестраторе — через `encryptText`) в `system_config`. Повторный запуск не создаёт второе подключение и не ротирует секрет без нужды.

Webhook URL в итоге: `{site.crm_origin}/api/integrations/hooks/form_generic/{publicId}`.

---

## 12. Контакты

Публиковать (значения — стартовый сид `system_config`, источник: рабочие подписи писем; личный e-mail не найден и на сайт не идёт):

- Телефон и WhatsApp: `+994 77 350 70 70`. Ссылки `tel:+994773507070` и `https://wa.me/994773507070`.
- Основной e-mail: `chingiz@era-365.online`.
- Адрес, юридическое имя, VÖEN — пустые поля настроек; блок и JSON-LD с адресом скрыты, пока пусто.

`ops@era-365.online` в `traefik/traefik.yml` — служебный адрес Let's Encrypt, не контакт. Страница `/{locale}/contact`: цели обращения (демо, партнёрство, поддержка), форма, телефон, WhatsApp, e-mail. В шапке и футере — те же константы из настроек, не хардкод в трёх компонентах (харкод допустим только как fallback, совпадающий с сидом).

---

## 13. Блоки доверия, футер, SEO, аналитика

Блоки логотипов / кейсов / цифр / наград рендерить только если `site.trust_blocks_enabled === true` и в настройках или отдельной таблице есть реальные данные. Пока флаг false — блока нет. Данных не выдумывать.

Футер `SiteFooter`: карта сайта (Решения, Отрасли, Ресурсы), CTA демо и калькулятор, контакты (как в §12), юридические ссылки, переключатель языка, ©.

SEO: уникальные `generateMetadata` на каждую публичную страницу; canonical на `https://era-365.online/{locale}/…`; hreflang az/ru/en + x-default; Open Graph; JSON-LD Organization (без адреса, пока пусто) + SoftwareApplication / Product где уместно; `app/sitemap.ts` динамический; `app/robots.ts` разрешает сайт на apex, указывает sitemap, не индексирует app и кабинет. Меню и H1 в серверном HTML.

Аналитика сейчас отсутствует. Сделай вендор-независимую обёртку `lib/analytics/track.ts`: `track(event, params)`; если есть `window.dataLayer` — `dataLayer.push`; в development `console.debug`; на сервере ничего. Не подключай GTM и не добавляй cookie. На CTA — `data-track`. События: `cta_demo_click`, `cta_calc_click`, `cta_trial_click`, `cta_login_click` с `location` (`header`, `mobile_menu`, `hero`, `megamenu_solutions`, `megamenu_industries`, `home_calc_block`, `industry_page`, `solution_page`, `footer`, `bottom_cta`, `calculator_landing`, `demo_page`); `nav_menu_open`, `nav_item_click`, `nav_bundle_preview`, `industry_view`, `solution_view`, `demo_form_submit`, `demo_form_error`, `lang_switch`.

---

## 14. Порядок работ

1. Миграции и сиды: публичные профили, отрасли, ключи `system_config`, строки Satellite для workforce/data-hub, расширение админки и API каталога. Записать статусы и составы из §5–§6, включая ⚑ как `assumed`.
2. Сид `form_generic` + KEK по §4.3 и §11, запись ключей в `system_config`.
3. Traefik + host-routing в `middleware.ts` + cookie языка + правка `platform-origin.ts` (§3).
4. Каркас `app/[locale]/…`, 308 со старых URL, `generateMetadata`, sitemap, robots.
5. `SiteHeader` / мега-меню / `SiteFooter` / главная SSR из API каталога.
6. Шаблоны продукта, модуля, отрасли, индекс отраслей.
7. Калькулятор: акцент, `/calculator`, `calcHrefForIndustry` без изменения логики.
8. Страницы демо и контактов, серверный маршрут формы.
9. Полный EN публичной части и глоссарий; паритет ключей.
10. Блоки доверия под флагом (выключены).
11. Аналитика-обёртка и `data-track`.
12. Прогон критериев §15. Деплой на production не делай — его запускает владелец skill-ом «ship + push».

---

## 15. Критерии готовности

- `https://era-365.online/` отдаёт 200 и SSR-HTML сайта, не редирект на app. `www` → apex 308. Вход на app сохраняется.
- Новый видимый сателлит или модуль, добавленный в БД (сид или админка), появляется в меню «Решения», на странице и в sitemap без пересборки фронта (после ревалидации/TTL). Скрытый и DRAFT не появляются.
- 12 отраслей на месте, состав 5–6 продуктов виден в меню и на странице отрасли, статусы Pilot совпадают с §5–§6.
- Workforce и Data HUB имеют публичные страницы.
- Банк, лизинг и НБКО, строительство, больница, санаторий видны, с Pilot где указано.
- Полный EN, префиксы `/az|/ru|/en`, hreflang, 308 со старых URL, паритет ключей.
- Калькулятор с отрасли открывается с предвыбором через `?q=`, если ключи существуют; иначе просто `/calc`. Логика quote не менялась.
- Форма демо создаёт Lead в era-crm через `form_generic`; повторный сид не плодит второе подключение; секрет не торчит в клиенте и в `.env`.
- Контакты на сайте: телефон, WhatsApp, `chingiz@era-365.online`. Адреса и юрблока нет, пока поля пустые. Личного e-mail нет.
- Нет новых site-переменных в `.env*` / Dockerfile / build-images. Origins, CRM, форма, контакты читаются из `system_config`.
- Уникальные title/description, canonical на apex, динамический sitemap, robots.
- Дизайн визуально тот же. `/industry/[vertical]` и биллинг-сид цен не сломаны.
- Бейдж Pilot только из существующих токенов.
- Аналитика-обёртка без GTM и cookie.

---

## 16. Что сделать владельцу вручную

Только деплой: после того как работа в репозитории готова, владелец запускает принятый в проекте skill «ship + push» (`.cursor/skills/era-git-ship`, `era-ship.ps1`). Смена Traefik уезжает этим же деплоем — отдельным письмом «поправь DNS» или «пропиши env» его не нагружай.

Не включать в его чеклист: DNS `www` (уже сделано, A `164.92.151.56`), создание `form_generic`, заполнение env, ручной ввод статусов, адрес и VÖEN (поля ждут данных в админке). Search Console можно подключить после деплоя по желанию, это не блокер задания.

---

## 17. Чего не делать

- Не менять дизайн, цвета, шрифты, радиусы, фон `LandingPageShell`.
- Не трогать логику калькулятора и `packages/satellite-kit`.
- Не создавать новый API `demo-requests` в orchestrator.
- Не вводить `.env` для сайта, origin, CRM, формы или KEK.
- Не выдумывать клиентов, кейсы, награды, адрес, юрлицо, VÖEN.
- Не публиковать личный e-mail владельца.
- Не писать «спутник / сателлит / peyk» в публичных строках.
- Не менять `/industry/[vertical]`, авторизацию и поддомены сателлитов.
- Не затирать публичный контент сидом `syncPricingModuleCatalog`.
- Не добавлять workforce/data-hub в `INDUSTRY_SATELLITE_KEYS` / Connect, если это меняет биллинг и trial.
- Не создавать DNS-запись `www` заново.
- Не запускать production-деплой («ship + push») самостоятельно.
