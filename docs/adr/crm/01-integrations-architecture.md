<!-- Split from CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md (Part B). Status: Accepted architecture ADR. Index: ./README.md -->

# ЧАСТЬ B. ТЗ: интеграционный слой CRM (коннекторы к внешним вендорам)

> Цель: весь код коннекторов к мессенджерам, почте, формам, АТС и прочим вендорам написан заранее. Чтобы запустить провайдера, администратору тенанта остаётся открыть **«Настройки → Интеграции»**, выбрать провайдера, вставить ключи и строки, нажать **«Проверить»** и **«Включить»**.
> ТЗ привязано к текущему коду: `era-crm` (Next UI + Nest-edge `nest/`, Prisma) и `era-orchestrator` (notifications, BullMQ, `pii-crypto.util.ts`).
> Пометки: **[V]** — проверено по официальной документации (ссылка дана). **[U]** — не проверено, уточнить перед реализацией. **[C]** — подтверждено только сторонними источниками или сообществом.

## B0. Что уже есть в коде (переиспользуем)

| Что | Где | Состояние | Как используем |
|---|---|---|---|
| WhatsApp Cloud API: отправка текста | `era-orchestrator/apps/api/src/platform/notifications/adapters/whatsapp-business.adapter.ts` | Ключи берутся из глобальных ENV (`WHATSAPP_BUSINESS_TOKEN`, `WHATSAPP_BUSINESS_PHONE_ID`), Graph `v18.0` захардкожен, есть только `type: text`, ошибки проглатываются | Перенести логику в `WhatsAppCloudAdapter` нового пакета; токены брать из `IntegrationConnection` тенанта, версию Graph вынести в настройку |
| WhatsApp-stub, SMS-stub | `.../adapters/whatsapp.adapter.ts`, `sms.adapter.ts` | Заглушки (только лог) | Заменить реальными адаптерами SMS (LSIM, Twilio и др.) |
| Email (SMTP, nodemailer) | `.../adapters/email.adapter.ts` | Один глобальный SMTP из ENV | Код SMTP переиспользовать в `SmtpImapAdapter` с per-tenant credentials |
| Outbox, очередь, ретраи | `notifications-outbox.worker.ts` (BullMQ: `attempts: 3`, exponential 5 s, poll раз в 30 s), `notifications-dispatch.service.ts` | Работает | Взять тот же паттерн (BullMQ + Redis + outbox-таблица) для `IntegrationOutbox` |
| Idempotency key | `notifications-idempotency.util.ts` (`org:entityType:entityId:templateKey`) | Работает | Тот же подход для исходящих: `connectionId:clientMessageId` |
| Webhook статусов провайдеров | `notifications-webhook.controller.ts` (`POST platform/notifications/v1/webhooks/:provider`, `@Public`) | **Подпись не проверяется** | Не расширять. Новый inbound-контроллер в CRM с обязательной верификацией |
| AES-256-GCM | `era-orchestrator/apps/api/src/security/pii-crypto.util.ts` | Есть fallback на `JWT_SECRET` и dev-строку | Алгоритм взять, а fallback **запретить** (fail-closed) для секретов интеграций |
| Хранилище файлов | `packages/era-storage` (`local-storage.ts`, `s3-storage.ts`) | Есть | Медиа сообщений и записи звонков |
| Аудит | `era-crm` → `SatelliteAuditLog` (`integrityHash`), `src/lib/satellite-audit.ts` | Есть | Аудит всех действий с интеграциями |
| RBAC-двери | `era-crm/src/lib/auth/permissions.ts`, `api-route-permissions.ts` | Есть | Новые гранты (см. B7) |
| Peer-каналы организаций | `era-crm/src/lib/cp-channels-client.ts`, `/admin/links` | Это каналы между сателлитами, **не** внешние вендоры | Не смешивать; новый раздел `/admin/integrations` |
| Платёжный провайдер | `era-orchestrator/apps/api/src/integrations/payment-providers/drakaris/*` | Есть один провайдер | Платежи остаются в orchestrator/Finance (см. E) |

## B1. Архитектурное решение

**Где живёт код.**

1. Новый пакет **`packages/integrations-kit`**: чистый TypeScript без Prisma и Nest. В нём:
   - типы манифестов и интерфейсы адаптеров;
   - реализации адаптеров (HTTP-клиенты, верификация подписей, нормализация событий в общий формат);
   - крипто-хелперы.
   Пакет подключается в `era-crm` и при необходимости в `era-orchestrator`, `era-clinic` и т. д. Мессенджеры нужны не только CRM: клинике тоже.
