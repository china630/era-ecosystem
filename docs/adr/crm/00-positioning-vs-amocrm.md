<!-- Split from CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md (Part A). Index: ./README.md -->

# ЧАСТЬ A. Gap-анализ: ERA CRM (`era-crm`) против amoCRM


## A0. TL;DR

- **Что такое наш CRM.** ERA CRM Field (`era-crm`) — это лёгкая pre-sale воронка: лид → квалификация → визит → конверсия в Finance. Стек: Next.js UI, Nest HTTP-edge, Prisma/PostgreSQL. В `prisma/schema.prisma` 15 моделей. Сущности: один объект `Lead`, 6 фиксированных стадий в enum, `Visit` с геоточкой и `InboxThread` (только метаданные).
- **Что такое amoCRM.** Зрелая sales-CRM, построенная вокруг мессенджеров:
  - несколько настраиваемых воронок;
  - Digital Pipeline (триггеры с действиями);
  - Salesbot;
  - imBox: двусторонние чаты WhatsApp, Telegram, VK, MAX и других каналов;
  - более 150 интеграций телефонии;
  - веб-формы и «Неразобранное»;
  - задачи, аналитика, мобильное приложение;
  - amoМаркет, REST API, вебхуки, AI (amoAI, AI-агент).
- **Главный разрыв.** У нас нет двусторонних коммуникаций: чатов, звонков и почты. Нет задач как сущности, нет настраиваемых воронок и полей, нет аналитики. Автоматизация примитивная.
- **Наши сильные стороны.** Мы встроены в экосистему:
  - при WON сами создаются контрагент в Finance, платёжная ссылка, портал, доставка, запись (booking), промо и домен;
  - AZ-специфика: VÖEN/FIN через MDM, импорт из e-taxes, производственный календарь Баку, i18n az/ru/en;
  - multi-tenant с fail-closed изоляцией, матрица прав «экран / API / админ» и аудит-лог с integrity-hash;
  - полевые визиты с GPS;
  - post-sale блоки «селекции» и «гарантия» для стройки.
- **Честная оценка зрелости.** Наш CRM сейчас ближе к MVP-модулю внутри ERP, чем к самостоятельной CRM уровня amoCRM.

---

## A1. Где живёт наш CRM-сателлит и из чего он состоит

### A1.1. Расположение и стек

| Что | Где / значение |
|---|---|
| Папка | `D:\My Projects\era-ecosystem\era-crm` |
| Продукт | ERA CRM Field, entitlement `industry_crm` (`PRD.md`, `TZ.md`) |
| UI | Next.js 15, страницы в `app/**` |
| API | Nest-edge, роуты сгенерированы в `nest/generated/*.ts`. Next route handlers удалены (`doc/nest-cutover.md`) |
| БД | Prisma 6 + PostgreSQL, `prisma/schema.prisma`, 7 миграций |
| Связь с платформой | `@era/satellite-kit`, `@era/contracts`, orchestrator gateway (`src/lib/dispatch-satellite-event.ts`) |
| Тесты | 11 файлов в `__tests__/` (RBAC, tenant isolation, party/pipe negative, import) |
| Документы | `PRD.md`, `TZ.md`, `doc/DELIVERY-CRM.md`, `doc/V3-AUDIT.md`, `doc/UAT-SMOKE.md`, ADR `docs/adr/crm-lead-party-model-and-prospect-import.md` (§8 — Bitrix-бэклог M17–M30) |

### A1.2. Модель данных (`prisma/schema.prisma`)

| Модель | Назначение | Зрелость |
|---|---|---|
| `Tenant`, `Outlet` | Организация и точки | done (каркас) |
| `Lead` | Единственная «клиентская» сущность. Поля: `stage` (enum), `channel` (enum), `partyKind`, `taxId`, `companyName`, `contactPhone/Email`, `globalPersonId`, `activitySector`, `prospectType`, `estimatedAmount`, `ownerId`, `nextContactAt`, `score`, `counterpartyId`, `convertedAt` | done |
| `LeadStageHistory` | История смены стадий | done |
| `PipelineRule` | Правило «вошёл в стадию X → перевести в Y» | partial (только перевод стадии) |
| `Visit` | Полевой визит: notes, адрес, lat/lng | done |
| `InboxThread` | Метаданные треда WA/IG: `externalRef`, `preview`, `lastMessageAt`. Сообщений нет | stub |
| `CrmLookup` | Справочники CHANNEL / PROSPECT_TYPE / ACTIVITY_SECTOR | done |
| `ImportBatch` | Пакет импорта CSV/XLSX с отчётом | done |
| `SelectionPackage`, `SelectionItem` | Post-sale селекции (стройка) | done (MVP) |
| `WarrantyCase` | Гарантийные кейсы | done (MVP) |
| `Role`, `User` | Роли-пакеты прав и пользователи | done |
| `SatelliteAuditLog` | Аудит с `integrityHash` | done |

