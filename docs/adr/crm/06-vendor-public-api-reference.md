# 06 — Справочник публичных API вендоров для адаптеров ERA CRM

**Дата:** 25.11.2026 · **Для:** Cursor (написание адаптеров заранее) · **Основа:** v5-аудит (T-I18…T-I29, P2-2) + код `packages/integrations-kit/src/providers/*` и `tools/era-pbx-bridge/src/index.js` по состоянию на 25.11.2026.

**Правила документа**
- Каждый факт о вендоре взят из официального источника или из официального SDK вендора, ссылка указана рядом. Сторонние источники (зеркала, SDK интеграторов, Q&A) помечены **[стор.]**, неподтверждённое помечено **[НЕПОДТВ.]**.
- «Код сейчас» означает то, что реально лежит в файле, без учёта UAT/DoD.
- «Что дописать» — конкретный файл в `packages/integrations-kit/src/providers/…` и маппинг в нормализованные события kit: `call.ringing | call.answered | call.missed | call.ended` с полями `externalCallId, direction, fromNumber, toNumber, extension, durationSec, recordingUrl`; для сообщений `message.in`; для форм `lead.captured`.
- У вендора остаётся только подключение: ключи, доступ к кабинету, тестовый аккаунт. Всё остальное можно писать уже сейчас.

---

## 0. Сквозные доработки kit, без которых часть адаптеров не заработает