2. **`era-crm`** — владелец данных тенанта:
   - Prisma-модели `IntegrationConnection`, `Conversation`, `Message`, `Call`, `InboundEvent`, `IntegrationOutbox`;
   - публичные inbound-эндпоинты;
   - UI настроек;
   - воркеры (BullMQ, как в orchestrator).
   Код рукописный, в новой папке `era-crm/nest/integrations/`. Генератор `scripts/generate-nest.mjs` туда не пишет: зарегистрировать модуль в `nest/main.ts` рядом с `kit-routes.ts`.
3. **`era-orchestrator` notifications** остаётся для системных (платформенных) уведомлений. `WhatsappBusinessAdapter` переводится на `integrations-kit`. Когда у тенанта есть свой WABA-коннект, CRM отправляет через него, а не через глобальный ENV.

**Поток входящего события** (единый для всех провайдеров):

```
Provider ──HTTPS──▶ POST /api/integrations/hooks/:provider/:connectionPublicId
   1) найти IntegrationConnection (enabled), без сессии (public route)
   2) adapter.verifyWebhook(rawBody, headers, secrets)  ── fail → 401 + audit
   3) INSERT InboundEvent(idempotencyKey UNIQUE)         ── дубликат → 200 OK
   4) быстрый 200 (или специальный ответ провайдера: VK "ok"/confirmation, Zadarma echo, Mango 200)
   5) BullMQ job "integration-inbound" → adapter.normalize() → NormalizedEvent[]
   6) upsert Contact→Lead (или «Неразобранное») → Conversation/Message или Call → Activity
   7) dispatchSatelliteEvent(SATELLITE_CRM_MESSAGE_RECEIVED | SATELLITE_CRM_CALL_*)
```

**Поток исходящего:**

```
UI/API/автоматизация → IntegrationOutbox(PENDING, idempotencyKey) → BullMQ "integration-outbound"
  → rateLimiter(connection) → adapter.sendMessage()/originateCall()
  → Message.status=SENT + externalId  | retry (exp backoff) | FAILED + error в UI
  → статусы delivered/read приходят inbound-вебхуком и апдейтят Message.status
```

**Для протоколов без вебхуков** (Asterisk AMI/ARI, FreeSWITCH ESL, IMAP, long-poll):

- Вместо вебхука работает `PollingWorker` или `SocketWorker` (отдельный процесс `era-crm` worker), либо внешний мини-агент **`era-pbx-bridge`** (см. D-F1). Он ставится у клиента рядом с АТС и шлёт нормализованные события в тот же inbound-эндпоинт с HMAC-подписью.

## B2. Prisma-модели (добавить в `era-crm/prisma/schema.prisma`)