**Чего в схеме нет:**
- `Contact` и `Company` отдельно от `Lead`; `Deal` как отдельная сущность;
- `Pipeline` и `Stage` как данные (стадии зашиты в `enum LeadStage`);
- `Task`, `Note`/`Activity`, `Message`, `Call`, `Email`, `Tag`;
- кастомные поля, `Product`/позиции сделки, причины отказа;
- `WebhookSubscription`, `Form`/источник.

### A1.3. API (`nest/generated/`)

| Группа | Эндпоинты |
|---|---|
| Лиды | `GET/POST /api/leads`, `GET/PATCH /api/leads/:id`, `PATCH /api/leads/:id/stage`, `/assign`, `/follow-up`, `/score`, `POST /api/leads/:id/convert`, `GET /api/leads/next-contact-due` |
| Импорт | `POST /api/leads/import`, `GET /api/leads/import/:batchId` |
| Визиты / инбокс | `GET/POST /api/visits`, `GET/POST /api/inbox`. Инбокс только создаёт и показывает треды вручную |
| Автоматизация | `GET/POST /api/pipeline/rules` |
| MDM | `/api/mdm/voen-lookup`, `/api/mdm/person-lookup`, `/api/counterparties/voen-preview` |
| Справочники | `/api/lookups`, `/api/lookups/:id` |
| Post-sale | `selections_warranty.ts` |
| Админка / RBAC | `/api/admin/roles`, `/roles/:code`, `/roles/:code/permissions`, `/api/admin/users`, `/api/admin/links`, `/api/internal/v1/workforce/roles` |
| Платформа | `/api/events/dispatch` (по сервис-токену), `/api/platform/billing-snapshot`, SSO `auth_sso_exchange.ts` |

### A1.4. UI-экраны (`app/`)

- `/leads`: колонки по 6 стадиям, фильтры «мои» и `prospectType`, форма создания, кнопки конверсии и follow-up. Drag-and-drop в коде не найден (`app/leads/page.tsx`).
- `/leads/[id]`: карточка лида. На ней party-блок, стадия, история стадий, визиты, селекции, гарантия.
- `/inbox`: список тредов и форма ручного добавления треда с полем «Last message preview…» (`app/inbox/page.tsx`).
- `/visits`, `/admin/access` (матрица прав), `/admin/import`, `/admin/links`, `/admin/settings`, `/help`, `/login`, `/sso/callback`.
- **Нет:** дашборда, отчётов, календаря и задач, экрана переписки.

### A1.5. Автоматизация, интеграции, события

- **Pipeline rules** (`src/lib/pipeline-rules.ts`):
  - срабатывает только первое подходящее правило;
  - единственное действие — смена стадии;
  - нет условий по полям, задержек, задач и сообщений;
  - вызывается из `nest/generated/leads__id_stage.ts` с новой стадией в роли `fromStage`.
- **WhatsApp на смене стадии.** В `leads__id_stage.ts` при `WHATSAPP_BUSINESS_MODE=live` уходит POST в orchestrator `/platform/notifications/v1/send`. Канал отправки есть в orchestrator: `era-orchestrator/apps/api/src/platform/notifications/adapters/whatsapp-business.adapter.ts` (Graph API) и адаптеры email/sms. Это **исходящие уведомления**. Входящих сообщений в CRM нет.
- **Конверсия** (`nest/generated/leads__id_convert.ts`):
  - событие `SATELLITE_CRM_LEAD_CONVERTED`;
  - создаются payment link, portal link, shipment (опционально), booking-appointment на завтра, promotion −5% и custom domain (опционально);
  - уходит WA-уведомление клиенту.
- **Follow-up** (`leads__id_follow-up.ts`): `nextContactAt` с расчётом рабочих дней по производственному календарю. Уведомление уходит по email на `CRM_NOTIFY_RECIPIENT` или на заглушку `lead-<id>@local`.
- **Скоринг** (`src/lib/lead-score.ts`): захардкоженная формула (стадия, сумма, визиты, просрочка, канал).
- **События наружу.** В `@era/contracts` для CRM есть только 2 события: `SATELLITE_CRM_LEAD_CONVERTED` и `SATELLITE_CRM_VISIT_LOGGED`. Публичных вебхуков для клиентов (подписка на URL) в коде не найдено.
- **Телефонии, email-ящиков, веб-форм, Telegram и мобильного приложения CRM нет.** В `apps/` лежат только `clinic-nurse-app`, `clinic-nurse-cover`, `guest-app`.

