<!-- Split from CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md (Part C). Index: ./README.md -->

# ЧАСТЬ C. Мессенджеры и каналы: каталог коннекторов

Формат записи: **регион · тип API · auth · поля настроек · входящие события · исходящие методы · лимиты · подводные камни · документация · уровень · проверка.**

### C1. WhatsApp

#### C1.1 WhatsApp Business Cloud API (Meta, официальный) — `whatsapp_cloud` · P0 · [V]
- **Регион:** Global, AZ. **Тип:** REST Graph API + webhooks. **Auth:** Bearer (System User permanent token).
- **Поля:**
  - `accessToken` (secret), `phoneNumberId`, `wabaId`, `appSecret` (secret, для проверки подписи);
  - `verifyToken` (генерируем сами), `graphVersion` (по умолчанию — актуальная, см. changelog).
- **Входящие:** `messages` (text, image, audio, video, document, location, interactive, button), `statuses` (sent, delivered, read, failed), `message_template_status_update`.
- **Исходящие:** `POST /{phone-number-id}/messages` с типами text, media, template, interactive (кнопки и списки); mark as read; `GET /{waba-id}/message_templates`; загрузка медиа `/media`.
- **Лимиты:** окно обслуживания 24 ч от последнего входящего, вне окна только одобренный шаблон. Тарификация и уровни отправки определяет Meta.
- **Подводные камни:**
  - подпись `X-Hub-Signature-256` считается от raw body;
  - URL медиа временный, качать нужно с Bearer-токеном;
  - текущий адаптер использует `v18.0`: версию проверить по https://developers.facebook.com/docs/graph-api/changelog и вынести в настройку;
  - номер, подключённый к Cloud API, нельзя одновременно использовать в обычном приложении WhatsApp, кроме сценария coexistence. **[U]** Уточнить актуальные условия для AZ.
- **Документация:** https://developers.facebook.com/docs/whatsapp/cloud-api
- **Переиспользует:** `whatsapp-business.adapter.ts` (orchestrator).

#### C1.2 360dialog (BSP WhatsApp) — `wa_360dialog` · P0 · [V]
- **Регион:** Global, его использует amoCRM. **Auth:** заголовок `D360-API-KEY`.
- **Поля:** `apiKey` (secret), `channelId` (опц.).
- **Входящие:** формат Cloud API (messages, statuses), webhook URL регистрируется через API 360dialog.
- **Исходящие:** те же payload, что у Cloud API, через хост 360dialog; шаблоны.
- **Подводные камни:** почти идентичен Cloud API, поэтому наследовать `MetaGraphBase`. Шаблоны согласуются через Meta.
- **Документация:** https://docs.360dialog.com/

#### C1.3 Twilio WhatsApp — `wa_twilio` · P1 · [V]
- **Auth:** Basic (Account SID : Auth Token) или API Key. **Поля:** `accountSid`, `authToken` (secret), `fromNumber` (`whatsapp:+...`), `messagingServiceSid` (опц.).
- **Входящие:** вебхук incoming message (form-urlencoded), status callback. **Проверка:** `X-Twilio-Signature`.
- **Исходящие:** `POST /2010-04-01/Accounts/{sid}/Messages.json`; шаблоны через Content API.
- **Документация:** https://www.twilio.com/docs/whatsapp, подписи: https://www.twilio.com/docs/usage/webhooks/webhooks-security

#### C1.4 Infobip WhatsApp — `wa_infobip` · P2 · [V]
- **Auth:** `Authorization: App <apiKey>`, персональный `baseUrl`. **Поля:** `apiKey`, `baseUrl`, `sender`.
- **Документация:** https://www.infobip.com/docs/whatsapp