```prisma
enum IntegrationCategory { MESSENGER SMS EMAIL TELEPHONY LEAD_FORM WEB_CHAT CALENDAR ANALYTICS ADS PAYMENT AI STORAGE OTHER }
enum IntegrationStatus   { DRAFT TESTING ACTIVE ERROR DISABLED }

model IntegrationConnection {
  id              String              @id @default(cuid())
  organizationId  String              @map("organization_id")
  providerKey     String              // "whatsapp_cloud", "telegram_bot", "mango_office", ...
  category        IntegrationCategory
  displayName     String              // "WA основной +994 50 ..."
  publicId        String              @unique @default(cuid()) // в URL вебхука, не секрет
  status          IntegrationStatus   @default(DRAFT)
  enabled         Boolean             @default(false)
  configJson      String              @default("{}")  // НЕсекретные поля манифеста
  secretsEnc      String?             // AES-256-GCM(JSON секретных полей), формат "v1:iv:tag:ct"
  secretsKeyVer   Int                 @default(1)     // для ротации KEK
  webhookSecret   String?             // наш HMAC/verify-token (зашифрован как secrets)
  scopesJson      String              @default("[]")  // OAuth scopes
  oauthExpiresAt  DateTime?
  lastTestAt      DateTime?
  lastTestOk      Boolean?
  lastError       String?
  lastEventAt     DateTime?
  rateLimitJson   String              @default("{}")  // переопределение лимитов
  defaultOwnerId  String?             // ответственный за новые лиды из канала
  routingJson     String              @default("{}")  // воронка/этап/правила распределения
  createdBy       String?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  conversations   Conversation[]
  calls           Call[]
  inboundEvents   InboundEvent[]
  outbox          IntegrationOutbox[]
  @@index([organizationId, category])
  @@index([organizationId, providerKey])
}

enum ConversationStatus { OPEN PENDING CLOSED }
model Conversation {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  connectionId    String
  channel         String   // whatsapp|telegram|instagram|messenger|viber|vk|ok|max|wechat|line|apple|sms|email|webchat
  externalChatId  String   // wa_id / chat_id / IGSID / email thread id
  contactName     String?
  contactPhone    String?
  contactHandle   String?  // @username, email
  leadId          String?
  assigneeId      String?
  status          ConversationStatus @default(OPEN)
  unreadCount     Int      @default(0)
  lastMessageAt   DateTime @default(now())
  lastInboundAt   DateTime? // для окна 24ч (WA/IG/FB/Viber) и 48ч (WeChat)
  createdAt       DateTime @default(now())
  connection      IntegrationConnection @relation(fields: [connectionId], references: [id])
  lead            Lead?    @relation(fields: [leadId], references: [id], onDelete: SetNull)
  messages        Message[]
  @@unique([connectionId, externalChatId])
  @@index([organizationId, status, lastMessageAt])
  @@index([leadId])
}

enum MessageDirection { IN OUT }
enum MessageStatus    { QUEUED SENT DELIVERED READ FAILED RECEIVED }
model Message {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  conversationId  String
  direction       MessageDirection
  type            String   // text|image|audio|video|file|location|template|interactive|sticker|system
  text            String?
  mediaKey        String?  // ключ в era-storage
  mediaMime       String?
  templateName    String?
  payloadJson     String   @default("{}")  // нормализованный «сырой» фрагмент
  externalId      String?  // wamid / message_id
  status          MessageStatus
  error           String?
  authorUserId    String?  // кто отправил (OUT)
  sentAt          DateTime @default(now())
  conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@unique([conversationId, externalId])
  @@index([organizationId, sentAt])
}

enum CallDirection { INBOUND OUTBOUND INTERNAL }
enum CallStatus    { RINGING ANSWERED COMPLETED MISSED BUSY FAILED NO_ANSWER }
model Call {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  connectionId    String
  externalCallId  String   // pbx_call_id / call_id / CallSid / Linkedid
  direction       CallDirection
  status          CallStatus
  fromNumber      String?
  toNumber        String?
  extension       String?  // внутренний номер сотрудника
  userId          String?  // сопоставление extension → User
  leadId          String?
  startedAt       DateTime?
  answeredAt      DateTime?
  endedAt         DateTime?
  durationSec     Int?
  talkSec         Int?
  recordingUrl    String?  // URL провайдера (может истекать!)
  recordingKey    String?  // копия в era-storage
  transcript      String?
  rawJson         String   @default("{}")
  connection      IntegrationConnection @relation(fields: [connectionId], references: [id])
  lead            Lead?    @relation(fields: [leadId], references: [id], onDelete: SetNull)
  @@unique([connectionId, externalCallId])
  @@index([organizationId, startedAt])
  @@index([leadId])
}

model InboundEvent {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  connectionId    String
  idempotencyKey  String   // provider event id или sha256(rawBody)
  eventType       String?
  headersJson     String   @default("{}")
  rawBody         String   // хранить 30 дней, затем чистить (PII)
  status          String   @default("RECEIVED") // RECEIVED|PROCESSED|FAILED|IGNORED
  error           String?
  receivedAt      DateTime @default(now())
  processedAt     DateTime?
  connection      IntegrationConnection @relation(fields: [connectionId], references: [id])
  @@unique([connectionId, idempotencyKey])
  @@index([status, receivedAt])
}

model IntegrationOutbox {
  id              String   @id @default(cuid())
  organizationId  String   @map("organization_id")
  connectionId    String
  kind            String   // send_message|originate_call|send_email|sync_calendar|...
  idempotencyKey  String
  payloadJson     String
  status          String   @default("PENDING") // PENDING|SENDING|SENT|FAILED|DEAD
  attempts        Int      @default(0)
  nextAttemptAt   DateTime @default(now())
  lastError       String?
  resultJson      String?
  createdAt       DateTime @default(now())
  connection      IntegrationConnection @relation(fields: [connectionId], references: [id])
  @@unique([connectionId, idempotencyKey])
  @@index([status, nextAttemptAt])
}

model UserTelephonyExtension {      // сопоставление сотрудника и внутреннего номера АТС
  id              String @id @default(cuid())
  organizationId  String @map("organization_id")
  connectionId    String
  userId          String
  extension       String
  @@unique([connectionId, extension])
}
```