### A1.6. Роли и права

- `src/lib/auth/permissions.ts`: 22 гранта (`screen:*`, `api:*`, `admin:*`) и 6 системных ролей: `SALES_AGENT`, `SALES_LEAD`, `FIELD_REP`, `BUSINESS_OWNER`, `PLATFORM_MEMBER`, `SATELLITE_OPERATOR`.
- Роли можно клонировать, изменения пишутся в аудит. Двери проверяются на страницах (`page-route-permissions.ts`) и на API (`api-route-permissions.ts`; не внесённый в список роут получает 403).
- Ограничений уровня записи («только свои», «своя группа»), групп пользователей и прав по стадиям нет. «Мои лиды» — это фильтр списка, а не право (`PRD.md` §3).

### A1.7. Расхождения документации и кода (важно для Cursor)

- `PRD.md` §4 помечает M7 «WA Business API live» как **DONE**, а `DELIVERY-CRM.md` C3 — как `[x]`. При этом в CRM есть только исходящие уведомления при смене стадии и конверсии. `InboxThread` — заглушка, и сам PRD §9.3 называет двусторонний инбокс (M17) **DEFERRED**.
- M2 «Lead card & activities — DONE»: на деле таймлайна активностей нет, есть только история стадий и визиты. M18 «Rich activity feed» тоже отложен.

---

## A2. amoCRM: что это и как устроено

| Область | Что есть | Источник |
|---|---|---|
| Воронки | Несколько воронок, канбан «Сделки», режимы «Список» и imBox; этапы настраиваются | https://www.amocrm.ru/tour/ |
| Digital Pipeline | Триггеры: создание или переход в этап, смена ответственного, оплата счёта, «за X часов», расписание, анкета, входящее письмо или звонок, заход на сайт, первое сообщение, прочтение, закрытие беседы. На Pro добавляются изменение поля и тег. Действия: задача, письмо, бот, смена этапа, вебхук и другие. С тарифа «Расширенный» | https://www.amocrm.ru/buy, https://prontoprofit.ru/blog/tarify-amocrm-2026 |
| Salesbot | Визуальный no-code конструктор ботов для мессенджеров, шаблоны, импорт и экспорт; интеграторы могут встраивать свои шаги | https://www.amocrm.ru/buy, https://www.amocrm.ru/developers/content/crm_platform/platform-abilities |
| AI | AI-агент 24/7, amoAI (обработка текста, подсказки ответов, резюме бесед), «Амма AI» для аналитики, токены по тарифу | https://www.amocrm.ru/tour/, https://www.amocrm.ru/buy |
| imBox и мессенджеры | Все переписки в одном окне. Telegram (бот), VK, MAX, WhatsApp (официальный WABA через 360dialog, а также партнёрские виджеты), кнопка чата на сайт. Входящее сообщение создаёт заявку в «Неразобранном», дальше «Принять / Привязать» | https://new.amocrm.ru/support/starting_work/chats, https://www.amocrm.ru/support/support_category/amochats, https://new.amocrm.ru/extensions/ |
| API чатов | Любой интегратор может подключить новый мессенджер как транспорт, и Salesbot будет с ним работать | https://www.amocrm.ru/developers/content/crm_platform/platform-abilities |
| Телефония | Более 150 интеграций с АТС: звонок из карточки, запись разговора в карточке, пропущенные, статистика, создание сделки по звонку; JS-SDK для АТС | https://www.amocrm.ru/static/assets/education/amocrm_2_instruction.pdf, https://new.amocrm.ru/extensions/ |
| Захват лидов | Сайт и формы, мессенджеры, соцсети, звонки, почта попадают в воронку автоматически; автосклейка «Неразобранного» | https://www.amocrm.ru/tour/, https://www.amocrm.ru/buy |
| Задачи | Типы задач (связаться, выставить счёт, контроль и т. д.), просрочки, отчёт по задачам | https://amocrm.support/postroenie-otdela-prodazh/analitika-i-otchyoty-v-amocrm-kak-kontrolirovat-otdel-prodazh/ |
| Аналитика | Сводный отчёт, «Анализ продаж» (конверсия этапов, длительность сделки, время реакции, источники), отчёт по сотрудникам, звонки, «Список событий», «Цели» (план/факт), прогноз продаж, KPI, скоринг, «Операционный день» | ссылка выше, https://www.amocrm.ru/buy |
| Покупатели | Блок для розницы: повторные покупки, сегменты, баллы, карты Wallet, онлайн-кассы | https://www.amocrm.ru/buy |
| Расширяемость | amoМаркет (категории: чаты, телефония, рассылки, счета, документы и др.), JS-виджеты внутри интерфейса, «Списки» (свои справочники), отраслевые мастера настройки, короткие ссылки с трекингом | https://www.amocrm.ru/support/starting_work/amomarket, https://www.amocrm.ru/developers/content/crm_platform/platform-abilities |
| API и вебхуки | REST + OAuth. Вебхуки по сделкам, контактам, компаниям, покупателям, задачам, спискам, беседам и шаблонам WA; 4 повторные попытки (5 мин – 1 ч). Лимит 7 rps на интеграцию и 50 rps на аккаунт; за нарушения 429, потом блок 403. Вебхуки и свои виджеты доступны с «Расширенного» | https://www.amocrm.ru/developers/content/crm_platform/webhooks-format, https://www.amocrm.ru/developers/content/api/recommendations |
| Права | Для сделок, контактов, компаний и задач: создание, просмотр, правка, удаление, экспорт с уровнями «все / группа / если ответственный / запрещено». Права по этапам, группы пользователей, доступ к «Неразобранному». На Pro — мониторинг активности (автоблок при массовом просмотре). На Enterprise — SSO и 2FA | https://new.amocrm.ru/support/user/setting_right_level_users, https://www.amocrm.ru/support/settings/users, https://www.amocrm.ru/buy |
| Мобильное приложение | amoCRM 2.0 для iOS и Android. Рейтинг в Google Play 2,8 (около 1,7 тыс. отзывов) | https://play.google.com/store/apps/details?id=com.amocrm.amocrmv2 |