#### C1.5 Wazzup (агрегатор: WhatsApp, Telegram, Instagram, VK, MAX…) — `wazzup` · P1 · [C]
- **Регион:** СНГ. **Auth:** `Authorization: Bearer <apiKey>`.
- **Поля:** `apiKey` (secret).
- **Входящие:** `PATCH https://api.wazzup24.com/v3/webhooks` с подписками `messagesAndStatuses`, `contactsAndDealsCreation`, `channelsUpdates`, `templateStatus`.
- **Исходящие:** `POST https://api.wazzup24.com/v3/message` (`channelId`, `chatType`, `text` или `contentUri`), `GET /v3/channels`.
- **Подводные камни:** часть каналов Wazzup работает через неофициальные подключения (WhatsApp Web), это риск блокировки номера. Показывать бейдж «неофициальный» для таких `transport`.
- **Документация:** https://wazzup24.ru/help/api-ru/webhooks-2/ , https://wazzup24.ru/help/api/otpravka-soobshhenij/

#### C1.6 Green-API (неофициальный WhatsApp) — `wa_green_api` · P2 · [V] (документация) / риск
- **Auth:** `idInstance` + `apiTokenInstance` в URL. **Поля:** `idInstance`, `apiTokenInstance` (secret), `apiUrl`.
- **Входящие:** webhook с типами `incomingMessageReceived`, `outgoingMessageStatus`, `stateInstanceChanged`. Есть токен вебхука в заголовке `Authorization` (настраивается). **[U]**
- **Подводные камни:** работает через WhatsApp Web (сканирование QR), не через официальный Business API. Meta может заблокировать номер. Только с явным согласием клиента и бейджем «Риск блокировки».
- **Документация:** https://green-api.com/en/docs/

### C2. Telegram

#### C2.1 Telegram Bot API — `telegram_bot` · P0 · [V]
- **Регион:** AZ, СНГ, Global. **Auth:** токен в URL (`/bot<token>/method`).
- **Поля:** `botToken` (secret).
- **Входящие:**
  - `setWebhook` с `secret_token`, проверка заголовка `X-Telegram-Bot-Api-Secret-Token`;
  - апдейты `message`, `edited_message`, `callback_query`, `my_chat_member`.
- **Исходящие:** `sendMessage`, `sendPhoto`, `sendDocument`, `sendMediaGroup`, inline-кнопки, `getFile` (скачать медиа).
- **Лимиты:** около 30 сообщений/с на бота в разные чаты, около 1/с в один чат, 20/мин в группу (FAQ).
- **Подводные камни:**
  - бот не может написать первым, пока пользователь не нажал /start;
  - номер телефона клиента не приходит, его нужно запросить кнопкой `request_contact`;
  - вебхук работает только на портах 443, 80, 88, 8443.
- **Документация:** https://core.telegram.org/bots/api , https://core.telegram.org/bots/faq

#### C2.2 Telegram Business (connected business bots) — `telegram_business` · P1 · [V]
- **Суть:** владелец аккаунта Telegram Business (нужен Telegram Premium) подключает нашего бота к своему **личному** аккаунту, и бот отвечает в личных чатах от имени бизнеса.
- **Поля:** те же, что у `telegram_bot` (используется тот же бот с включённым Business Mode в @BotFather).
- **Входящие:** `business_connection`, `business_message`, `edited_business_message`, `deleted_business_messages`.
- **Исходящие:** `sendMessage` и другие методы с параметром `business_connection_id`. Отвечать только если `rights.can_reply`.
- **Документация:** https://core.telegram.org/api/bots/connected-business-bots , https://core.telegram.org/bots/api
- **Плюс:** легальная альтернатива «userbot» для работы с личным номером менеджера.

#### C2.3 Telegram personal (MTProto / TDLib, userbot) — `telegram_user` · P2 · [V] (документация) / риск
- **Auth:**
  - `api_id` и `api_hash` (my.telegram.org);
  - номер телефона, код входа, 2FA-пароль;
  - сессия хранится как секрет.