Также:

- В `Lead` добавить обратные связи `conversations Conversation[]`, `calls Call[]`.
- `InboxThread` пометить deprecated и мигрировать в `Conversation` (скрипт в `prisma/scripts/`).
- Все модели с `organizationId` попадают под kit-расширение тенанта (fail-closed, как сейчас).

## B3. Манифест провайдера (каталог)

Каталог задаётся кодом: файл `packages/integrations-kit/src/providers/<key>/manifest.ts` на каждого провайдера. Реестр `packages/integrations-kit/src/registry.ts` собирает все манифесты. UI строит форму настроек **автоматически** из `fields`.

```ts
export type FieldType = "string" | "secret" | "url" | "phone" | "number" | "select" | "boolean" | "json" | "oauth";
export interface ManifestField {
  key: string;                 // "accessToken"
  label: { ru: string; az: string; en: string };
  type: FieldType;
  required?: boolean;
  secret?: boolean;            // true → уходит в secretsEnc, в UI маскируется "••••abcd"
  placeholder?: string;
  help?: { ru: string; az: string; en: string }; // где взять значение у провайдера
  helpUrl?: string;
  pattern?: string;            // regexp валидации
  options?: { value: string; label: string }[];
  default?: string | number | boolean;
  showIf?: { field: string; equals: unknown };
}
export interface ProviderManifest {
  key: string;                 // уникальный, snake_case
  name: string;
  category: IntegrationCategory;
  family?: string;             // адаптер-семейство: "vats_crm_api", "zadarma_like", "asterisk"...
  regions: string[];           // ["AZ","CIS","GLOBAL"]
  tier: "P0" | "P1" | "P2";
  docsUrl: string;
  verified: "V" | "C" | "U";
  auth: "api_key" | "bearer" | "basic" | "oauth2" | "hmac_sign" | "login_password" | "jwt" | "token_in_url";
  fields: ManifestField[];
  inbound: { mode: "webhook" | "polling" | "socket" | "bridge" | "none"; events: string[]; verify: string };
  outbound: string[];          // ["sendText","sendMedia","sendTemplate","originateCall","getRecording"]
  capabilities: Record<string, boolean>; // {templates:true, window24h:true, media:true, readReceipts:true}
  limits?: string;             // человекочитаемо + машинно в rateLimit
  rateLimit?: { perSecond?: number; perMinute?: number; burst?: number };
  setupSteps: { ru: string[]; az?: string[]; en?: string[] }; // пошаговая инструкция в UI
  autoRegisterWebhook?: boolean; // адаптер сам регистрирует URL у провайдера (TG setWebhook, VK, MAX, Zadarma, Beeline)
}
```

Пример: Telegram Bot.

```ts
export const manifest: ProviderManifest = {
  key: "telegram_bot", name: "Telegram Bot", category: "MESSENGER", regions: ["AZ","CIS","GLOBAL"], tier: "P0",
  docsUrl: "https://core.telegram.org/bots/api", verified: "V", auth: "token_in_url",
  fields: [
    { key: "botToken", label: {ru:"Токен бота",az:"Bot tokeni",en:"Bot token"}, type: "secret", secret: true, required: true,
      pattern: "^\\d+:[A-Za-z0-9_-]{30,}$", help: {ru:"Получить у @BotFather командой /newbot",az:"@BotFather-dən /newbot",en:"From @BotFather /newbot"} },
  ],
  inbound: { mode: "webhook", events: ["message","edited_message","callback_query","business_message"], verify: "X-Telegram-Bot-Api-Secret-Token == webhookSecret" },
  outbound: ["sendText","sendMedia","sendButtons"],
  capabilities: { media: true, window24h: false, templates: false },
  rateLimit: { perSecond: 30 }, autoRegisterWebhook: true,
  setupSteps: { ru: ["Создайте бота в @BotFather", "Вставьте токен", "Нажмите «Проверить» (вызов getMe)", "Нажмите «Включить» — мы вызовем setWebhook"] },
};
```