### A2.1. Тарифы (РФ, за пользователя в месяц, без НДС, оплата от 6 месяцев)

| Тариф | Цена | Контакты / пользователь | Открытые сделки / пользователь | Доп. поля / аккаунт | Ключевое |
|---|---|---|---|---|---|
| Базовый | 599 ₽ | 5 000 | 500 | 100 | Воронка, imBox. **Нет** Digital Pipeline, Salesbot, вебхуков |
| Расширенный | 1 299 ₽ | 10 000 | 1 000 | 200 | DP (100 триггеров), Salesbot, вебхуки, виджеты, KPI, прогноз |
| Профессиональный | 1 799 ₽ | 20 000 | 3 000 | 400 | Безлимит триггеров, триггеры по полю и тегу, amoAI, скоринг, мониторинг |
| Enterprise 50 / 200 | 149 999 / 899 999 ₽ в месяц | — | — | — | SSO, 2FA, SLA |

Есть отдельный пакет «Микро-бизнес»: 8 999 ₽ в год за 2 пользователя.

Платные add-on'ы: токены AI, лимиты API, «Супер-поля», 10 ГБ файлов (999 ₽ в месяц каждый).

Международная версия называется Kommo: $25 / $35 / $45 за пользователя. Она релевантна для Азербайджана. Подробнее: https://www.kommo.com/buy/tariff/

Источники: https://www.amocrm.ru/buy, https://zitori.ru/zhurnal/tarify-amocrm-2026-ceny-i-limity/

### A2.2. Известные слабости amoCRM (из отзывов)