| # | Что | Зачем (кто требует) | Где |
|---|---|---|---|
| K1 | **Подпути в хук-URL**: `/hooks/:publicId/*` → передавать `subPath` в `RawRequest` | Mango шлёт на `{url}/events/call`, `/events/summary`, `/events/recording`, `/result/callback` ([док](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/1_1_api_realtime/3_1_2_uvedomlenie_o_vyzove.html)); Gravitel — на `{crm_url}/history`, `/event`, `/client` ([PDF](https://gravitel.ru/upload/docs/gravitel_rest_api.pdf)) | `nest/integrations-routes.ts` + `types.ts` (`RawRequest.subPath`). Как сейчас обрабатываются подпути — **проверить** (в этом прогоне роуты не читались) |
| K2 | **Кастомный HTTP-ответ адаптера** (`respond(events) → {status, body, contentType}`) | Sipuni требует `{"success": true}`, иначе приостанавливает отправку ([PDF](https://sipuni.com/idealats/pdf/SIPUNI%20%D0%BE%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20HTTP%20API.pdf)); VirtualATS.az ждёт `{"result":"success","errors":[]}` ([KB](https://my.azerizone.net/index.php?rp=%2Fknowledgebase%2F1%2FAPI-istifad%C9%99-etm%C9%99kl%C9%99-VirtualATS-il%C9%99-inteqrasiya.html)); MTS/Мегафон `contact` ждут `{contact_name, responsible}` ([PDF МТС](https://vpbxdocs.exolve.ru/_media/crm_rest_api.pdf)); Zadarma при проверке URL ждёт эхо `zd_echo` ([док](https://zadarma.com/en/support/instructions/crm-zadarma/)); Graph ждёт `validationToken` в `text/plain` ([док](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)); Gravitel `client` возвращает данные клиента | `types.ts` (`BaseAdapter.respond?`), `_factory.ts`, nest-хендлер хуков. Часть уже есть через `handleChallenge` — расширить на POST-ответы |
| K3 | **Парсер form-urlencoded по умолчанию** (не только JSON) | Mango (`vpbx_api_key`, `json`, `sign` формой — [citeck, стор.](https://citeck-ecos.readthedocs.io/ru/develop/integration/mango/functions.html)), Sipuni (GET/POST query), MTS/Мегафон (`cmd=…`), OnlinePBX (form), Zadarma (`$_POST`) | общий `parseJsonOrForm` в `_factory.ts`; использовать во всех телеком-адаптерах |
| K4 | **Время события из payload** вместо `new Date()` | почти все `normalize` ставят `at = now`, теряя реальный `timestamp/start/callDate` | все телеком-адаптеры |
| K5 | **Направление из payload** вместо зашитого `INBOUND` | Mango, Sipuni, Zadarma, 3CX, bridge зашивают `INBOUND` | соответствующие файлы |
| K6 | **Реальный `externalCallId` из ответа originate** | Mango/Sipuni/Zadarma/RT/Beeline/UIS/OnlinePBX/Telphin/3CX возвращают `xxx-${Date.now()}`, из-за чего исходящий не склеивается с вебхуками | в каждом `originateCall` |
| K7 | **Фетчер записей** `fetchRecording(ctx, ref) → stream/URL` | у Mango, RT, Zadarma, VirtualATS.az, Telphin запись приходит id-шником или одноразовой ссылкой, а не постоянным URL | `types.ts` (`TelephonyAdapter.fetchRecording?`) + воркер скачивания в хранилище CRM |
| K8 | **OAuth refresh** для `accessToken`-провайдеров | Gmail, Graph, Telphin, 3CX (client_credentials), Avito, Voximplant JWT, Vonage JWT — сейчас статичный `accessToken` в секретах | общий `tokenProvider` в `_factory.ts` |

---

## 1. Сводная таблица

Легенда публичности: **П** — полностью публично; **Ч** — частично (часть в кабинете или недокументировано); **З** — закрыто (только по запросу).
Статус в коде: **live** — реальные вызовы; **live-баг** — есть код, но по спецификации он не заработает; **stub** — заглушка или `blocked://`.

| # | Провайдер (key) | Публ. | Главные ссылки | Код сейчас | Что писать (файл) | Что запросить у вендора |
|---|---|---|---|---|---|---|
| 1 | Mango Office (`mango_office`) | П | [docs.mango-office.ru](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/4_obschie_polozheniya_o_vzaimodeystvii_sistem/2_4_unikalnyy_kod_vashey_vats_klyuch_dlya/2_4_3_o_parametre_sign.html) | live-баг (JSON вместо формы, talk_time, запись) | `mango_office.ts`: переписать normalize/verify, `fetchRecording` | код ВАТС, соль, API-коннектор, тестовая ВАТС |
| 2 | Ростелеком ВАТС (`rostelecom_vats`) | П | [PDF v7.5](https://rt-static.rt.ru/sites/default/files/b2b/docs/vats-api-rukovodstvo-administratora-domena-v7.5.pdf) | live-баг (нет подписи в originate, `disconnected`→answered) | вынести из `cloud_pbx_p1.ts` в `rostelecom_vats.ts` | X-Client-ID, ключ подписи, сертификат, доступ к `api-test`, IP |
| 3 | Sipuni (`sipuni`) | П | [HTTP events PDF](https://sipuni.com/idealats/pdf/SIPUNI%20%D0%BE%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20HTTP%20API.pdf), [KB](https://doc.sipuni.com/articles/636--api/) | live-баг (event 2/3 перепутаны, поля, нет hash) | `sipuni.ts` | номер аккаунта, ключ интеграции |
| 4 | VirtualATS.az (`virtualats_az`) | П (KB оператора Azerizone) | [Azerizone KB](https://my.azerizone.net/index.php?rp=%2Fknowledgebase%2F1%2FAPI-istifad%C9%99-etm%C9%99kl%C9%99-VirtualATS-il%C9%99-inteqrasiya.html) | stub («awaiting spec») | `virtualats_az.ts` целиком | publicKey/secretKey, API key, пример подписи GET |
| 5 | МегаФон ВАТС (`megafon_vats`) | Ч | [Elma-гайд](https://www.megapbx.ru/elma365_setup), [REST](https://www.megapbx.ru/rest_api) | live-баг (makeCall GET) | `vats_crm_api.ts` | PDF из кабинета, адрес ВАТС, ключ, IP вебхуков |
| 6 | МТС ВАТС (`mts_vats`) | П | [PDF](https://vpbxdocs.exolve.ru/_media/crm_rest_api.pdf) | live-баг (makeCall GET) | `vats_crm_api.ts` | адрес ОАТС, token |
| 7 | Gravitel (`gravitel`) | П | [PDF](https://gravitel.ru/upload/docs/gravitel_rest_api.pdf) | live-баг (**другой протокол**) | **новый** `gravitel.ts` | X-API-KEY, домен, авторизация входящих |
| 8 | Zadarma (`zadarma`) | П | [API](https://zadarma.com/en/support/api/), [SDK](https://github.com/zadarma/user-api-v1) | live-баг (подписи неверны) | `zadarma.ts` | key/secret |
| 9 | Novofon (`novofon`) | Ч | [api.novofon.com](https://api.novofon.com/) | наследует баги Zadarma | `novofon.ts` | подтверждение совместимости, key/secret |
| 10 | Билайн (`beeline_cloudpbx`) | Ч | [apidoc](https://cloudpbx.beeline.ru/apidoc) + стор. | live-баг (XML, а ждёт JSON) | `beeline_cloudpbx.ts` | схема событий, токен |
| 11 | UIS (`uis`) | П | [Call API](https://www.uiscom.ru/academiya/spravochnyj-centr/dokumentatsiya-api/call_api/) | live-баг (не тот хост/авторизация) | `uis.ts` | access_token, вирт. номер |
| 12 | OnlinePBX (`onlinepbx`) | П | [api2](https://api2.onlinepbx.ru/), [вебхуки](https://kb.onlinepbx.ru/vebkhuki-onlinepbx) | live-баг (нет key_id:key) | `onlinepbx.ts` | домен, auth_key |
| 13 | Телфин (`telphin`) | П (поля не сверены) | [REST](https://www.telphin.ru/subscribers/documentation-rest-api) | live, требует сверки | `telphin.ts` | trusted-приложение |
| 14 | Collabo.az (`collabo_az`) | **З** | [collabo.az](https://collabo.az/en) | stub | после спеки | **вся спека** |
| 15 | Asterisk AMI/ARI | П | [AMI](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Actions/Originate/), [ARI](https://docs.asterisk.org/Latest_API/API_Documentation/Asterisk_REST_Interface/Channels_REST_API/) | bridge частично, `/recording` 501 | `era-pbx-bridge/src/index.js` | (клиент) AMI-логин, путь записей |
| 16 | FreeSWITCH (`freeswitch`) | П | [XML CDR](https://github.com/signalwire/freeswitch-docs/blob/main/docs/integration/call-detail-records.mdx) | stub (p2) | `freeswitch.ts` / bridge | — |
| 17 | 3CX (`threecx`) | П | [Call Control](https://www.3cx.com/docs/call-control-api/) | live-баг (путь, вебхуков нет) | `threecx.ts` + WS-воркер | лицензия 8SC+ AI, DN, ключ |
| 18 | Twilio Voice/SMS | П | [Voice](https://www.twilio.com/docs/voice) | live | — | SID/Token |
| 19 | Vonage (`vonage`) | П | [Voice](https://developer.vonage.com/en/voice/voice-api/getting-started) | stub (p2) | `vonage.ts` | app id, private key, signature secret |
| 20 | Plivo (`plivo`) | П | [Calls](https://www.plivo.com/docs/voice/api/calls) | stub (p2) | `plivo.ts` | auth_id/token |
| 21 | Telnyx (`telnyx`) | П | [Dial](https://developers.telnyx.com/api-reference/call-commands/dial) | stub (p2) | `telnyx.ts` | API key, public key |
| 22 | Sinch (`sinch`) | П | [Callouts](https://developers.sinch.com/docs/voice/api-reference/voice/callouts/callouts) | stub (p2) | `sinch.ts` | app key/secret |
| 23 | Infobip (`infobip`) | П | [Create call](https://www.infobip.com/docs/api/channels/voice/calls/call-legs/create-call) | stub (p2) | `infobip.ts` | API key, base URL |
| 24 | Voximplant (`voximplant`) | П | [StartScenarios](https://docs.voximplant.ai/api-reference/management-api/reference/scenarios/start-scenarios) | stub (p2) | `voximplant.ts` | service account, rule_id |
| 25 | Exolve (`exolve`) | П | [MakeCallback](https://docs.exolve.ru/docs/ru/api-reference/callback-api/making-callback/) | stub (p2) | `exolve.ts` | API key, номер |
| 26 | LSIM (`sms_lsim`) | П | [docs.lsim.az](https://docs.lsim.az/quicksms.html) | live-баг (пароль вместо `key`) | `sms_lsim.ts` | login/pass, sender, IP, DLR-URL |
| 27 | MSM.az (`msm_az`) | **З** | [msm.az/api](https://www.msm.az/ru/heller/api) | stub | после спеки | **вся спека** |
| 28 | Telegram user (`telegram_user`) | П | [API](https://core.telegram.org/api/), [ToS](https://core.telegram.org/api/terms) | stub (p2) | `telegram_user.ts` + воркер | — (api_id делает клиент) |
| 29 | Apple MfB (`apple_mfb`) | Ч (только после одобрения MSP) | [MSP REST](https://register.apple.com/resources/messages/msp-rest-api/) | stub (p2) | после одобрения | статус MSP |
| 30 | Авито (`avito`) | Ч (подпись не документирована) | [портал](https://developers.avito.ru/api-catalog) | stub (p2) | `avito.ts` | client_id/secret, алгоритм подписи |
| 31 | Green-API (`wa_green_api`) | П | [webhook](https://green-api.com/en/docs/api/receiving/technology-webhook-endpoint/) | live | мелкие правки | idInstance/token |
| 32 | OK.ru (`ok_bot`) | П | [Bot API](https://apiok.ru/dev/graph_api/bot_api) | live, verify [НЕПОДТВ.] | `p2_messengers.ts` | токен группы |
| 33 | WeChat OA (`wechat_oa`) | П | [push](https://developers.weixin.qq.com/doc/subscription/guide/dev/push/?lang=en) | live | окно 48 ч, кеш токена | AppID/Secret |
| 34 | LINE (`line`) | П | [signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/) | live | — | secret/token |
| 35 | 360dialog (`wa_360dialog`) | П | [docs](https://docs.360dialog.com/) | live (send) | проверить verify | D360-API-KEY |
| 36 | Wazzup (`wazzup`) | П | [webhooks](https://wazzup24.com/help/api-en/webhooks/) | live, verify слабый | `wazzup.ts` | crmKey |
| 37 | MAX (`max_bot`) | П | [subscriptions](https://dev.max.ru/docs-api/methods/POST/subscriptions/) | live | — | токен |
| 38 | Gmail API (`gmail_api`) | П | [push](https://developers.google.com/workspace/gmail/api/guides/push) | partial | `gmail_api.ts` + watch-воркер | GCP, OAuth, Pub/Sub, верификация |
| 39 | MS Graph Mail (`ms_graph_mail`) | П | [subscription](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0) | partial | `ms_graph_mail.ts` + subscription-воркер | Entra app, admin consent |
| 40 | IMAP/SMTP (`email_imap_smtp`) | П (RFC) | [RFC 5321](https://www.rfc-editor.org/rfc/rfc5321) | live | `email.poller.ts` (UIDVALIDITY) | — |
| 41 | Google Ads Conversions | П | [offline](https://developers.google.com/google-ads/api/docs/conversions/upload-offline) | stub (p2) | `google_ads_conversions.ts` | dev token, OAuth, customer id |
| 42 | Google Ads Lead Form | П | [webhook](https://developers.google.com/google-ads/webhook/docs/implementation) | stub (p2) | `google_ads_lead_form.ts` | — |
| 43 | Google Sheets (`sheets_export`) | П | [append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append) | stub (p2) | `sheets_export.ts` | OAuth / SA |
| 44 | OpenAI STT (`stt_openai`) | П | [STT](https://developers.openai.com/api/docs/guides/speech-to-text) | stub (p2) | `stt_openai.ts` | API key |
| 45 | Geocoding (`maps_geocode`) | П | [Geocoding](https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-geocoding) | stub (p2) | `maps_geocode.ts` | API key |
| — | Внутренние: `generic_call_webhook`, `era_externalcall`, `sms_generic`, `bi_export`, `llm_assist` | — | спека наша | см. §7.4 | — | — |

**Итого: 45 внешних провайдеров. П — 38, Ч — 5 (МегаФон, Novofon, Билайн, Авито, Apple MfB), З — 2 (Collabo.az, MSM.az).** Ещё 5 внутренних ключей вендора не требуют.

---

## 2. Облачные АТС РФ/АЗ (T-I18, T-I19, T-I22…T-I26)

### 2.1 Mango Office — `mango_office.ts` (T-I18)

**Публичность:** П. Источник: [docs.mango-office.ru → API и разработка](https://www.mango-office.ru/support/integraciya/api/).

- **Аутентификация.** Каждый запрос в обе стороны — POST с полями `vpbx_api_key`, `json` (строка JSON), `sign`. Формула: `sign = sha256(vpbx_api_key + json + vpbx_api_salt)` ([2.4.3](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/4_obschie_polozheniya_o_vzaimodeystvii_sistem/2_4_unikalnyy_kod_vashey_vats_klyuch_dlya/2_4_3_o_parametre_sign.html)). Тело — `application/x-www-form-urlencoded` ([citeck, стор.](https://citeck-ecos.readthedocs.io/ru/develop/integration/mango/functions.html)).
- **Base URL:** `https://app.mango-office.ru/vpbx/…`
- **Originate:** `POST /vpbx/commands/callback`, json `{command_id, from:{extension, number?}, to_number, line_number?, sip_headers?}`. Результат приходит асинхронно на **наш** `POST {url}/result/callback` с `{command_id, result}`, где `1000` — успех ([3.2.1](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/2_2_api_komandy/3_2_1_initsiirovanie_vyzova_ot_imeni.html)).
- **Вебхуки (на наш URL + подпуть):**
  - `/events/call`: `entry_id, call_id, timestamp (UTC+3), seq, call_state, location (ivr|queue|abonent), from{extension,number}, to{extension,number}, command_id?, callback_initiator?` ([3.1.2](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/1_1_api_realtime/3_1_2_uvedomlenie_o_vyzove.html)). Пример последовательности состояний: [пример исходящего](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/8_primery_povedeniya/initsiirovanie_ishodyaschego_vyzova.html).
  - `/events/summary`: итог; `entry_result` (1 — разговор, 0 — пропущен), `talk_time` — **момент** ответа (0, если не было) ([3.1.6](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/1_1_api_realtime/3_1_6_uvedomlenie_o_zavershenii_vyzova.html)).
  - `/events/recording` (3.1.4) и `/events/record/added` (3.1.8) содержат `recording_id` ([3.1.4](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/1_1_api_realtime/3_1_4_uvedomlenie_o_zapisi_razgovora.html), [3.1.8](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/1_1_api_realtime/3_1_8_sobytie_o_pomeschenii_zapisi_razgovora_v.html)).
- **Записи:** `POST /vpbx/queries/recording/post` `{recording_id, action:"download"|"play"}` → 302 на временную ссылку MP3 ([3.5.1](https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/5_5_api_zapisi_razgovorov_rechevaya_analitika/3_5_1_poluchenie_zapisi_razgovora_posredstvom.html)).
- **Подпись входящих:** та же формула; отвечать HTTP 200 сразу.
- **Лимиты / sandbox:** не найдены **[НЕПОДТВ.]**; нужна тестовая ВАТС.

**Код сейчас:** `verify` парсит тело как **JSON**, поэтому на реальной форме будет «invalid mango body» и все события отклонятся. `normalize` берёт `talk_time` как длительность (это timestamp), кладёт `recording_id` в `recordingUrl`, зашивает `INBOUND`, не различает подпути. `originate` возвращает фейковый id вместо `command_id`.

**Что дописать (`mango_office.ts`):**
1. Парсинг формы (K3); verify по полям формы; `sign` сравнивать без учёта регистра.
2. Роутинг по `subPath` (K1):
   - `events/call`:
     - `Appeared` → `call.ringing`;
     - `Connected` → `call.answered`;
     - `Disconnected` → без события (ждём summary).
   - `events/summary`:
     - `entry_result=1` → `call.ended` (`durationSec = end_time − talk_time`);
     - `entry_result=0` → `call.missed`.
   - `events/recording` / `events/record/added` → `fetchRecording(recording_id)` (K7).
   - `result/callback` → статус originate.
3. `externalCallId = entry_id`. Направление: `from.extension` есть → OUTBOUND.
4. `originate` возвращает `command_id`, затем связываем с `entry_id` по `command_id`.

**У вендора:** код ВАТС, соль, API-коннектор, тестовая ВАТС, белый список IP (если включён).

### 2.2 Ростелеком «Интеграционный API» — `rostelecom_vats.ts` (T-I18)

**Публичность:** П. [Руководство администратора домена v7.5, ред. 6/2024 (PDF, 72 стр.)](https://rt-static.rt.ru/sites/default/files/b2b/docs/vats-api-rukovodstvo-administratora-domena-v7.5.pdf).

- **Аутентификация** (§1.3.1–1.3.2): заголовки `X-Client-ID` и `X-Client-Sign = sha256hex(X-Client-ID + JSON-тело + ключ подписи)`. Подписываются запросы **в обе стороны**. В PDF есть контрольный пример с хешем `fc95a524…2c36`, его стоит взять в unit-тест.
- **Base URL:** прод `https://api.cloudpbx.rt.ru`, тест `https://api-test.cloudpbx.rt.ru` (§B.3–B.4). Есть IP-ограничение источников; для HTTPS нужен сертификат API из ЛК (§1.3.3).
- **Методы к API** (§2.2.3):
  - `call_back` — `{request_number (E.164), from_sipuri | from_pin}`;
  - `get_record` — `{session_id, ip_adress}` → `{result:"0", url}`, одноразовая ссылка, доступная только с указанного IP (§А.3.2);
  - `users_info`, `call_info`, `domain_call_history` + `download_call_history` (CSV);
  - `analytics/*`.
- **Вебхуки от API:**
  - `call_events`: `session_id, timestamp, type (incoming|outbound|internal), state (new|calling|connected|disconnected|end|analytics), from_number, request_number, …` (§А.2.1);
  - `get_number_info` — запрос имени по номеру.
- **Sandbox:** да, `api-test` + вкладка «Отладка взаимодействия».

**Код сейчас:**
- `originate` **не ставит `X-Client-Sign`** и шлёт на произвольный `apiUrl`, поэтому будет отказ.
- В `normalize` проверка `state.includes("connect")` срабатывает и на `"disconnected"`, то есть разрыв становится `call.answered`.
- `new` и `calling` проваливаются в `call.ended`.
- `get_record` нет.

**Что дописать:**
- Отдельный файл; `originate` = `POST {base}/call_back` + подпись.
- Маппинг состояний:
  - `new`, `calling` → `call.ringing`;
  - `connected` → `call.answered`;
  - `disconnected` → пропустить (это плечо);
  - `end` → `call.ended` или `call.missed` (`connected` в сессии не было → missed);
  - `analytics` → метаданные.
- `externalCallId = session_id`; `type` → direction.
- `fetchRecording` = `get_record` с IP воркера.

**У вендора:** услуга, X-Client-ID, ключ подписи, сертификат, IP, доступ к тест-стенду.

### 2.3 Sipuni — `sipuni.ts` (T-I19)

**Публичность:** П. [HTTP API PDF (2018)](https://sipuni.com/idealats/pdf/SIPUNI%20%D0%BE%D0%BF%D0%B8%D1%81%D0%B0%D0%BD%D0%B8%D0%B5%20HTTP%20API.pdf); [KB API](https://doc.sipuni.com/articles/636--api/); [статистика и записи](https://doc.sipuni.com/articles/636-642--poluchenie-statistiki/).

- **Вебхуки (GET/POST urlencoded).** Общие поля: `event, call_id, src_num, src_type (1 внешн., 2 внутр.), dst_num, dst_type, timestamp (Unix UTC)`, а также `short_src_num/short_dst_num`. События:
  - `event=1` — Call (+`is_inner_call`);
  - `event=2` — **Hang-up**: `status ANSWER|BUSY|NOANSWER|CANCEL|CONGESTION|CHANUNAVAIL`, `call_start_timestamp`, `call_answer_timestamp` (0, если нет), `call_record_link`;
  - `event=3` — **Answer**;
  - `event=4` — Secondary hang-up.
- **Ответ** обязан быть JSON с `success:true`, иначе отправку могут приостановить (PDF стр. 1) → K2.
- **Подпись вебхуков:** в PDF **не описана**; защита — секрет в URL `?k=` (как сейчас).
- **REST** (`hash = md5(значения через "+" в фикс. порядке + секрет)`):
  - статистика `/api/statistic/export` (CSV);
  - записи `/api/statistic/export/all`;
  - файл `POST /api/statistic/record`, `hash = md5(id+user+secret)` ([KB](https://doc.sipuni.com/articles/636-642--poluchenie-statistiki/)).
- **Callback:** код использует `/api/callback/call_number`. Порядок полей hash в официальном источнике в этом прогоне **не найден [НЕПОДТВ.]**. Для `call_external`: `phoneFrom+phoneTo+sipnumber+sipnumber2+user+secret` ([стор.](https://searchtips.ru/sipuni/)).

**Код сейчас:**
- `event 2 → answered` **неверно** (2 = Hang-up, 3 = Answer);
- поля `src/dst` вместо `src_num/dst_num`, `record_url` вместо `call_record_link`;
- длительность не считается;
- callback с `user: apiKey` и без `hash`;
- ответ `{success:true}` не гарантирован.

**Что дописать:**
- Маппинг:
  - `1` (первый для `call_id`) → `call.ringing`;
  - `3` → `call.answered`;
  - `2` + `ANSWER` → `call.ended` (`durationSec = timestamp − call_answer_timestamp`, `recordingUrl = call_record_link`);
  - `2` + прочие статусы → `call.missed`;
  - `4` → игнор.
- `src_type=2` → OUTBOUND.
- Callback: поле «номер аккаунта» + md5-hash.
- Ответ `{"success":true}`.

**У вендора:** номер аккаунта, ключ интеграции, порядок hash для `call_number` (если не найдётся в KB).

### 2.4 VirtualATS.az — `virtualats_az.ts` (T-I19) — **разблокировать**

**Публичность:** П. API опубликован оператором Azerizone: [KB «API istifadə etməklə VirtualATS ilə inteqrasiya»](https://my.azerizone.net/index.php?rp=%2Fknowledgebase%2F1%2FAPI-istifad%C9%99-etm%C9%99kl%C9%99-VirtualATS-il%C9%99-inteqrasiya.html); перечень возможностей на [virtualats.az](https://virtualats.az/imkanlar/38-api-ttbiqi-proqramladrma-interfeysi.html). **В коде стоит «awaiting spec», но спека есть.**

- **Base URL:** `https://web.vats.az/vats/api`
- **Аутентификация:** заголовок `vats-authentication: publicKey:token:sign`, где:
  - `token` — Unix-время в **мс**;
  - `sign = HmacSHA1Hex(secretKey, token + <запрос/ответ>)` (в доке указан Apache commons-codec `HmacUtils.hmacSha1Hex`).
  Для GET сказано, что в подписи участвуют: для history «список результатов», для download `{id}`, для hangup `{callId}`. **Точная строка для GET неоднозначна → [НЕПОДТВ.], запросить пример.** Для скачивания записи подпись можно передать query-параметром `?vats-authentication=`.
- **Методы:**
  - `GET /callRecord/history?from&to (ddMMyyyyHHmmssZ)&offset&limit(≤1000)&order&direction&disposition`;
  - `GET /account/list` (`ONLINE|OFFLINE|DISCONNECTED|UNMONITORED`);
  - `GET /storageFile/download/{id}`;
  - `GET /call/originate?to&number&defaultNumber` → `{value: callId}` (асинхронно);
  - `GET /call/create` — синхронно;
  - `GET /call/hangup/{callId}`.
- **Вебхук в CRM:** POST JSON `{apiKey, callDate ("d.MM.yyyy HH:mm:ssZ"), callerId, callId, source, destination, answeredNumber, duration, talkTime, direction (INBOUND|OUTBOUND), disposition (RING|ANSWERED|NO_ANSWERED|FAILED|BUSY), recordConversation, state (NEW|UPDATE|HANGUP)}`. Шлётся при начале, ответе и завершении. Ответ: `{"result":"success"|"error","errors":[]}`.
- **Проверка вебхука:** `apiKey` = ключ CRM, который мы задаём в интеграции.
- **Лимиты / sandbox:** не описаны **[НЕПОДТВ.]**.

**Что дописать** (`virtualats_az.ts`, family `vats_az_hmac`):
- verify: `apiKey`.
- Маппинг:
  - `NEW` → `call.ringing`;
  - `UPDATE` + `ANSWERED` → `call.answered`;
  - `HANGUP` + `ANSWERED` → `call.ended` (`durationSec=talkTime`, `recordingUrl=recordConversation`, `extension=answeredNumber`);
  - `HANGUP` + иначе → `call.missed`.
- `originateCall` → `/call/originate` с подписью.
- `fetchRecording` с подписью; `testConnection` → `/account/list`; ответ K2.

**У вендора:** publicKey/secretKey, API key интеграции, тестовый номер, **пример корректной подписи для GET**.

### 2.5 МегаФон ВАТС / 2.6 МТС ВАТС — `vats_crm_api.ts` (T-I25)

**Публичность:**
- МТС — П: [crm_rest_api.pdf](https://vpbxdocs.exolve.ru/_media/crm_rest_api.pdf).
- МегаФон — Ч: полный PDF только в кабинете ВАТС ([megapbx.ru/rest_api](https://www.megapbx.ru/rest_api)). Публичен [Elma365-гайд](https://www.megapbx.ru/elma365_setup) с рабочим кодом; стороннее зеркало `api.megapbx.ru/#/docs/crmapi/v1` ([стор.](https://github.com/sadykh/megafon-crmapi-megapbx-pbx-context7)).

Протокол общий:
- **CRM → АТС:** `POST https://<адрес>/sys/crm_api.wcgp` с полем `token`.
  - МегаФон (Elma-гайд): JSON `{cmd, token, …}`, адрес вида `https://vatsNNN.megapbx.ru/sys/crm_api.wcgp`.
  - МТС (PDF): POST-форма.
  - Команды: `accounts, groups, makeCall (cmd,token,user,phone → 200 CallID), history (CSV), subscribeOnCalls, subscriptionStatus, set_dnd, get_dnd` (PDF МТС §5).
- **АТС → CRM** (POST, `crm_token`):
  - `history`: `type in|out, user, ext, groupRealName, telnum, phone, diversion, start (YYYYmmddTHHMMSSZ), duration, callid, link, status Success|Missed|Cancel|Busy|NotAvailable|NotAllowed|NotFound`;
  - `event`: `type INCOMING|ACCEPTED|COMPLETED|CANCELLED|OUTGOING|TRANSFERRED, phone, user, ext, direction, callid`;
  - `contact` → ответ `{contact_name, responsible}` (§4.1–4.3).
- **IP вебхуков МегаФона:** `193.201.230.155` ([стор.](https://github.com/mikopbx/ModuleMegafonPbx)) **[НЕПОДТВ.]**.

**Код сейчас:** verify по `crm_token` ok; **`originateCall` шлёт GET** (по спеке нужен POST); `start` игнорируется; `OUTGOING` не даёт OUTBOUND; `contact` не отвечает карточкой.

**Что дописать:**
- makeCall через POST (`config.bodyMode = json|form`); `externalCallId = CallID`; `at = start`.
- Маппинг:
  - `INCOMING`/`OUTGOING` → `call.ringing`;
  - `ACCEPTED` → `call.answered`;
  - `CANCELLED` → `call.missed`;
  - `history.Success` → `call.ended`, прочие статусы → `call.missed`.
- Ответ на `contact`; `testConnection` → `cmd=accounts`.

**У вендора:** МегаФон — PDF REST из кабинета, адрес ВАТС, ключ, IP вебхуков, тестовая ВАТС. МТС — адрес ОАТС, token.

### 2.7 Gravitel — **новый** `gravitel.ts` (T-I25)

**Публичность:** П. [gravitel_rest_api.pdf](https://gravitel.ru/upload/docs/gravitel_rest_api.pdf).

**Протокол не совпадает с МТС/МегаФоном** (сейчас `gravitel.ts` — re-export `vats_crm_api`, это ошибка):
- **Base URL:** `https://crm.aicall.ru`, REST `/v1/{domain}/…`, заголовок **`X-API-KEY`**.
- **CRM → АТС:** `POST /v1/{domain}/makecall {extension|from, number, clid?}` → 201. В PDF пример и таблица расходятся (`extension` vs `from`) **[НЕПОДТВ.]**. Также `sms`, `history`, `accounts`, `groups`, `numbers`, `callerid`, `balance`, `campaign/*`.
- **АТС → CRM** (JSON, подпути K1):
  - `POST {crm_url}/history` `{id, when, direction in|out, result success|missed|not_available|forbidden|busy|unknown, duration, provision, client, extension, phone, record}`;
  - `POST {crm_url}/event` `{id, when, direction, stage alerting|talking|released, client, extension, phone}`;
  - `POST {crm_url}/client`;
  - `POST {crm_url}/campaign/report`.
- **Авторизация входящих:** в доке «с использованием ключа (token)», механизм **[НЕПОДТВ.]**, уточнить.

**Что дописать:**
- `gravitel.ts` с verify по заголовку ключа (до подтверждения ещё и `?k=`).
- Маппинг:
  - `alerting` → `call.ringing`;
  - `talking` → `call.answered`;
  - `history.success` → `call.ended` (`durationSec=duration`, `recordingUrl=record`, `fromNumber=client`);
  - прочие `result` → `call.missed`.
- `originateCall` → `makecall`; ответ на `/client`.

**У вендора:** домен, X-API-KEY, механизм авторизации входящих.

---

### 2.8 Zadarma — `zadarma.ts` / 2.9 Novofon — `novofon.ts`

**Публичность:**
- Zadarma — П: [API](https://zadarma.com/en/support/api/), [CRM-инструкция](https://zadarma.com/en/support/instructions/crm-zadarma/), официальный SDK [user-api-v1](https://github.com/zadarma/user-api-v1), [openapi](https://github.com/zadarma/openapi).
- Novofon — Ч: [api.novofon.com](https://api.novofon.com/) почти пуст; [инструкция «своя CRM»](https://novofon.com/instructions/integration/own-crm/). Совместимость с Zadarma v1 **[НЕПОДТВ.]**: сообщают об обновлении «Novofon 2.0» ([стор.](https://forum.rukovoditel.net.ru/viewtopic.php?t=7127)).

- **REST-авторизация** (официальный SDK, `lib/Client.php`):
  - `Authorization: <key>:<sig>`;
  - `sig = base64( hash_hmac('sha1', method_path + qs + md5(qs), secret) )`, `qs` — `ksort` + RFC1738;
  - **`hash_hmac` в PHP по умолчанию возвращает hex**, то есть base64 берётся от hex-строки.
- **Вебхуки** (POST-форма, заголовок `Signature`). Строки подписи по SDK `lib/Webhook/*`:
  - `NOTIFY_START`, `NOTIFY_INTERNAL`, `NOTIFY_END`: `caller_id + called_did + call_start`;
  - `NOTIFY_ANSWER`: `caller_id + destination + call_start`;
  - `NOTIFY_OUT_START`, `NOTIFY_OUT_END`: `internal + destination + call_start`;
  - `NOTIFY_RECORD`: `pbx_call_id + call_id_with_rec`;
  - `Signature = base64(hmac_sha1_hex(str, secret))`.
- **Проверка URL:** GET `?zd_echo=X` → вернуть `X` plain text ([CRM-инструкция](https://zadarma.com/en/support/instructions/crm-zadarma/)).
- **Поля `NOTIFY_END`:** `call_start, pbx_call_id, caller_id, called_did, internal, duration, disposition, status_code, is_recorded, call_id_with_rec`.
- **Записи:** `GET /v1/pbx/record/request/?call_id|pbx_call_id` → ссылка.
- **Callback:** `GET /v1/request/callback/?from&to` с подписью.

**Код сейчас:**
- verify: `md5(body+secret)`, **неверно**, все реальные события отклонятся;
- originate без `Authorization` (key в query), **отказ**;
- `call_id_with_rec` кладётся как URL;
- нет `NOTIFY_OUT_*`, нет `zd_echo`.

**Что дописать:**
- `zadarmaSign()` по SDK; verify по таблице строк; `handleChallenge` для `zd_echo`.
- Маппинг:
  - `NOTIFY_START`/`NOTIFY_OUT_START` → `call.ringing` (OUT → OUTBOUND);
  - `NOTIFY_ANSWER` → `call.answered`;
  - `NOTIFY_END`/`NOTIFY_OUT_END`: `disposition=answered` → `call.ended`, иначе `call.missed`;
  - `NOTIFY_RECORD` → `fetchRecording`.
- Novofon: тот же код + `apiBase` в конфиге.

**У вендора:** key/secret. Novofon — подтверждение base URL и подписи.

### 2.10 Билайн Облачная АТС — `beeline_cloudpbx.ts`

**Публичность:** Ч. Официальный [apidoc](https://cloudpbx.beeline.ru/apidoc) в этом прогоне не открыт **[НЕПОДТВ.]**. Детали ниже из [taigasys/beeline-portal-api](https://github.com/taigasys/beeline-portal-api/blob/master/beelineapi.go), [Хабр Q&A](https://qna.habr.com/q/403919), [SO](https://ru.stackoverflow.com/questions/730493/) — все **[стор.]**.

- Заголовок `X-MPBX-API-AUTH-TOKEN`; base `https://cloudpbx.beeline.ru/apis/portal/`.
- Подписка `PUT /subscription {pattern, expires, subscriptionType:"BASIC_CALL", url}` → `subscriptionId`, продлевать до истечения.
- События — **Xsi-XML**: `CallReceivedEvent`, `CallAnsweredEvent`, `CallReleasedEvent` (`callId, startTime, releaseTime, releasingParty`). Без ответа 200 подписка снимается.
- Записи: `GET /v2/records`, `/v2/records/{id}/download`. Originate: `POST /abonents/{pattern}/call?phoneNumber=`.

**Код сейчас:** verify ждёт наш токен в заголовке от Билайна, а он его **не присылает [НЕПОДТВ.]**. normalize ожидает JSON. Нет продления подписки.

**Что дописать:**
- XML-парсер.
- Маппинг:
  - `CallReceived` → `call.ringing`;
  - `CallAnswered` → `call.answered`;
  - `CallReleased` → `call.ended`/`call.missed`.
- Секрет в URL; cron продления; `fetchRecording`.

**У вендора:** токен, официальная схема событий, тестовый абонент.

### 2.11 UIS — `uis.ts`

**Публичность:** П. [Call API](https://www.uiscom.ru/academiya/spravochnyj-centr/dokumentatsiya-api/call_api/), [start.simple_call](https://www.uiscom.ru/academiya/spravochnyj-centr/dokumentatsiya-api/call_api/create_call/start_simple_call/), [Data API](https://www.uiscom.ru/academiya/spravochnyj-centr/dokumentatsiya-api/data_api/), [HTTP-уведомления](https://www.uiscom.ru/academiya/spravochnyj-centr/obshchie-nastroyki-v-lichnom-kabinete/http-uvedomleniya/).

- **Call API:** JSON-RPC 2.0 `POST https://callapi.uiscom.ru/v4.0`, **`params.access_token`**. Метод `start.simple_call {first_call, virtual_phone_number, contact, operator}` → `call_session_id`. `start.employee_call` — параметры сверить по разделу «Создать звонок».
- **Data API** `https://dataapi.uiscom.ru/v2.0`: выгрузка звонков и записей ([upload_calls](https://www.uiscom.ru/academiya/spravochnyj-centr/dokumentatsiya-api/data_api/communication/upload_calls/)).
- **Вебхуки:** пользовательский JSON-шаблон в ЛК с подстановками `{{notification_mnemonic}}`, `{{call_session_id}}`, `{{direction}}`, `{{contact_phone_number}}`. Формат задаём **мы**.

**Код сейчас:** originate идёт в Data API с Bearer, это ошибка.

**Что дописать:** originate → Call API; наш шаблон уведомлений в `setupSteps`; маппинг по мнемоникам (точный список **[НЕПОДТВ.]**).

**У вендора:** access_token, виртуальный номер, employee_id.

### 2.12 OnlinePBX — `onlinepbx.ts`

**Публичность:** П. [HTTP API](https://api2.onlinepbx.ru/) / [Swagger](https://api2.onlinepbx.ru/documentation/static/index.html), [KB API](https://kb.onlinepbx.ru/api-onlinepbx), [вебхуки](https://kb.onlinepbx.ru/vebkhuki-onlinepbx).

- **Авторизация:** `POST /{domain}/auth.json {auth_key}` → `key_id, key`; далее заголовок `x-pbx-authentication: key_id:key`.
- **Методы:** `POST /{domain}/call/now.json {from,to}`; `POST /{domain}/mongo_history/search.json` (≤ неделя).
- **Вебхуки** (form):
  - `call_start`: `domain, event, direction, uuid, caller, callee, from_domain, to_domain, gateway, date`;
  - `call_end`: + `call_duration, dialog_duration, hangup_cause, hangup_by, download_url`;
  - также `call_answered`, `call_missed`.
- **Подпись:** не описана **[НЕПОДТВ.]**, используем секрет в URL.

**Код сейчас:** originate без `x-pbx-authentication`; verify ищет `auth_key` в вебхуке, а его там нет.

**Что дописать:**
- Кеш `key_id:key`.
- Маппинг:
  - `call_start` → `call.ringing`;
  - `call_answered` → `call.answered`;
  - `call_end` + `dialog_duration>0` → `call.ended` (`recordingUrl=download_url`), иначе `call.missed`.

### 2.13 Телфин — `telphin.ts`

**Публичность:** П. [REST API Телфин.Офис](https://www.telphin.ru/subscribers/documentation-rest-api), [авторизация](https://www.telphin.ru/subscribers/support/instructions/application-authorization-and-integration-launch).

- **OAuth2:** `POST https://apiproxy.telphin.ru/oauth/token` (client_credentials, trusted-приложение).
- **События:** подписка «События внутреннего номера» `/extension/{id}/event/`, поля `CallID, CallStatus, RecID`; запись по `RecID`.
- **Точные пути и поля в этом прогоне не сверены [НЕПОДТВ.]**, сверить по Swagger.

**Что дописать:** token refresh; автоподписка в `onEnable`; маппинг `CallStatus`; `fetchRecording(RecID)`.

### 2.14 Collabo.az — `collabo_az.ts`

**Публичность:** **З**. На [collabo.az](https://collabo.az/en) API только упомянут. Контакт: info@collabo.az, +994 12 599 13 33.

**Запросить:** base URL/auth, originate, вебхуки (события, поля, подпись), записи, история, лимиты, тестовый аккаунт.

---

## 3. Свой PBX (T-I20)

### 3.1 Asterisk AMI/ARI — `tools/era-pbx-bridge/src/index.js` + `asterisk.ts`

**Публичность:** П. Источники:
- AMI: [Originate](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Actions/Originate/), [OriginateResponse](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Events/OriginateResponse/), [Cdr](https://docs.asterisk.org/Latest_API/API_Documentation/AMI_Events/Cdr/), [CDR spec](https://docs.asterisk.org/Configuration/Reporting/Call-Detail-Records-CDR/CDR-Specification/);
- ARI: [Channels](https://docs.asterisk.org/Latest_API/API_Documentation/Asterisk_REST_Interface/Channels_REST_API/), [Recordings](https://docs.asterisk.org/Latest_API/API_Documentation/Asterisk_REST_Interface/Recordings_REST_API/).

Факты:
- `Originate Async:true` сразу отвечает Success, **результат приходит в `OriginateResponse`** (тот же ActionID + Uniqueid).
- Событие `Cdr` (при `cdr_manager`): `UniqueID, Duration, BillableSeconds, Disposition (ANSWERED|NO ANSWER|BUSY|FAILED|CONGESTION)`.
- ARI `GET /ari/recordings/stored/{name}/file` отдаёт файл.

**Код сейчас (bridge):**
- `Newchannel` даёт ringing на **каждый** канал, включая внутренние плечи;
- answered нет;
- длительность из `Hangup.Duration`, которого у Hangup нет, поэтому всегда 0;
- `externalCallId` = ActionID;
- `/recording/*` → 501.

**Что дописать:**
- Маппинг:
  - `DialBegin` (первый для Linkedid) → `call.ringing`;
  - `DialEnd ANSWER` или `BridgeEnter` → `call.answered`;
  - `Cdr` → `call.ended`/`call.missed` (`durationSec=BillableSeconds`).
- Direction по контексту из конфига.
- Ждать `OriginateResponse` и возвращать Uniqueid.
- `/recording/:id`: ARI stored file или файл MixMonitor из `RECORDING_DIR` по HMAC-ссылке с TTL.

**У клиента:** AMI user (read call,cdr; write originate), `cdr_manager`, путь MixMonitor/ARI.

### 3.2 FreeSWITCH — `freeswitch.ts` (p2 stub)

**Публичность:** П.
- ESL: `bgapi originate` + `BACKGROUND_JOB` (Job-UUID), `CHANNEL_HANGUP_COMPLETE` ([wiki, стор.](https://asterisk-pbx.ru/wiki/freeswitch/mod/mod_event_socket), [рассылка FS](https://lists.freeswitch.org/pipermail/freeswitch-users/2008-January/029778.html)).
- `mod_xml_cdr` POST-ит XML CDR на каждое плечо ([freeswitch-docs](https://github.com/signalwire/freeswitch-docs/blob/main/docs/integration/call-detail-records.mdx)).

**Что дописать:** ESL-режим в bridge или приём `mod_xml_cdr` (Basic + IP allowlist): `billsec>0` → `call.ended`, иначе `call.missed`.

### 3.3 3CX — `threecx.ts`

**Публичность:** П. [Call Control API](https://www.3cx.com/docs/call-control-api/), [Endpoints](https://www.3cx.com/docs/call-control-api-endpoints/), [пример](https://github.com/3cx/call-control-service-example/blob/master/README.md).

- **Лицензия: «You must have an 8SC+ AI license to use 3CX Call Control»** (официальная страница).
- `POST /connect/token` (client_credentials, client_id = DN).
- `POST /callcontrol/{dn}/makecall {destination, timeoutSec}`.
- События **только через WebSocket** `/callcontrol/ws`, HTTP-вебхуков нет.

**Код сейчас:** makecall без `{dn}` и с телом `{from,to}`; статичный token; verify для несуществующих вебхуков.

**Что дописать:** token refresh; правильный путь и тело; WS-воркер, который переводит события в `call.*` и шлёт в хук с HMAC.

---

## 4. CPaaS (p2_catalog → отдельные файлы)

| Провайдер | Аутентификация | Originate | События / подпись | Записи |
|---|---|---|---|---|
| **Twilio** (live) | Basic SID:Token | `POST /2010-04-01/Accounts/{sid}/Calls.json` | `X-Twilio-Signature` (уже в `wa_twilio.ts`) | RecordingUrl ([docs](https://www.twilio.com/docs/voice)) |
| **Vonage** | JWT приложения (application_id + private key) | `POST https://api.nexmo.com/v1/calls` ([start](https://developer.vonage.com/en/voice/voice-api/getting-started)) | event_url; входящие подписаны JWT, проверка signature secret ([webhooks](https://developer.vonage.com/en/getting-started/concepts/webhooks)) | `record` в NCCO ([blog](https://developer.vonage.com/en/blog/how-to-record-audio-from-phone-call-node-js-dr)) |
| **Plivo** | Basic auth_id:token | `POST https://api.plivo.com/v1/Account/{auth_id}/Call/` (answer_url обязателен) ([calls](https://www.plivo.com/docs/voice/api/calls)) | `X-Plivo-Signature-V3` = base64(HMAC-SHA256(url+"."+nonce)) ([SDK](https://github.com/plivo/plivo-go/blob/master/utils.go)) | `POST …/Call/{uuid}/Record/` → record_url |
| **Telnyx** | Bearer API key | `POST https://api.telnyx.com/v2/calls` ([dial](https://developers.telnyx.com/api-reference/call-commands/dial)) | Ed25519 `telnyx-signature-ed25519` над `timestamp\|rawBody` ([guide](https://developers.telnyx.com/docs/development/migration/call-control-migration-guide)) | `call.recording.saved` ([ref](https://developers.telnyx.com/api-reference/callbacks/call-recording-saved)) |
| **Sinch** | `application key:Base64(HMAC-SHA256)` + x-timestamp ([signed](https://developers.sinch.com/docs/voice/api-reference/authentication/signed-request)) | `POST https://calling.api.sinch.com/calling/v1/callouts` | ICE/ACE/DiCE подписаны тем же алгоритмом ([callback signing](https://developers.sinch.com/docs/voice/api-reference/authentication/callback-signed-request)) | [НЕПОДТВ.] |
| **Infobip** | `Authorization: App <key>` | `POST https://api.infobip.com/calls/1/calls` ([create](https://www.infobip.com/docs/api/channels/voice/calls/call-legs/create-call)) | подписка → `CALL_FINISHED` и др. ([events](https://www.infobip.com/docs/api/channels/voice/calls/calls-applications/calls-event-webhook)); подпись [НЕПОДТВ.] | `recording` в create call |
| **Voximplant** | JWT service account ([auth](https://voximplant.com/docs/guides/management-api/authorization)) | `POST https://api.voximplant.com/platform_api/StartScenarios` ([ref](https://docs.voximplant.ai/api-reference/management-api/reference/scenarios/start-scenarios)) | callbacks: `hash = MD5(salt+account_id+api_key+callback_id)` ([callbacks](https://voximplant.com/docs/guides/management-api/callbacks)) | в VoxEngine-сценарии |
| **Exolve** | Bearer API key | `POST https://api.exolve.ru/call/v1/MakeCallback` ([doc](https://docs.exolve.ru/docs/ru/api-reference/callback-api/making-callback/)) | URL в ЛК, JSON ([events](https://docs.exolve.ru/docs/ru/instructions/events/), [callback events](https://docs.exolve.ru/docs/ru/api-reference/statistics-api/callback-events/)); подпись [НЕПОДТВ.] | ссылка в событии |

Sandbox у всех CPaaS — trial-аккаунты; условия в этом прогоне **не сверялись [НЕПОДТВ.]**.

**Что дописать:** для каждого `providers/<key>.ts` (`originateCall`, `verifyWebhook` по таблице, `normalize`):
- answered → `call.answered`;
- hangup с длительностью > 0 → `call.ended`, иначе `call.missed`;
- recording-события → `recordingUrl`.

Затем убрать ключ из `p2()` в `p2_catalog.ts`. Exolve SMS: `POST https://api.exolve.ru/messaging/v1/SendSMS` ([doc](https://docs.exolve.ru/docs/ru/api-reference/sms-api/sending-sms/)).

---

## 5. SMS

### 5.1 LSIM — `sms_lsim.ts` (live-баг)

**Публичность:** П. [docs.lsim.az/quicksms.html](https://docs.lsim.az/quicksms.html) (официально), [md-копия](https://integrify.mmzeynalli.dev/integrations/lsim/official/api/) **[стор.]**.

- **Отправка GET:** `https://apps.lsim.az/quicksms/v1/send?login&msisdn&text&sender&key[&unicode]`, `key = md5( md5(password) + login + text + msisdn + sender )`.
- **Отправка POST:** `https://apps.lsim.az/quicksms/v1/smssender`, JSON `{login, key, msisdn, text, sender, scheduled:"NOW", unicode}`.
- **Ответ:** `{successMessage, errorMessage, obj (transactionId), errorCode}`.
- **Баланс:** `GET /quicksms/v1/balance?login&key`, `key = md5(md5(password)+login)`.
- **Отчёт:** `POST /smsreporter {login, transid}` / `GET /report?login&trans_id`.
- **Статусы:** 100 queue, 101 delivered, 102 undelivered, 103 expired, 104 rejected, 105 cancelled, 106 error, 107 unknown, 108 sent, 109 blacklist.
- **Ошибки:** −100…−110, −500 (−107 — IP не разрешён). Лимит отчётов 150 TPM.
- **DLR push:** GET на наш URL `?trans_id={trans_id}&status={status}` (URL сообщается вендору).

**Код сейчас:**
- `password` открытым текстом в query (утечка в логи);
- `/smssender` вызывается методом GET (это POST-эндпоинт);
- `externalId = lsim-${Date.now()}` вместо `obj`;
- баланс запрашивается с `password` вместо `key`.

**Что дописать:**
- `key` по формуле, POST JSON; `externalId = obj`; ошибка при `errorCode<0`.
- DLR `trans_id/status` → статус сообщения.
- Секрет в DLR-URL (подписи нет).

**У вендора:** login/password, одобренный sender, whitelisting IP, регистрация DLR-URL.

### 5.2 MSM.az — `msm_az.ts` (stub)

**Публичность:** **З**. [msm.az/ru/heller/api](https://www.msm.az/ru/heller/api): только маркетинг («HTTP и XML API», «DLR в реальном времени»). Контакт: info@msm.az, +994 12 441 55 11.

**Запросить:** HTTP/XML спеку (URL, auth, Unicode, длина), формат и защиту DLR, MO-SMS, коды ошибок, лимиты, тестовый логин, sender.

---

## 6. Мессенджеры

| Провайдер | Факты (ссылка) | Код сейчас | Что дописать |
|---|---|---|---|
| **Telegram user** | `api_id/api_hash` на my.telegram.org, один на номер ([obtaining_api_id](https://core.telegram.org/api/obtaining_api_id/)); MTProto/TDLib ([API](https://core.telegram.org/api/)); действия от имени пользователя только с его ведома, флуд и спам ведут к бану ([ToS](https://core.telegram.org/api/terms)) | p2 stub | `telegram_user.ts` + воркер (GramJS/TDLib): логин по коду, `updateNewMessage` → `message.in`, `messages.sendMessage`; зашифрованная сессия, rate-limit, явное согласие |
| **Apple MfB** | REST + JWT HS256, использование только после одобрения MSP; нужны admin, tech contact, sponsoring executive; Apple выдаёт MSP ID и secret ([REST](https://register.apple.com/resources/messages/msp-rest-api/), [registration](https://register.apple.com/resources/messages/msp-onboarding/mspRegistration), [terms](https://register.apple.com/tou/bca/latest/en)) | p2 stub | только после решения: свой MSP или готовый MSP-партнёр |
| **Авито** | `POST https://api.avito.ru/token` (client_credentials); `POST /messenger/v3/webhook {url}`; `POST /messenger/v1/accounts/{user_id}/chats/{chat_id}/messages`; payload `type="message"`, `value{chat_id, author_id, item_id, content, created}`; ответ 200 ≤ 2 с ([портал](https://developers.avito.ru/api-catalog); детали — [стор.](https://mcp-everything.ru/integrations/avito/methods/post-messenger-v3-webhook)). `x-avito-messenger-signature` не документирован ([стор.](https://qna.habr.com/q/1404944)) | p2 stub | `avito.ts`: token refresh, подписка в `onEnable`, секрет в URL, пропуск эха `author_id==user_id` |
| **Green-API** | `webhookUrlToken` → `Authorization: Bearer <token>` ([webhook](https://green-api.com/en/docs/api/receiving/technology-webhook-endpoint/), [SetSettings](https://green-api.com/en/docs/api/account/SetSettings/)); SendMessage 50 rps, 429 ([limiter](https://green-api.com/en/docs/api/ratelimiter/)) | live | `SetSettings` в `onEnable`; verify строго по заголовку |
| **OK.ru** | `POST https://api.ok.ru/graph/me/subscribe {url}`; `MESSAGE_CREATED`; 200 ≤ 5 с ([Bot API](https://apiok.ru/dev/graph_api/bot_api), [subscribe](https://apiok.ru/dev/graph_api/methods/graph.user/graph.user.subscribe/post)) | verify по `x-ok-signature` | подпись в доках **не описана [НЕПОДТВ.]** → секрет в URL; автоподписка |
| **WeChat OA** | sha1(sort(token,timestamp,nonce)) == signature, эхо `echostr` ([push](https://developers.weixin.qq.com/doc/subscription/guide/dev/push/?lang=en)); custom send: окно 48 ч, ≤ 5 сообщений, иначе 45015 ([send](https://developers.weixin.qq.com/doc/service/api/customer/message/api_sendcustommessage.html?lang=en)) | live | обработка 45015; кеш access_token |
| **LINE** | `x-line-signature` = base64(HMAC-SHA256(secret, rawBody)) ([verify](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)); push ≤ 5 сообщений, 2000 rps ([ref](https://developers.line.biz/en/reference/messaging-api/)) | live | ok |
| **360dialog** | [docs](https://docs.360dialog.com/); совместим с Meta Cloud API (по комментарию в коде) | send live; inbound через `whatsapp_cloud` | проверить применимость verify (X-Hub-Signature) к 360dialog **[НЕПОДТВ.]**; иначе секрет в URL |
| **Wazzup** | `PATCH https://api.wazzup24.com/v3/webhooks` с Bearer crmKey `{webhooksUri, subscriptions:{messagesAndStatuses:true}}`; сразу шлёт `{"test":true}` и ждёт 200 ([webhooks](https://wazzup24.com/help/api-en/webhooks/)) | verify пропускает всё без секрета | обязательный `?k=` в `webhooksUri`; 200 на `{test:true}` |
| **MAX** | `POST https://platform-api2.max.ru/subscriptions`, `Authorization: <token>` (без Bearer), `{url, update_types, secret}`; заголовок `X-Max-Bot-Api-Secret`; ответ ≤ 30 с ([subscriptions](https://dev.max.ru/docs-api/methods/POST/subscriptions/)) | live | ok |

---

## 7. Email (P2-2), Ads/AI и внутренние ключи

### 7.1 Gmail API — `gmail_api.ts`
- `POST /gmail/v1/users/me/watch {topicName, labelIds}` → `{historyId, expiration}`. Продлевать минимум раз в 7 дней, рекомендуется ежедневно ([push](https://developers.google.com/workspace/gmail/api/guides/push), [watch](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/watch)).
- Push через Pub/Sub: `message.data` (base64) = `{emailAddress, historyId}`, дальше `GET /users/me/history?startHistoryId=` ([history.list](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list)).
- Защита push: OIDC-JWT Pub/Sub. Проверять подпись, `aud` и email SA ([Pub/Sub auth](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions)).
- **Код сейчас:** normalize ждёт самодельный `{historyId, messages[]}`. Нет watch, history-синка, refresh, проверки JWT.
- **Дописать:** refresh (K8); `gmail.watch.worker.ts` (ежедневный watch, хранение historyId); verify JWT; history.list → `messages.get` → `message.in` (threadId, Message-ID/In-Reply-To).
- **У Google:** GCP-проект, OAuth consent, Pub/Sub topic с publish для `gmail-api-push@system.gserviceaccount.com` (push-гайд). Для restricted scope `gmail.modify` — верификация приложения (сроки **[НЕПОДТВ.]**).

### 7.2 Microsoft Graph Mail — `ms_graph_mail.ts`
- `POST /v1.0/subscriptions {changeType, notificationUrl, lifecycleNotificationUrl, resource:"/users/{id}/messages", expirationDateTime, clientState}`. Максимум для Outlook messages 10 080 мин, с resource data 1 440 мин ([subscription](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)).
- Валидация: `?validationToken=` → 200 `text/plain` с токеном за ≤ 10 с ([webhooks](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)).
- Каждое уведомление сверять с `clientState`. Lifecycle-события: `subscriptionRemoved`, `missed`, `reauthorizationRequired` → ответ 202 + пересоздание ([lifecycle](https://learn.microsoft.com/en-us/graph/change-notifications-lifecycle-events)).
- **Код сейчас:** только send и normalize самодельного формата.
- **Дописать:** `graph.subscription.worker.ts`; `handleChallenge` для validationToken; verify clientState; `GET /messages/{id}` → `message.in`; delta как фолбэк.
- **У Microsoft:** Entra app, `Mail.ReadWrite`/`Mail.Send`, admin consent.

### 7.3 IMAP/SMTP — `email_imap_smtp.ts` + `email.poller.ts`
- SMTP через nodemailer, IMAP через imapflow, курсор `imapUidCursor`. **Нет учёта UIDVALIDITY** (grep не нашёл): при его смене курсор UID становится невалидным (IMAP4rev2, RFC 9051). Дописать: хранить `{uidValidity, lastUid}`, при смене UIDVALIDITY — полный ресинк с дедупом по Message-ID. Желательно IDLE.

### 7.4 Внутренние ключи (вендор не нужен, спека наша)
- `generic_call_webhook`: манифест говорит `events:["message"]`, `outbound:["sendText"]`, `docsUrl: example.invalid`, normalize не задан. **Привести к схеме `era_externalcall`**: JSON `{kind, callId, direction, from, to, extension, duration, recordingUrl, at}` + HMAC `x-era-signature`; опубликовать в доке ERA.
- `era_externalcall`: ok, нужна публичная страница спеки (сейчас `docs.era.local`).
- `sms_generic`: ok. `bi_export`: формат решаем сами. `llm_assist`: вендор не выбран.

### 7.5 Ads / Analytics / AI
- **Google Ads Lead Form:** POST JSON `{lead_id, google_key, gcl_id, user_column_data:[{column_id, string_value, column_name?}]}`. Проверять `google_key`, дедуп по `lead_id`, 200 = ok, 5xx = retry ([implementation](https://developers.google.com/google-ads/webhook/docs/implementation), [testing](https://developers.google.com/google-ads/webhook/docs/testing)). Маппинг → `lead.captured` (FULL_NAME/EMAIL/PHONE_NUMBER по `column_id`, gclid в атрибуцию).
- **Google Ads Conversions:** `customers/{id}:uploadClickConversions` (developer token, OAuth, `login-customer-id`). Новым интеграциям Google рекомендует **Data Manager API** ([upload-offline](https://developers.google.com/google-ads/api/docs/conversions/upload-offline), [Data Manager](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline/send-events), [блог 2026](https://developers.google.com/ads/blog/posts/2026/05/changes-to-offline-click-conversion)). Писать сразу под Data Manager.
- **Sheets export:** `POST …/values/{range}:append`, 300 write-запросов в минуту на проект, 429 ([append](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append), [limits](https://developers.google.com/workspace/sheets/api/limits)). Нужен батчинг.
- **OpenAI STT:** `POST /v1/audio/transcriptions`, `gpt-4o-transcribe`/`whisper-1`, файл ≤ 25 МБ, flac/mp3/mp4/mpeg/mpga/m4a/ogg/wav/webm ([guide](https://developers.openai.com/api/docs/guides/speech-to-text)). Длинные записи резать; триггер — появление `recordingUrl`.
- **Geocoding:** `GET https://maps.googleapis.com/maps/api/geocode/json?address=…&key=…` ([requests](https://developers.google.com/maps/documentation/geocoding/guides-v3/requests-geocoding), [billing](https://developers.google.com/maps/documentation/geocoding/usage-and-billing)).

---

## 8. Порядок работ для Cursor

1. **K1–K8** (kit): подпути, кастомный ответ, form-парсер, `fetchRecording`, token provider.
2. **Live-баги**, ломающие «включаемые» адаптеры: Zadarma/Novofon (подпись), Mango (форма), Sipuni (event 2/3 + hash), Ростелеком (подпись + `disconnected`), LSIM (`key`), МТС/МегаФон (POST makeCall), Gravitel (свой протокол).
3. **Разблокировать VirtualATS.az** по KB Azerizone.
4. Asterisk bridge: Cdr, OriginateResponse, recording.
5. Email P2-2: Gmail watch, Graph subscriptions, UIDVALIDITY.
6. P2-хвост по спросу: CPaaS, Avito, Telegram user, Ads/Sheets/STT/Geo.
7. Ждут вендора: Collabo.az, MSM.az, Apple MfB, а также подтверждения у МегаФона, Билайна, Novofon, VirtualATS.az, Gravitel, Sipuni.

## 9. Что запросить у вендоров (сводно)

- **Collabo.az:** вся спека API, тестовый аккаунт.
- **MSM.az:** HTTP/XML спека, DLR, MO-SMS, тестовый логин, sender.
- **VirtualATS.az (Azerizone):** publicKey/secretKey, пример подписи GET, тестовый номер.
- **МегаФон:** PDF REST из кабинета, адрес ВАТС, ключ, IP вебхуков, тестовая ВАТС.
- **Билайн:** официальная схема событий подписки (Xsi), токен, тестовый абонент.
- **Novofon:** подтверждение base URL и подписи (совместимость с Zadarma v1), key/secret.
- **Gravitel:** механизм авторизации входящих вебхуков, домен, X-API-KEY.
- **Sipuni:** порядок hash для `callback/call_number` (если не найдётся в KB), номер аккаунта, ключ.
- **Авито:** алгоритм `x-avito-messenger-signature`, client_id/secret.
- **Apple:** решение по MSP, MSP ID / API secret.
- **Ростелеком:** X-Client-ID, ключ подписи, сертификат, доступ к `api-test`.
- **Mango:** код ВАТС, соль, тестовая ВАТС.
- **LSIM:** login/password, sender, IP whitelist, DLR-URL.
- **3CX (у клиента):** лицензия 8SC+ AI, DN API-клиента, ключ.
- **Google/Microsoft:** GCP + Pub/Sub + верификация OAuth; Entra app + admin consent; Google Ads developer token.
- **Остальные:** только ключи и тестовые аккаунты.