## B4. Интерфейсы адаптеров (`packages/integrations-kit/src/types.ts`)

```ts
export interface AdapterContext {
  connectionId: string; organizationId: string;
  config: Record<string, unknown>; secrets: Record<string, string>;
  webhookUrl: string;          // https://crm.era-365.online/api/integrations/hooks/<key>/<publicId>
  webhookSecret: string;
  http: HttpClient;            // fetch-обёртка: таймаут, ретраи на 429/5xx, логирование без секретов
  storage: { put(key: string, data: Buffer, mime: string): Promise<string> };
  log: Logger;
}
export interface TestResult { ok: boolean; message: string; details?: Record<string, unknown> }

export interface BaseAdapter {
  manifest: ProviderManifest;
  testConnection(ctx: AdapterContext): Promise<TestResult>;          // getMe / balance / ping
  onEnable?(ctx: AdapterContext): Promise<void>;                     // setWebhook, subscribe
  onDisable?(ctx: AdapterContext): Promise<void>;                    // deleteWebhook, unsubscribe
  verifyWebhook?(req: RawRequest, ctx: AdapterContext): VerifyResult;// подпись/токен; ok|fail|challenge
  handleChallenge?(req: RawRequest, ctx: AdapterContext): RawResponse | null; // Meta hub.challenge, VK confirmation, WeChat echostr
  normalize?(req: RawRequest, ctx: AdapterContext): Promise<NormalizedEvent[]>;
  idempotencyKey?(req: RawRequest): string | null;
  refreshAuth?(ctx: AdapterContext): Promise<Record<string, string>>; // OAuth refresh
}

export interface MessagingAdapter extends BaseAdapter {
  sendMessage(ctx: AdapterContext, msg: OutboundMessage): Promise<{ externalId: string; raw: unknown }>;
  fetchMedia?(ctx: AdapterContext, mediaRef: string): Promise<{ data: Buffer; mime: string }>;
  listTemplates?(ctx: AdapterContext): Promise<Template[]>;          // WA/360dialog/Twilio
  markRead?(ctx: AdapterContext, externalMessageId: string): Promise<void>;
}
export interface TelephonyAdapter extends BaseAdapter {
  originateCall(ctx: AdapterContext, p: { fromExtension: string; to: string }): Promise<{ externalCallId?: string }>;
  getRecording?(ctx: AdapterContext, externalCallId: string): Promise<{ url?: string; data?: Buffer; mime?: string }>;
  listExtensions?(ctx: AdapterContext): Promise<{ extension: string; name?: string }[]>;
  fetchHistory?(ctx: AdapterContext, sinceIso: string): Promise<NormalizedEvent[]>; // догрузка пропущенного
}
export interface EmailAdapter extends MessagingAdapter { syncMailbox(ctx: AdapterContext, cursor?: string): Promise<{ events: NormalizedEvent[]; cursor: string }> }
export interface LeadFormAdapter extends BaseAdapter {}             // только normalize → lead.captured

export type NormalizedEvent =
  | { kind: "message.in"; chatId: string; contact: ContactRef; message: InMessage; at: string }
  | { kind: "message.status"; externalId: string; status: "SENT"|"DELIVERED"|"READ"|"FAILED"; error?: string; at: string }
  | { kind: "call.ringing" | "call.answered" | "call.ended" | "call.missed"; call: CallRef; at: string }
  | { kind: "call.recording"; externalCallId: string; url?: string; at: string }
  | { kind: "lead.captured"; source: string; fields: Record<string,string>; contact: ContactRef; utm?: Record<string,string>; at: string };
```

**Семейства (переиспользование кода).** Общий базовый класс на семейство, конкретный провайдер задаёт только манифест и маппинг:

| Семейство (`family`) | Базовый класс | Провайдеры |
|---|---|---|
| `meta_graph` | `MetaGraphBase` (hub.challenge, `X-Hub-Signature-256`, Graph-клиент) | WhatsApp Cloud, Instagram, Messenger, Meta Lead Ads |
| `bot_webhook_secret` | `SecretHeaderBotBase` | Telegram Bot, MAX |
| `hmac_body` | `HmacBodyBase` (настраиваемые алгоритм, заголовок, кодировка) | Viber, LINE, Twilio (свой алгоритм), Telnyx (ed25519), 360dialog, Green-API |
| `vats_crm_api` | `VatsCrmApiBase` (`cmd=history/event/contact`, `crm_token`, `makeCall`) | МегаФон, Гравител, МТС ВАТС |
| `zadarma_like` | `ZadarmaLikeBase` (`NOTIFY_*`, HMAC-SHA1 + base64) | Zadarma, Novofon |
| `signed_json_sha256` | `Sha256SignBase` (`sha256(id+json+key)`) | Mango Office, Ростелеком |
| `generic_call_webhook` | `GenericCallWebhook` (маппинг полей JSONPath в манифесте) | Sipuni, OnlinePBX, Binotel, Ringostat, UIS, Yandex Телефония, VirtualATS.az и др., а также «Своя АТС» |
| `asterisk` | `era-pbx-bridge` (AMI/ARI → наш вебхук) | Asterisk, FreePBX, Issabel, MikoPBX |
| `imap_smtp` | `ImapSmtpBase` | Любая почта, Yandex 360, Mail.ru |
| `generic_lead_webhook` | `GenericLeadWebhook` | Tilda, Elementor, WPForms, свой сайт, любой «webhook из формы» |

## B5. Вебхуки: верификация, идемпотентность, ответы

**Эндпоинты** (Nest, `era-crm/nest/integrations/hooks.controller.ts`, public, без сессии):
- `POST|GET /api/integrations/hooks/:providerKey/:publicId`. GET нужен для Meta hub.challenge, WeChat echostr, VK confirmation.
- Тело читать **raw** (Buffer) до JSON-парсинга, иначе ломаются HMAC-подписи. В Nest-bootstrap (`nest/main.ts`) включить `rawBody: true` для этого префикса.
- Лимит тела 5 МБ. Ответ провайдеру — не позже 3–5 с: обработка только асинхронная через очередь.
- Добавить префикс в `api-route-permissions.ts` как public (сейчас не внесённый в список роут получает 403).

**Верификация по провайдерам:**

| Метод | Провайдеры | Алгоритм |
|---|---|---|
| `X-Hub-Signature-256` | WA Cloud, IG, Messenger, Lead Ads | `sha256=` + HMAC-SHA256(rawBody, appSecret), hex |
| Секретный заголовок | Telegram (`X-Telegram-Bot-Api-Secret-Token`), MAX (`X-Max-Bot-Api-Secret`) | Сравнение в constant time с `webhookSecret` |
| `X-Viber-Content-Signature` | Viber | HMAC-SHA256(rawBody, authToken), hex |
| `x-line-signature` | LINE | base64(HMAC-SHA256(rawBody, channelSecret)) |
| `X-Twilio-Signature` | Twilio | base64(HMAC-SHA1(url + отсортированные POST-параметры, authToken)) |
| `telnyx-signature-ed25519` + timestamp | Telnyx | ed25519 по публичному ключу аккаунта |
| VK `secret` + `confirmation` | VK | Поле `secret` в теле == настройка; на `type=confirmation` вернуть строку подтверждения |
| WeChat `signature` | WeChat OA | sha1(sort(token, timestamp, nonce)) |
| Apple JWT | Apple MfB | JWT (HS256) от Apple, проверка по секрету MSP |
| Mango `sign` | Mango | sha256(vpbx_api_key + json + vpbx_api_salt) |
| Ростелеком `X-Client-Sign` | РТ | sha256hex(client_id + json + key) |
| Zadarma/Novofon `Signature` | Zadarma | base64(HMAC-SHA1(поля события, secret)), набор полей зависит от события |
| `crm_token` | МегаФон, Гравител, МТС | Поле `crm_token` == настройка |
| Нет подписи у провайдера | Sipuni, OnlinePBX, Binotel и др. | Секретный сегмент в URL (`publicId` + `?k=<webhookSecret>`), allowlist IP провайдера (опционально, поле `allowedIps`), сверка с API провайдера для критичных событий |

**Идемпотентность.** Уникальный ключ `(connectionId, idempotencyKey)` в `InboundEvent`. Ключ берётся из ID события провайдера (`wamid` + status, `update_id`, `message.id`, `pbx_call_id`+`event`), иначе `sha256(rawBody)`. Повтор возвращает 200 без обработки. Для `Message` и `Call` дополнительно стоят уникальные индексы по `externalId` и `externalCallId`.

## B6. Исходящие: ретраи, rate limit, окна