- Нестабильность и сбои, слабая и медленная техподдержка (https://otzovik.com/reviews/amocrm-sistema_dlya_avtomatizacii_prodazh/).
- Плохое мобильное приложение: вылеты, теряются сообщения и уведомления (Google Play 2,8; RuStore 3,0: https://www.rustore.ru/catalog/app/com.amocrm.amocrmv2/reviews).
- Дорогие модули и виджеты: итоговая цена выше прайса, а виджеты разных вендоров конфликтуют.
- Жёсткие лимиты API, вплоть до блокировки аккаунта (отзыв на otzovik, https://otzovik.com/review_18562275.html, и официальные правила).
- Нет помесячной оплаты, лимиты по тарифам (контакты, сделки, поля, диск).
- «Нет настоящей аналитики» для сложных случаев; нет нормального объединения дублей (отзыв на picktech.ru, https://picktech.ru/product/amocrm/).
- Сама по себе это только CRM: нет учёта, склада, ERP. Деньги, документы и доставку добирают виджетами.

---

## A3. Сравнение

### A3.1. Сводная таблица

| Возможность | amoCRM | ERA CRM (наш код) | Оценка |
|---|---|---|---|
| Несколько воронок, настраиваемые этапы | Да | Нет: `enum LeadStage`, 6 стадий | ❌ разрыв |
| Канбан с drag-and-drop | Да | Колонки без DnD (`app/leads/page.tsx`) | 🟡 |
| Контакт / компания / сделка | Да | Только `Lead` | ❌ |
| Кастомные поля | 100–400 | Нет (M24 в бэклоге) | ❌ |
| Теги | Да | Нет | ❌ |
| Задачи с типами и сроками | Да | Только `nextContactAt` | ❌ |
| Таймлайн (примечания, файлы, звонки, письма) | Да | История стадий и визиты | ❌ |
| Двусторонние чаты (imBox) | WA, TG, VK, MAX и др. | `InboxThread`-заглушка; WA только исходящий | ❌ критично |
| Salesbot / чат-боты | Да | Нет | ❌ |
| Digital Pipeline (триггеры и действия) | Да | `PipelineRule`: только смена стадии | 🟡 |
| Телефония | Более 150 АТС | Нет | ❌ |
| Почта в карточке | Да | Нет (email только как уведомление) | ❌ |
| Веб-формы и «Неразобранное» | Да | Нет | ❌ |
| Импорт | Да | CSV/XLSX + дедуп по VÖEN/телефону | ✅ |
| Дедуп и склейка | Автосклейка | Дедуп при импорте; merge-UI нет (M19) | 🟡 |
| Аналитика и отчёты | Много | Нет (M22 в бэклоге) | ❌ |
| План, KPI, прогноз | Да | Нет | ❌ |
| Скоринг | Формула (Pro) | Захардкоженная формула (`lead-score.ts`) | 🟡 |
| AI | AI-агент, amoAI | Нет | ❌ |
| Мобильное приложение | Есть (слабое) | Нет | ❌ |
| Маркетплейс / виджеты | amoМаркет | Нет | ❌ (осознанно) |
| Публичный API | REST + OAuth | Внутренний API под сессией и SSO | 🟡 |
| Вебхуки для клиентов | Да | Нет; только события в orchestrator | 🟡 |
| Права на уровне записей и групп | Да | Нет; есть матрица «экран / API» | 🟡 |
| Аудит | История 1 мес. – 1 год | `SatelliteAuditLog` с `integrityHash` | ✅ |
| Полевые визиты с GPS | Только через виджеты | `Visit` lat/lng + `/visits` | ✅ сильнее |
| AZ: VÖEN, FIN, e-taxes | Нет | Есть (MDM, импорт) | ✅ уникально |
| Сквозная конверсия в Finance, оплату, портал, доставку, запись | Через виджеты | Нативно (`leads__id_convert.ts`) | ✅ уникально |
| Post-sale (селекции и гарантия для стройки) | Нет | `SelectionPackage`, `WarrantyCase` | ✅ |
| Multi-tenant, биллинг-блокировки, SSO платформы | SaaS-аккаунт | `organizationId`, fail-closed, 402 по биллингу | ✅ |
| i18n az/ru/en | ru/en/… | `messages/az.json`, `ru.json`, `en.json` | ✅ |

### A3.2. Что есть у amoCRM и нет у нас

1. **Коммуникации в карточке.** Двусторонний WhatsApp, Telegram, Instagram, VK; единый инбокс; шаблоны WA; кнопка чата на сайт.
2. **«Неразобранное» и автозахват лидов.** Формы, чаты, звонки и письма сами создают заявку.
3. **Телефония.** Click-to-call, запись разговора, пропущенные, отчёт по звонкам.
4. **Почта**, привязанная к карточке.
5. **Задачи** как сущность: тип, срок, ответственный, результат, просрочка; отчёт по задачам.
6. **Таймлайн** карточки: примечания, файлы, системные события.
7. **Гибкая модель данных:**
   - несколько воронок и этапы как данные;
   - контакты, компании и сделки отдельно;
   - кастомные поля, обязательные поля на этапе;
   - теги, причины отказа;
   - товары и «Списки».
8. **Digital Pipeline.** Много типов триггеров и действий, задержки, вебхук как действие.
9. **Salesbot** и AI-ответы, резюме бесед.
10. **Аналитика:**
    - конверсия по этапам и длительность сделки;
    - источники;
    - отчёт по сотрудникам, события, цели, прогноз, KPI.
11. **Права на уровне записей:** «если ответственный» и «группа», права по этапам, право экспорта, мониторинг активности.
12. **Экосистема:** публичный REST и OAuth, вебхуки, маркетплейс, JS-виджеты.
13. **Мобильное приложение.**

### A3.3. Что есть у нас и нет у amoCRM (из кода)

1. **Сквозной сценарий «лид → деньги» без виджетов.** При WON в `nest/generated/leads__id_convert.ts`:
   - событие в Finance с party-данными (Finance сам создаёт контрагента по VÖEN или телефону);
   - payment link, portal link, shipment, booking, promotion, custom domain;
   - WA-уведомление клиенту.
2. **AZ-специфика:**
   - поиск по VÖEN и FIN через MDM (`/api/mdm/voen-lookup`, `/api/mdm/person-lookup`);
   - `globalPersonId` без хранения FIN в открытом виде;
   - гейты стадий: для юрлица на QUALIFIED и выше обязателен VÖEN (`src/lib/lead-party.ts`);
   - импорт e-taxes-реестров (`src/lib/lead-import.ts`);
   - производственный календарь Баку (`src/lib/production-calendar.ts`).
3. **Полевые продажи:** визиты с координатами и событие `SATELLITE_CRM_VISIT_LOGGED` (`nest/generated/visits.ts`).
4. **Post-sale для стройки:** `SelectionPackage` и `WarrantyCase`, привязка к `construction_project_id` и `finance_contract_id`.
5. **Платформенная безопасность:**
   - multi-tenant `organizationId` с fail-closed (миграция `20260821120000_failclosed_tenant`);
   - матрица прав с дверями на каждый API-роут (`src/lib/auth/api-route-permissions.ts`; не внесённый в список роут получает 403);
   - аудит с `integrityHash`;
   - биллинг-enforcement (402);
   - сервис-токен на `/api/events/dispatch`.
6. **Headless и событийность.** Всё доступно по HTTP API (Nest), события идут через orchestrator. CRM — один из сателлитов с общим SSO, общими контрагентами (MDM) и общим биллингом. amoCRM этого не умеет: учёт, склад и платежи он добирает интеграциями.
7. **Нет искусственных лимитов** на контакты, сделки и поля (у amoCRM 500–3000 открытых сделок на пользователя).

**Про клинику.** Прямой интеграции `era-crm` с `era-clinic` в коде CRM не найдено. Её стоит не заявлять, а сделать: см. P2-6 ниже.

### A3.4. Наши слабые места относительно amoCRM

| # | Слабость | Почему критично | Где видно в коде |
|---|---|---|---|
| 1 | Нет входящих сообщений; инбокс — заглушка | Аудитория PRD — «продажи через мессенджеры»; без этого продукт не закрывает основную боль | `src/lib/inbox.service.ts`, `nest/generated/inbox.ts`, `app/inbox/page.tsx` |
| 2 | Стадии зашиты в enum | Нельзя завести вторую воронку (B2B/B2C, партнёры, клиника) | `enum LeadStage`, `app/leads/page.tsx` (`STAGES`), `src/lib/lead-score.ts` |
| 3 | Нет задач и таймлайна | Менеджер не видит «что делать сегодня»; руководитель не контролирует | Нет моделей `Task`/`Activity` |
| 4 | Автоматизация примитивная | Одно действие, первое правило, нет условий и задержек | `src/lib/pipeline-rules.ts` |
| 5 | Нет аналитики | Владельцу нечем мерить воронку | Нет страниц отчётов в `app/` |
| 6 | Нет телефонии, почты, форм | Лиды вводятся руками или импортом | — |
| 7 | Модель «всё в Lead» | Один человек — много сделок: дубли, нет повторных продаж | `model Lead` |
| 8 | Права только «экран / API» | Агент видит чужие лиды; нет групп и права экспорта | `src/lib/auth/permissions.ts`, `PRD.md` §3 |
| 9 | Follow-up уходит не тому | Без `CRM_NOTIFY_RECIPIENT` уходит на `lead-<id>@local`, а не ответственному | `nest/generated/leads__id_follow-up.ts` |
| 10 | Побочные эффекты конверсии захардкожены | Промо −5% и booking «на завтра» создаются всегда, а это должно быть настройкой | `nest/generated/leads__id_convert.ts` |
| 11 | Нет публичных вебхуков и API-ключей для клиентов | Headless заявлен, но внешнему интегратору не подписаться на события | `@era/contracts`: 2 CRM-события |
| 12 | Документация завышает статус (M7, M2) | Риск неверных решений и обещаний клиентам | `PRD.md` §4 и §9.3 |
| 13 | Нет мобильного приложения для поля | Полевые визиты есть, а приложения нет | `apps/` |

---

## A4. Что перенимать: приоритеты

Оценка трудоёмкости: S — до 3 дней, M — 1–2 недели, L — 3–6 недель (1 разработчик + Cursor).

### P0 / MVP — без этого CRM неконкурентен

| # | Фича | Трудоёмкость | Что делать в коде |
|---|---|---|---|
| P0-1 | **Двусторонний WhatsApp (+ Instagram) инбокс** | L | 1) Prisma: `Conversation` (вместо или поверх `InboxThread`: `channel`, `externalChatId`, `contactPhone`, `leadId`, `assigneeId`, `status` OPEN/CLOSED, `unreadCount`) и `Message` (`direction` IN/OUT, `type`, `text`, `mediaUrl`, `externalId`, `status` sent/delivered/read, `sentAt`). 2) Входящие: webhook Meta WABA в orchestrator, рядом с `era-orchestrator/apps/api/src/platform/notifications/adapters/whatsapp-business.adapter.ts`; новое событие `SATELLITE_CRM_MESSAGE_RECEIVED` в `packages/era-contracts`; потребитель в CRM. 3) Исходящие: `POST /api/conversations/:id/messages` через тот же адаптер; шаблоны WA для окна 24 ч. 4) UI: `/inbox` в три колонки (список, чат, карточка лида). 5) Права `api:conversations.*` в `src/lib/auth/permissions.ts` и `api-route-permissions.ts` |
| P0-2 | **«Неразобранное» (входящие заявки)** | M | `Lead.stage` NEW или флаг `isUnsorted` + `sourceRef`; новое входящее сообщение или форма от неизвестного номера создаёт черновик. Действия «Принять / Привязать к лиду / Отклонить». Дедуп по `contactPhone` (индекс уже есть) |
| P0-3 | **Задачи** | M | `Task` (`leadId?`, `assigneeId`, `type` из `CrmLookup` (новый kind `TASK_TYPE`), `dueAt`, `doneAt`, `result`). API `/api/tasks`; виджет «Мои задачи на сегодня / просроченные». `nextContactAt` мигрировать в задачу. Уведомление ответственному (исправить recipient в `leads__id_follow-up.ts`) |
| P0-4 | **Таймлайн карточки** | M | `Activity` (`leadId`, `type` NOTE/STAGE/VISIT/MESSAGE/TASK/CALL/FILE/SYSTEM, `payloadJson`, `authorId`, `createdAt`). Писать из существующих сервисов (`leads.service.ts`, `visits.service.ts`, convert). Лента в `app/leads/[id]/page.tsx` |
| P0-5 | **Настраиваемые воронки и этапы** | L | `Pipeline` + `PipelineStage` (`sortOrder`, `color`, `kind` OPEN/WON/LOST, `requiredFieldsJson`). `Lead.pipelineId` и `Lead.stageId`; enum оставить как `kind` для обратной совместимости (convert = `kind=WON`). Мигрировать 6 текущих стадий в дефолтную воронку. Обновить `lead-party.ts` (гейты по kind или полям этапа), `lead-score.ts`, `app/leads/page.tsx` (DnD) |
| P0-6 | **Базовая аналитика воронки** | M | `/reports`: конверсия этап→этап (из `LeadStageHistory`), средняя длительность, время первой реакции (после P0-1), разрез по `owner`, `channel`, `activitySector`, `prospectType`. Право `screen:reports` |
| P0-7 | **Права на уровне записей** | M | В `Role.permissionsJson` добавить scope `own | group | all` для `leads.read/write`. Модель `UserGroup`; фильтр в `listLeads` (`src/lib/leads.service.ts`); право `api:leads.export` |