- **Тип:** постоянное MTProto-соединение. Нужен отдельный воркер (TDLib/GramJS), вебхуков нет.
- **Подводные камни:**
  - риск блокировки аккаунта при автоматизации;
  - сессия эквивалентна полному доступу к аккаунту;
  - вход через код требует участия пользователя (интерактивный UI-шаг).
  - Рекомендация: сначала C2.2 Telegram Business; userbot делать только по запросу клиента.
- **Документация:** https://core.telegram.org/api , https://core.telegram.org/tdlib

### C3. Meta: Instagram и Messenger

#### C3.1 Instagram Direct (Instagram API with Instagram Login) — `instagram` · P0 · [V]
- **Auth:** OAuth 2.0 (Instagram Login), long-lived token, нужен refresh.
- **Поля:** `oauth` (кнопка «Подключить Instagram»), `appId`, `appSecret` (secret; на уровне платформы, не тенанта).
- **Входящие:** подписка `messages`, `messaging_postbacks`, `message_reactions`, `messaging_seen`, `comments` (опц.); подпись `X-Hub-Signature-256`.
- **Исходящие:** `POST /<IG_ID>/messages` (`recipient.id` = IGSID), текст, медиа, quick replies.
- **Лимиты:** окно 24 ч; тег `HUMAN_AGENT` до 7 дней при одобренном разрешении; Send API около 100 сообщений/с на профессиональный аккаунт.
- **Подводные камни:**
  - нужен App Review (advanced access `instagram_business_manage_messages`);
  - только профессиональные (Business/Creator) аккаунты;
  - OAuth-приложение одно на платформу ERA, тенант только авторизуется.
- **Документация:** https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api.md

#### C3.2 Facebook Messenger (страницы) — `fb_messenger` · P1 · [V]
- **Auth:** OAuth, Page Access Token. **Поля:** `oauth`, `pageId`.
- **Входящие:** `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`.
- **Исходящие:** Send API `POST /me/messages`; окно 24 ч и message tags.
- **Документация:** https://developers.facebook.com/docs/messenger-platform

### C4. СНГ-мессенджеры

#### C4.1 Viber (Rakuten Viber Chatbot REST API) — `viber_bot` · P1 · [V]
- **Регион:** СНГ, AZ (популярен). **Auth:** заголовок `X-Viber-Auth-Token`.
- **Поля:** `authToken` (secret), `senderName`, `senderAvatarUrl`.
- **Входящие:** `set_webhook`, события `message`, `subscribed`, `unsubscribed`, `conversation_started`, `delivered`, `seen`, `failed`; подпись `X-Viber-Content-Signature` (HMAC-SHA256 тела токеном).
- **Исходящие:** `send_message` (text, picture, file, keyboard, rich media).
- **Лимиты и стоимость:** с 05.02.2024 новые боты создаются только на коммерческих условиях: через партнёра или напрямую с Rakuten Viber, ежемесячная плата за бота (по справке Viber: EUR 100 в FAQ, EUR 115 на странице commercial model). Сообщения в 24-часовой сессии бесплатны; сообщения, инициированные ботом, платные.
- **Документация:** https://developers.viber.com/docs/api/rest-bot-api/ , https://help.viber.com/hc/en-us/articles/15247629658525-Bot-commercial-model
- **Отдельно:** Viber Business Messages (промо и транзакционные рассылки) доступны только через партнёров-агрегаторов. **[U]**

#### C4.2 VK (сообщения сообщества, Callback API) — `vk_community` · P1 · [V]
- **Регион:** РФ/СНГ. **Auth:** ключ доступа сообщества (access token).
- **Поля:** `groupId`, `accessToken` (secret), `confirmationCode`, `secretKey` (secret), `apiVersion`.
- **Входящие:** Callback API: `confirmation` (ответить строкой `confirmationCode`), `message_new`, `message_reply`, `message_allow`, `message_deny`. Проверяется поле `secret`. На остальные события ответ — строка `ok`.
- **Исходящие:** `messages.send` (обязательный `random_id` для идемпотентности).
- **Подводные камни:** не ответил `ok` — VK ретраит; при длительных ошибках сервер отключается.
- **Документация:** https://dev.vk.com/ru/api/callback/getting-started