- **Outbox.** Любая отправка сначала пишется в `IntegrationOutbox`. Воркер BullMQ-очереди `integration-outbound` работает как в orchestrator: `attempts: 6`, backoff exponential от 5 s (5 s, 10 s, 20 s, 40 s, 80 s, 160 s), затем статус `DEAD` и ошибка в UI.
- **Ретраить:** сетевые ошибки, 429, 5xx. **Не ретраить:** 400, 401, 403. На 401/403 статус соединения становится `ERROR`, администратор получает уведомление.
- **Rate limit.** Token bucket в Redis на `connectionId`: значения по умолчанию из `manifest.rateLimit`, переопределение в `rateLimitJson`. Дополнительно — лимит на чат (Telegram: 1 msg/s в чат).
- **Окна сессий.** `Conversation.lastInboundAt`:
  - WA, IG, Messenger, Viber: окно 24 ч. Вне окна только шаблон (WA) или message tag (IG/FB `HUMAN_AGENT` до 7 дней, при наличии разрешения); Viber вне сессии — платное сообщение.
  - WeChat: 48 ч и до 5 сообщений.
  - UI блокирует свободный текст вне окна и предлагает шаблон.
- **Медиа.** Входящие медиа скачиваются воркером (у WA ссылка на медиа временная, нужен токен) и кладутся в `era-storage`. Исходящие медиа отдаются провайдеру по подписанному временному URL или загружаются через upload-API провайдера.
- **Записи звонков.** Сразу копировать в `era-storage`: у Binotel ссылки живут 15 минут [C], у других провайдеров тоже истекают. Политика хранения задаётся в настройках тенанта.

## B7. Безопасность, права, аудит

- **Шифрование секретов.**
  - AES-256-GCM, ключ `CRM_INTEGRATIONS_KEK` (base64, 32 байта), без fallback. Если ключа нет, включить интеграцию нельзя (fail-closed). Это отличие от `pii-crypto.util.ts`, где есть fallback на `JWT_SECRET`.
  - Формат `v1:<iv>:<tag>:<ciphertext>`, поле `secretsKeyVer` для ротации. Скрипт ротации — в `prisma/scripts/`.
  - Секреты **никогда** не возвращаются в API. UI показывает маску `••••last4`. «Изменить» заменяет значение целиком.
  - Логи HTTP-клиента редактируют заголовки `Authorization`, `*token*`, `*key*`, `*secret*` и query-параметры с такими именами.
- **Гранты** (добавить в `src/lib/auth/permissions.ts` + `api-route-permissions.ts` + `page-route-permissions.ts`):

  | Грант | Назначение |
  |---|---|
  | `screen:admin.integrations` | Видеть раздел интеграций |
  | `admin:integrations` | Создать, изменить, включить, удалить коннект |
  | `screen:inbox`, `api:conversations.read`, `api:conversations.write` | Работа с перепиской (уже есть `api:inbox*` — заменить) |
  | `api:calls.read`, `api:calls.originate` | Звонки и click-to-call |
  | `api:calls.recordings` | Отдельное право на прослушивание записей (PII) |

  По умолчанию `admin:integrations` выдаётся `SALES_LEAD` и `BUSINESS_OWNER`. Поднять `PERMISSION_CATALOG_VERSION` до 3.
- **Аудит** в `SatelliteAuditLog`, `entityType=integration_connection`. Действия: created, config_changed (без значений секретов, только имена полей), secret_rotated, enabled, disabled, test_ok, test_failed, webhook_verify_failed (с IP), deleted.
- **PII:** `InboundEvent.rawBody` чистится через 30 дней (cron); записи звонков отдаются только по подписанному URL с TTL.

## B8. UI настроек (`era-crm/app/admin/integrations/`)

1. `/admin/integrations` — каталог карточек по категориям (Мессенджеры, SMS, Почта, Телефония, Формы, Календари, Аналитика, Прочее):
   - фильтры: регион (AZ/СНГ/Global), уровень P0/P1/P2, «подключено»;
   - на карточке: логотип-заглушка, статус-пилюля (Не подключено / Тест / Активно / Ошибка / Выключено), бейдж «Официальный API» / «Неофициальный (риск блокировки)».