### P1 — следующая волна

| # | Фича | Трудоёмкость | Что делать в коде |
|---|---|---|---|
| P1-1 | Digital-Pipeline-lite | L | Расширить `PipelineRule`: `trigger` (STAGE_ENTER, NO_ACTIVITY_X_HOURS, MESSAGE_IN, FIELD_CHANGED, SCHEDULE), `conditionsJson`, `actionsJson[]` (CREATE_TASK, SEND_WA_TEMPLATE, ASSIGN, MOVE_STAGE, WEBHOOK), `delayMinutes`. Исполнитель — очередь или cron. Исправить семантику `applyPipelineRules`: все правила, не только первое |
| P1-2 | Кастомные поля и теги | M | `CustomFieldDef` (entity, type, options, `requiredOnStageIds`) + `Lead.customJson`. `Tag` + `LeadTag`. Это M24 в ADR §8 |
| P1-3 | Contact / Company отдельно от сделки | L | M23. `Contact`, `Company` (VÖEN), `Lead` становится сделкой со ссылками. Учесть Finance-контрагента и MDM как источник правды |
| P1-4 | Telegram-бот как канал | M | Тот же `Conversation`/`Message`, адаптер `telegram` в orchestrator |
| P1-5 | Веб-форма и виджет чата для сайта | M | Публичный `POST /api/public/forms/:formKey` (rate limit, captcha) создаёт заявку в «Неразобранном» |
| P1-6 | Публичные вебхуки и API-ключи для клиентов | M | `WebhookSubscription` (url, events, secret HMAC, ретраи как у amo: 5 мин / 15 мин / 1 ч). Расширить `@era/contracts`: `crm.lead.created/updated/stage_changed`, `crm.message.*`, `crm.task.*`. Подписание и доставка в orchestrator |
| P1-7 | Merge дублей | S–M | M19: UI склейки, перепривязка `Visit`, `Activity`, `Conversation` |
| P1-8 | Настройки побочных эффектов конверсии | S | Флаги в `/admin/settings`: создавать ли promotion или booking, процент скидки, срок booking. Сейчас захардкожено в `leads__id_convert.ts` |
| P1-9 | План / KPI по менеджерам | M | `SalesGoal` (user или group, период, сумма или количество) + отчёт план/факт |