#### C4.3 Одноклассники (OK Bot API) — `ok_bot` · P2 · [C]
- **Auth:** токен бота группы. **Входящие:** webhook (подписка через API). **Исходящие:** отправка сообщений в чат группы.
- **Документация:** https://apiok.ru/dev/graph_api/ (Graph API для групп). **[U]** Набор событий и подпись уточнить.

#### C4.4 MAX (мессенджер VK) — `max_bot` · P1 · [V]
- **Регион:** РФ (amoCRM уже подключил). **Auth:** заголовок `Authorization: <access_token>`.
- **Поля:** `accessToken` (secret).
- **Входящие:**
  - `POST https://platform-api2.max.ru/subscriptions` (url, `update_types`, `secret`), проверка `X-Max-Bot-Api-Secret`;
  - события `message_created`, `message_callback`, `bot_started`, `bot_stopped`, `message_edited`, `message_removed` и др.
- **Исходящие:** отправка сообщений (`/messages`), кнопки.
- **Лимиты и камни:**
  - только HTTPS на порту 443 с доверенным сертификатом (самоподписанные запрещены с 25.05.2026);
  - ответ 200 не позже 30 с;
  - до 10 ретраев; если 8 ч нет успеха, MAX сам отписывает бота;
  - один endpoint на бота;
  - использовать домен `platform-api2.max.ru`.
- **Документация:** https://dev.max.ru/docs-api , https://dev.max.ru/docs-api/methods/POST/subscriptions/

### C5. Азия и Apple

#### C5.1 WeChat Official Account (Service Account) — `wechat_oa` · P2 · [V]
- **Регион:** Китай и китайская диаспора. **Auth:** `appId` + `appSecret` → `access_token` (обновлять, TTL около 2 ч).
- **Поля:** `appId`, `appSecret` (secret), `token` (для подписи), `encodingAESKey` (если безопасный режим).
- **Входящие:** XML-пуш, проверка `signature = sha1(sort(token,timestamp,nonce))`; GET с `echostr` при настройке.
- **Исходящие:** `POST https://api.weixin.qq.com/cgi-bin/message/custom/send` (customer service message).
- **Лимиты:** после сообщения пользователя — до 5 ответов в течение 48 ч.
- **Подводные камни:** аккаунт обычно требует китайскую регистрацию/верификацию **[U]**; XML, а не JSON.
- **Документация:** https://developers.weixin.qq.com/doc/service/api/customer/message/api_sendcustommessage.html?lang=en

#### C5.2 LINE Messaging API — `line` · P2 · [V]
- **Регион:** Япония, Таиланд, Тайвань. **Auth:** Channel access token (Bearer).
- **Поля:** `channelAccessToken` (secret), `channelSecret` (secret).
- **Входящие:** webhook events (`message`, `follow`, `unfollow`, `postback`), подпись `x-line-signature`.
- **Исходящие:** reply (по `replyToken`, бесплатно) и push (тарифицируется по плану).
- **Документация:** https://developers.line.biz/en/docs/messaging-api/

#### C5.3 Apple Messages for Business — `apple_mfb` · P2 · [V]
- **Суть:** доступ только через зарегистрированного **Messaging Service Provider (MSP)**. Самим ERA нужно пройти регистрацию MSP у Apple либо работать через MSP-партнёра.
- **Входящие:** Apple шлёт `POST /message` на наш MSP-endpoint (JWT, gzip JSON).
- **Исходящие:** `POST https://mspgw.push.apple.com/v1/message` (HS256 JWT, `Destination-Id`, `Source-Id`).
- **Документация:** https://register.apple.com/resources/messages/msp-rest-api/
- **Рекомендация:** отложить, ценность для AZ низкая.

