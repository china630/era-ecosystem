<!-- Split from CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md (Part E). Index: ./README.md -->

# ЧАСТЬ E. Прочие внешние разрывы (не мессенджеры и не телефония)

| # | Ключ | Что | Зачем (разрыв из части A) | Тип / auth | Поля | События / методы | Камни | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|---|---|
| E1 | `gcal` | Google Calendar sync | Задачи и встречи (P0-3) ↔ календарь менеджера | OAuth 2.0 (`calendar.events`) | `oauth`, `calendarId` | `events.watch` (push-канал, нужен renew), `events.insert/patch`, `syncToken` | Канал истекает, нужен cron-renew | https://developers.google.com/calendar/api/guides/push | P1 | [V] |
| E2 | `ms365_calendar` | Microsoft 365 / Outlook Calendar | То же | Graph OAuth (`Calendars.ReadWrite`) | `oauth` | Подписки + delta | Renew подписок | https://learn.microsoft.com/en-us/graph/api/resources/calendar | P1 | [V] |
| E3 | `caldav` | CalDAV (Yandex, iCloud, Nextcloud) | То же | Basic / app password | `url`, `username`, `password` | Polling `sync-collection` | — | RFC 4791 / 6578 | P2 | [V] |
| E4 | `ics_feed` | Публичный ICS-фид задач менеджера | Подписка без OAuth | Секретный URL | — | GET `.ics` | Только чтение | RFC 5545 | P0 | — |
| E5 | — | Платежи | Ссылка на оплату при WON уже есть (`createPaymentLink` в `leads__id_convert.ts`) | Через orchestrator (`integrations/payment-providers/drakaris`) | — | — | **В CRM не дублировать.** Новых платёжных провайдеров добавлять в orchestrator/Finance (граница PRD §1.3). В CRM нужно только показывать статус оплаты в карточке (подписка на событие оплаты) | — | P1 (только UI статуса) | — |
| E6 | `sheets_export` | Google Sheets экспорт | Отчёты для владельца (P0-6), аналог «экспорта» amo | OAuth (`spreadsheets`) | `oauth`, `spreadsheetId`, `schedule` | Batch update по расписанию | Квоты API | https://developers.google.com/sheets/api | P2 | [V] |
| E7 | `bi_export` | Выгрузка в BI (CSV/Parquet в S3 / ClickHouse / Postgres read replica) | Аналитика | Ключи S3 (`era-storage`) / DSN | `bucket`, `prefix`, `schedule` | Nightly job | PII-маскирование | — | P2 | — |
| E8 | `meta_capi` | Meta Conversions API (офлайн-конверсии из CRM) | Сквозная аналитика рекламы: лид → WON обратно в Meta | Access token пикселя / датасета | `pixelId`, `accessToken` | `POST /{pixel_id}/events` (Lead, Purchase) с хэшированными телефоном и email | Хэширование SHA-256 и нормализация | https://developers.facebook.com/docs/marketing-api/conversions-api | P2 | [V] |
| E9 | `google_ads_conversions` | Google Ads offline conversions | То же для Google (по `gclid` из lead form или сайта) | OAuth + developer token | `customerId`, `conversionActionId` | `UploadClickConversions` | Нужен developer token | https://developers.google.com/google-ads/api/docs/conversions/upload-clicks | P2 | [V] |
| E10 | `ga4_mp` | GA4 Measurement Protocol | События CRM в GA4 | `measurementId`, `apiSecret` | — | `POST /mp/collect` | Нужен `client_id` с сайта | https://developers.google.com/analytics/devguides/collection/protocol/ga4 | P2 | [V] |
| E11 | `stt_openai` | Транскрибация звонков и голосовых | Аналог amoAI: резюме и транскрипт (P2-4) | API key | `apiKey`, `model`, `language` | `POST /v1/audio/transcriptions` | Стоимость; PII → согласие и настройка тенанта | https://platform.openai.com/docs/guides/speech-to-text | P2 | [V] |
| E12 | `llm_assist` | LLM-подсказки ответа, резюме диалога, авто-квалификация | amoAI-паритет | API key провайдера LLM | `provider`, `apiKey`, `model` | Chat completions | Отключаемо per tenant, логирование без PII | — | P2 | — |
| E13 | `maps_geocode` | Геокодинг адресов визитов и лидов | `Visit` lat/lng уже есть, адреса не геокодируются | API key | `provider` (google / yandex / osm), `apiKey` | Geocode / reverse | Квоты | — | P2 | [U] |
| E14 | `outbound_webhooks` | Публичные исходящие вебхуки ERA для клиентов | Слабость №11 (Headless есть, а подписаться нельзя) | HMAC-SHA256 подпись нашим секретом | `url`, `events[]`, `secret` | `crm.lead.*`, `crm.message.*`, `crm.call.*`, `crm.task.*`; ретраи 5 мин / 15 мин / 1 ч (как у amo) | Отключать после N подряд неудач + уведомление | — | P1 | — |
| E15 | `public_api_keys` | API-ключи тенанта для внешних интеграторов | Headless-позиционирование | Bearer API key (хэш в БД), scopes | `name`, `scopes`, `expiresAt` | Весь `/api/*` по scope | Rate limit на ключ | — | P1 | — |

---