### P2 — позже

| # | Фича | Трудоёмкость | Примечание |
|---|---|---|---|
| P2-1 | Телефония (SIP/АТС, локальные провайдеры AZ) | L | `Call` + запись в `Activity`; click-to-call; входящий звонок создаёт лид |
| P2-2 | Email-ящик в карточке (IMAP/SMTP или Gmail API) | L | `Message` с channel=email |
| P2-3 | Простой бот / автоответ (no-code сценарии) | L | Начать с автоответа и сбора контакта, без визуального конструктора (PRD запрещает Bitrix-конструктор) |
| P2-4 | AI: резюме диалога, подсказка ответа, авто-квалификация | M | Поверх `Message` |
| P2-5 | Мобильное приложение / PWA для поля | L | M29. Визиты с GPS, задачи, чаты |
| P2-6 | Вертикальные воронки (клиника, стройка, отель) | M | Шаблоны `Pipeline` по сателлиту. Для клиники: лид → запись в `era-clinic` (у нас уже есть `createBookingAppointment`). Сделать это реальным событием, а не заявлением |

---

## A5. Куда позиционироваться

- Не копировать amoCRM целиком: маркетплейс, сотни виджетов, «Покупатели», Wallet-карты. Наше преимущество в том, что деньги, документы, доставка, запись и контрагенты уже есть в экосистеме нативно.
- Закрыть **гигиенический минимум sales-CRM**: двусторонний WA, «Неразобранное», задачи, таймлайн, настраиваемые воронки, отчёт по воронке, права «свои / группа».
- Продавать как **«CRM, которая сразу выставляет счёт, принимает оплату и ставит запись — без виджетов, с VÖEN и e-taxes»**, против слабостей amo: сбои, мобильное приложение, лимиты API и сделок, оплата от 6 месяцев.