#### C5.4 Google Business Messages — **не реализовывать** · [V]
- Сервис закрыт 31.07.2024 (новые диалоги прекращены с 15.07.2024, API возвращает ошибки).
- **Документация:** https://developers.google.com/business-communications/business-messages/resources/release-notes/update-on-gbm
- Альтернатива от Google — RCS Business Messaging: https://developers.google.com/business-communications/rcs-business-messaging . Доступность RBM в AZ **[U]**, уровень P2.

### C6. SMS

| Ключ | Провайдер | Регион | Auth / поля | Входящие | Исходящие | Камни | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|---|
| `sms_lsim` | LSIM | AZ | `login`, `password` (secret), `sender`; подпись запроса `key = md5(md5(pass)+login+text+msisdn+sender)` | Нет (статус через `smsreporter`, polling) | `POST https://apps.lsim.az/quicksms/v1/smssender`, `balance`, отчёт | Лимит отчётов 150 транзакций/мин; IP allowlist (ошибка -107); Unicode отдельно | https://docs.lsim.az/ , http://docs.lsim.az/quicksms.html | P0 | [V] |
| `sms_msm_az` | MSM Technologies | AZ | Спецификация HTTP/XML API выдаётся по запросу (info@msm.az) | DLR в реальном времени (по описанию), 2-way по короткому номеру | HTTP/XML API | Нет публичной спецификации → generic HTTP-шаблон | https://www.msm.az/ru/heller/api | P1 | [U] |
| `sms_1sms_az` | 1sms.az | AZ | `X-API-Key`, `senderName` | ? | `POST /api/v1/sms/notification` (по данным поиска) | Не сверено с официальной документацией | https://1sms.az/ | P2 | [U] |
| `sms_poctgoyercini` | Poçt Göyərçini (Azercell) | AZ | ? | ? | ? | Публичного API не найдено | https://www.poctgoyercini.com/ | P2 | [U] |
| `sms_twilio` | Twilio Messaging | Global | `accountSid`, `authToken`, `from` / `messagingServiceSid` | Incoming SMS, status callback (`X-Twilio-Signature`) | `Messages.json` | Регистрация отправителя по стране | https://www.twilio.com/docs/messaging | P1 | [V] |
| `sms_infobip` | Infobip SMS | Global | `apiKey`, `baseUrl`, `sender` | DLR webhook | `/sms/2/text/advanced` **[U]** | — | https://www.infobip.com/docs | P2 | [U] |
| `sms_generic` | Любой HTTP SMS-шлюз | — | Шаблон запроса | Шаблон DLR | Шаблон | Через B10 | — | P0 | — |

### C7. Email

| Ключ | Тип | Auth / поля | Входящие | Исходящие | Камни | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|
| `email_imap_smtp` | IMAP + SMTP | `imapHost`, `imapPort`, `smtpHost`, `smtpPort`, `username`, `password` / app password (secret), `tls` | Polling IMAP (IDLE опц.), курсор по UIDVALIDITY+UID | SMTP (nodemailer, как в `email.adapter.ts`) | Gmail и Outlook требуют app password или OAuth; треды собирать по `Message-ID` / `In-Reply-To` / `References` | RFC 3501 / 5321 | P0 | [V] |
| `email_gmail` | Gmail API + Pub/Sub push | OAuth 2.0 (`gmail.modify`), `topicName` | `users.watch` → Pub/Sub → наш endpoint; `history.list` от `historyId` | `users.messages.send` | `watch` нужно продлевать (истекает через 7 дней, Google рекомендует вызывать ежедневно); Google OAuth verification для restricted scopes | https://developers.google.com/gmail/api/guides/push | P1 | [V] |
| `email_ms_graph` | Microsoft Graph (Outlook / M365) | OAuth 2.0 (`Mail.ReadWrite`, `Mail.Send`), `tenantId` | Change notifications (`subscriptions`, `validationToken`, `clientState`) + delta query | `sendMail` | Подписки истекают, нужен renew-cron; срок жизни для messages **[U]** — уточнить в доке | https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview | P1 | [V] |
| Yandex 360 / Mail.ru | Через `email_imap_smtp` | app password | — | — | — | — | P1 | — |

