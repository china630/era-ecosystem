<!-- Split from CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md (Part F). Living tracker: .cursor/plans/crm-integrations-full.plan.md -->

# ЧАСТЬ F. План реализации для Cursor

Порядок задач важен. Каждая задача — один PR размером с одну сессию Cursor. Пути указаны относительно корня `era-ecosystem`.

### Фаза I-0. Фундамент (1,5–2 недели)

| ID | Задача | Файлы / модели | Критерии приёмки |
|---|---|---|---|
| T-I01 | Пакет `packages/integrations-kit`: типы (B3, B4), реестр, HTTP-клиент (таймауты, ретраи 429/5xx, редактирование секретов в логах), крипто AES-256-GCM без fallback | `packages/integrations-kit/src/{types,registry,http,crypto}.ts`, `package.json`, тесты jest | Unit-тесты: шифрование и расшифровка, ошибка без `CRM_INTEGRATIONS_KEK`, маскирование секретов в логе, реестр отдаёт манифесты |
| T-I02 | Prisma-модели B2 + миграция; связи с `Lead`; скрипт миграции `InboxThread` → `Conversation` | `era-crm/prisma/schema.prisma`, `prisma/migrations/2026xxxx_integrations/`, `prisma/scripts/migrate-inbox-threads.ts` | `prisma migrate` проходит; tenant-изоляция покрыта тестом в духе `__tests__/tenant-isolation.spec.ts` |
| T-I03 | Сервис коннектов: CRUD, шифрование, test, enable/disable, аудит | `era-crm/src/lib/integrations/connections.service.ts`, `nest/integrations/connections.controller.ts`, регистрация в `nest/main.ts` | API из B9 работает; секреты не возвращаются; в `SatelliteAuditLog` пишутся все действия; без `admin:integrations` — 403 |
| T-I04 | Гранты B7 + карта роутов + версия каталога прав 3 | `src/lib/auth/permissions.ts`, `api-route-permissions.ts`, `page-route-permissions.ts`, `ensure-system-crm-roles.ts`; тесты `__tests__/crm-rbac*.spec.ts` | RBAC-тесты зелёные; hooks-префикс public |
| T-I05 | Inbound-контроллер: raw body, verify, `InboundEvent` (идемпотентность), challenge-ответы, очередь BullMQ `integration-inbound` | `nest/integrations/hooks.controller.ts`, `src/lib/integrations/inbound.worker.ts`, Redis-конфиг как в orchestrator `queue/bullmq.config` | Повторный POST с тем же ID не создаёт второй записи; неверная подпись → 401 + аудит; ответ быстрее 300 мс |
| T-I06 | Outbox + воркер `integration-outbound` + token bucket в Redis | `src/lib/integrations/outbox.service.ts`, `outbound.worker.ts`, `rate-limiter.ts` | Ретраи по правилам B6; 401 переводит соединение в `ERROR`; лимит соблюдается (нагрузочный тест на моке) |
| T-I07 | UI `/admin/integrations`: каталог, форма из манифеста, webhook URL, test/enable, журнал событий; меню; i18n az/ru/en | `era-crm/app/admin/integrations/**`, `src/components/CrmOpsShell.tsx`, `messages/{az,ru,en}.json` | UAT: создать коннект Telegram-мока, увидеть маску секрета, «Проверить» показывает результат, журнал виден |
| T-I08 | Нормализатор: `NormalizedEvent` → Lead / Неразобранное / Conversation / Message / Call / Activity + события в `@era/contracts` | `src/lib/integrations/normalizer.service.ts`, `packages/era-contracts` (`SATELLITE_CRM_MESSAGE_RECEIVED` и др.) | Входящее сообщение от неизвестного номера создаёт лид в «Неразобранном»; от известного прикрепляется к его лиду (дедуп по E.164) |

### Фаза I-1. Инбокс и P0-каналы (3–4 недели)

| ID | Задача | Файлы | Критерии приёмки |
|---|---|---|---|
| T-I09 | Инбокс UI: 3 колонки (список, чат, карточка), отправка, вложения, назначение, закрытие, окно 24 ч с блокировкой свободного текста | `era-crm/app/inbox/page.tsx` (переписать), `nest/integrations/conversations.controller.ts` | Переписка в реальном времени (polling 5 с); вне окна предлагается шаблон |
| T-I10 | `meta_graph` база + **WhatsApp Cloud** (+ шаблоны, медиа, статусы) + **360dialog**; перевести orchestrator `WhatsappBusinessAdapter` на kit | `packages/integrations-kit/src/providers/{whatsapp_cloud,wa_360dialog}/`, `era-orchestrator/.../whatsapp-business.adapter.ts` | Sandbox-номер Meta: входящие и исходящие, статусы `delivered` / `read`, подпись проверяется, версия Graph берётся из настроек |
| T-I11 | **Telegram Bot** (+ Business mode) | `providers/telegram_bot/` | `setWebhook` при enable с `secret_token`; `deleteWebhook` при disable; `business_message` отвечает с `business_connection_id` |
| T-I12 | **Instagram Direct** (OAuth-приложение платформы) | `providers/instagram/`, `app/admin/integrations/oauth/callback` | OAuth-подключение; входящие и ответы; токен обновляется до истечения |
| T-I13 | **Email IMAP/SMTP** + треды | `providers/email_imap_smtp/`, polling-воркер | Письмо клиента появляется в карточке; ответ из CRM уходит в тот же тред |
| T-I14 | **Webchat-виджет** + **generic lead webhook** + **Tilda** | `era-crm/public/widget.js` (или отдельный бандл), `providers/{webchat,form_generic,form_tilda}/` | Виджет на тестовой странице; Tilda test-запрос → 200; лид с UTM создаётся |
| T-I15 | **SMS LSIM** + `sms_generic` | `providers/{sms_lsim,sms_generic}/` | Отправка и отчёт о доставке через polling; balance в «Проверить» |