---

## A6. Источники

**Наш код** (`D:\My Projects\era-ecosystem\era-crm`):
- Схема и логика: `prisma/schema.prisma`, `nest/generated/*.ts`, `src/lib/*.ts`, `src/lib/auth/permissions.ts`, `app/**/page.tsx`.
- Документы: `PRD.md`, `TZ.md`, `doc/DELIVERY-CRM.md`, `doc/V3-AUDIT.md`, `doc/nest-cutover.md`, `.cursor/rules/era-crm-module-map.mdc`.
- Вне `era-crm`: `docs/adr/crm-lead-party-model-and-prospect-import.md`, `era-orchestrator/apps/api/src/platform/notifications/adapters/`.

**amoCRM:**
- https://www.amocrm.ru/tour/
- https://www.amocrm.ru/buy
- https://www.amocrm.ru/developers/content/crm_platform/platform-abilities
- https://www.amocrm.ru/developers/content/crm_platform/webhooks-format
- https://www.amocrm.ru/developers/content/api/recommendations
- https://new.amocrm.ru/support/starting_work/chats
- https://www.amocrm.ru/support/support_category/amochats
- https://new.amocrm.ru/extensions/
- https://www.amocrm.ru/support/starting_work/amomarket
- https://new.amocrm.ru/support/user/setting_right_level_users
- https://www.amocrm.ru/support/settings/users
- https://www.amocrm.ru/static/assets/education/amocrm_2_instruction.pdf
- https://amocrm.support/postroenie-otdela-prodazh/analitika-i-otchyoty-v-amocrm-kak-kontrolirovat-otdel-prodazh/
- https://prontoprofit.ru/blog/tarify-amocrm-2026
- https://zitori.ru/zhurnal/tarify-amocrm-2026-ceny-i-limity/
- https://otzovik.com/reviews/amocrm-sistema_dlya_avtomatizacii_prodazh/
- https://play.google.com/store/apps/details?id=com.amocrm.amocrmv2
- https://www.rustore.ru/catalog/app/com.amocrm.amocrmv2/reviews
- https://www.kommo.com/buy/tariff/


---