### C8. Чат на сайт (свой) — `webchat` · P0
- **Суть:** свой JS-виджет (`<script src="https://crm.era-365.online/widget.js" data-key="<publicId>">`) с пузырём чата, сбором имени и телефона и кнопками-ссылками на WA, TG, Viber (как «Кнопка на сайт» у amoCRM).
- **Транспорт:** REST + SSE (long-poll fallback), анонимный посетитель получает `visitorToken`.
- **Поля коннекта:** `allowedOrigins`, `greeting`, `color`, `channelsLinks`, `workingHours`, `askPhone`.
- **Безопасность:** CORS по `allowedOrigins`, rate limit по IP, honeypot/turnstile против спама.

### C9. Формы и захват лидов

| Ключ | Источник | Тип | Поля / настройка | Событие | Камни | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|
| `form_generic` | Любая форма, свой сайт | Входящий webhook (JSON / form) | URL + секрет, маппинг полей, дефолтная воронка | `lead.captured` | Антиспам, дедуп по телефону и email | — | P0 | — |
| `form_tilda` | Tilda | Webhook из настроек формы | Наш URL в Tilda → «Приём данных» → Webhook; опц. API-key в заголовке/параметре | POST полей формы, `tranid`, `formid`, UTM (если включены) | Tilda шлёт тестовый запрос `test=test`, на него ответить 200; ответ должен быть быстрым | https://help.tilda.cc/forms/webhook | P0 | [V] |
| `form_elementor` | WordPress Elementor Pro Forms | Action «Webhook» | Наш URL | POST полей | Нужен Elementor Pro | https://elementor.com/help/actions-after-submit/ | P1 | [V] |
| `form_wordpress_plugin` | WordPress (CF7, WPForms, Gravity) | Наш мини-плагин ERA → webhook | URL + ключ | `lead.captured` | У Contact Form 7 нет встроенного webhook, нужен плагин | — | P2 | [U] |
| `meta_lead_ads` | Facebook/Instagram Lead Ads | Webhook `leadgen` на странице + `GET /{leadgen_id}` | OAuth (`leads_retrieval`, `pages_manage_metadata`), `pageId`, выбор форм | `leadgen` → догрузка полей | Нужен App Review; токен страницы | https://developers.facebook.com/docs/marketing-api/guides/lead-ads/retrieving | P1 | [V] |
| `google_ads_leadform` | Google Ads lead form assets | Webhook из Google Ads | Наш URL + `key` (Google передаёт `google_key` в теле) | POST JSON с `user_column_data`, `gcl_id`, `campaign_id` | Проверять `google_key`; есть тестовая отправка | https://developers.google.com/google-ads/webhook/docs/overview | P1 | [V] |
| `avito_messenger` | Avito (РФ) | REST + webhook | OAuth client_credentials | Сообщения | Только РФ | https://developers.avito.ru/api-catalog/messenger/documentation | P2 | [U] (403 при проверке) |

### C10. Итог по каналам

| Категория | Провайдеров в каталоге | P0 | P1 | P2 / не делать |
|---|---|---|---|---|
| WhatsApp (официальный, BSP, агрегаторы, неофициальный) | 6 | 2 | 2 | 2 |
| Telegram | 3 | 1 | 1 | 1 |
| Meta (IG, FB) | 2 | 1 | 1 | 0 |
| СНГ (Viber, VK, OK, MAX) | 4 | 0 | 3 | 1 |
| Азия, Apple, Google | 4 | 0 | 0 | 4 (GBM закрыт) |
| SMS | 7 | 2 | 2 | 3 |
| Email | 4 | 1 | 3 | 0 |
| Чат на сайт | 1 | 1 | 0 | 0 |
| Формы и лиды | 7 | 2 | 3 | 2 |
| **Всего** | **38** | **10** | **15** | **13** |

---