### Фаза I-2. Телефония P0 (3–4 недели)

| ID | Задача | Файлы | Критерии приёмки |
|---|---|---|---|
| T-I16 | Модель звонков в UI: всплывающая карточка звонящего (SSE), журнал звонков в карточке лида, плеер записи, кнопка «Позвонить» | `era-crm/app/leads/[id]/page.tsx`, `nest/integrations/calls.controller.ts`, `/api/realtime` | Входящий тестовый звонок открывает карточку у нужного сотрудника; запись проигрывается |
| T-I17 | `zadarma_like` + **Zadarma** + **Novofon** | `providers/{zadarma,novofon}/` | Все `NOTIFY_*` нормализуются; подпись проверяется; callback работает; запись копируется в storage |
| T-I18 | `signed_json_sha256` + **Mango Office** (+ Ростелеком в P1) | `providers/mango_office/` | `events/call` и `summary`; `commands/callback`; подпись верна |
| T-I19 | `generic_call_webhook` + **Sipuni** + **VirtualATS.az** (после получения спецификации) | `providers/{generic_call_webhook,sipuni,virtualats_az}/` | Маппинг в UI; события 1/2/3 Sipuni; «Своя АТС» настраивается без кода |
| T-I20 | **`era-pbx-bridge`** (Docker, Node): AMI-клиент → HMAC-вебхук; Originate; upload записей | новая папка `tools/era-pbx-bridge/` (или `apps/`), `providers/asterisk/` | На тестовом Asterisk в Docker: входящий, исходящий, пропущенный; click-to-call; запись в карточке |
| T-I21 | Сопоставление сотрудников и внутренних номеров, задача «Перезвонить» на пропущенный | вкладка UI + `UserTelephonyExtension` | Пропущенный звонок создаёт задачу ответственному |

### Фаза I-3. P1-каналы и АТС (4–6 недель)

- **T-I22.** Viber, VK, MAX: семейства `hmac_body` и `bot_webhook_secret`.
- **T-I23.** Facebook Messenger, Meta Lead Ads, Google Ads lead form.
- **T-I24.** Gmail API и Microsoft Graph mail (OAuth, renew-cron).
- **T-I25.** Семейство `vats_crm_api`: МегаФон, Гравител, МТС ВАТС.
- **T-I26.** Ростелеком, Билайн (Xsi renew), UIS, OnlinePBX, Телфин, 3CX, Twilio Voice.
- **T-I27.** Wazzup и Twilio WhatsApp/SMS, MSM.az (после получения спецификации).
- **T-I28.** Календари Google и M365 (E1, E2), ICS-фид (E4).
- **T-I29.** Публичные исходящие вебхуки и API-ключи (E14, E15).

**Критерии приёмки для каждой задачи фазы:**
- манифест с `setupSteps` на az/ru/en;
- `testConnection`;
- верификация подписи;
- unit-тесты нормализации на сохранённых примерах payload (`__fixtures__/`);
- запись в UAT-чеклисте `era-crm/doc/UAT-SMOKE.md`.

### Фаза I-4. P2 (по запросу клиентов)

- Мессенджеры: Telegram userbot, Green-API (с явным согласием на риск блокировки), WeChat, LINE, Apple MfB (только через MSP), OK, Avito.
- Телефония: остальные CPaaS и облачные телефонии; FreeSWITCH.
- Аналитика и AI: Meta CAPI, Google Ads conversions, GA4, BI-экспорт, транскрибация, LLM.
- Публичный «телефонный API ERA» в стиле Bitrix24 `externalcall`.

### Сквозные требования (Definition of Done для всех коннекторов)

1. Секреты зашифрованы; в API и логах никогда не появляются.
2. Подпись входящих проверяется; при её отсутствии у провайдера используются секретный URL и опциональный IP allowlist.
3. Идемпотентность входящих и исходящих.
4. Ретраи и rate limit по манифесту.
5. Аудит включения и выключения, изменения и ротации ключей.
6. Падение провайдера не ломает CRM: статус `ERROR`, видимая ошибка, повтор вручную.
7. Фикстуры payload и unit-тесты нормализации.
8. Инструкция подключения в UI на трёх языках.
9. ENV-переменные: только платформенные (`CRM_INTEGRATIONS_KEK`, OAuth `appId`/`appSecret` приложений Meta/Google/Microsoft, `REDIS_URL`, `PUBLIC_BASE_URL`). Всё per-tenant — в `IntegrationConnection`.

### Что запросить у вендоров до старта (блокеры)

| Что | У кого | Зачем |
|---|---|---|
| Meta App (WhatsApp, Instagram, Messenger, Lead Ads), Business Verification, App Review | Meta | P0 WA и IG |
| Спецификация API | VirtualATS.az (info@azerizone.net), MSM (info@msm.az), Collabo.az | AZ телефония и SMS |
| Тестовые аккаунты | Zadarma / Novofon, Mango, Sipuni, LSIM | Отладка P0 |
| Решение по Viber | Партнёр Rakuten Viber (EUR 100–115 в месяц за бота) | P1 |
| Google OAuth verification (Gmail restricted scopes) | Google | P1 email |