2. `/admin/integrations/[providerKey]/new` и `/admin/integrations/c/[connectionId]`:
   - форма генерируется из `manifest.fields`, локализация az/ru/en через `messages/*.json`;
   - рядом пошаговая инструкция `setupSteps` и ссылка `docsUrl`;
   - read-only блок «URL вебхука» с кнопкой «Копировать» и verify-token, если провайдер требует вставить их у себя (Meta, Sipuni, OnlinePBX, Tilda…);
   - кнопки: **Сохранить** (DRAFT), **Проверить** (`testConnection`; результат и детали, например имя бота или номер WABA), **Включить** (`onEnable`, затем ACTIVE), **Выключить**, **Удалить**;
   - вкладки: «Маршрутизация» (воронка/этап/ответственный для новых лидов, round-robin по группе); «Сотрудники ↔ внутренние номера» (телефония); «Журнал» (последние 100 `InboundEvent` и `IntegrationOutbox` со статусами, кнопка «Повторить»); «Здоровье» (`lastEventAt`, ошибки за 24 ч).
3. Несколько коннектов одного провайдера на тенанта разрешены (два WA-номера, два бота).
4. Добавить пункт меню в `src/components/CrmOpsShell.tsx`.

## B9. API (Nest, `era-crm/nest/integrations/*.controller.ts`)

| Метод | Путь | Грант |
|---|---|---|
| GET | `/api/integrations/catalog` | `screen:admin.integrations` (манифесты без секретов) |
| GET/POST | `/api/integrations/connections` | `admin:integrations` |
| GET/PATCH/DELETE | `/api/integrations/connections/:id` | `admin:integrations` |
| POST | `/api/integrations/connections/:id/test` | `admin:integrations` |
| POST | `/api/integrations/connections/:id/enable` · `/disable` | `admin:integrations` |
| GET | `/api/integrations/connections/:id/events?type=inbound\|outbox` | `admin:integrations` |
| POST | `/api/integrations/outbox/:id/retry` | `admin:integrations` |
| GET/POST | `/api/integrations/hooks/:providerKey/:publicId` | public, только подпись |
| GET | `/api/conversations?status=&assignee=&channel=` | `api:conversations.read` |
| GET | `/api/conversations/:id/messages?cursor=` | `api:conversations.read` |
| POST | `/api/conversations/:id/messages` | `api:conversations.write` (через outbox) |
| PATCH | `/api/conversations/:id` (assign, close, link lead) | `api:conversations.write` |
| POST | `/api/conversations` (написать первым: WA-шаблон, SMS, email) | `api:conversations.write` |
| GET | `/api/calls?leadId=` · `/api/calls/:id/recording` | `api:calls.read` / `api:calls.recordings` |
| POST | `/api/calls/originate` `{ leadId?, to }` | `api:calls.originate` |
| GET/PUT | `/api/integrations/connections/:id/extensions` | `admin:integrations` |

**Realtime в UI.** На первом этапе — polling раз в 5 с. Дальше SSE-эндпоинт `/api/realtime` (события `conversation.updated`, `call.ringing` для всплывающей карточки звонящего).

**Новые события в `packages/era-contracts`:** `SATELLITE_CRM_MESSAGE_RECEIVED`, `SATELLITE_CRM_MESSAGE_SENT`, `SATELLITE_CRM_CALL_STARTED`, `SATELLITE_CRM_CALL_ENDED`, `SATELLITE_CRM_LEAD_CAPTURED`.

## B10. Generic-коннекторы (закрывают длинный хвост без кода)

1. **`generic_lead_webhook`** — «Любая форма / сайт». Создаёт URL и секрет; маппинг полей задаётся в UI (`name`, `phone`, `email`, `comment`, `utm_*` → поля лида); работает с JSON и `x-www-form-urlencoded`. Подходит для Tilda, Elementor, WPForms, Webflow, Typeform, своих лендингов.
2. **`generic_call_webhook`** — «Своя АТС по вебхуку». Маппинг JSONPath в UI: `callId`, `direction`, `from`, `to`, `extension`, `status`, `duration`, `recordingUrl`; значения статусов маппятся на `CallStatus`. Click-to-call — шаблон HTTP-запроса (URL, метод, заголовки, тело с плейсхолдерами `{{from}}`, `{{to}}`).
3. **`generic_messenger_webhook`** — для BSP/агрегаторов без готового адаптера: входящие по вебхуку с маппингом, исходящие по шаблону HTTP-запроса.

Это даёт подключение почти любого провайдера из списка «[U]» без релиза. Готовые адаптеры пишутся только для P0/P1.

---
