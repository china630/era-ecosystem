<!-- Split from CRM-INTEGRATIONS-AND-GAP-ANALYSIS.md (Part D). Index: ./README.md -->

# ЧАСТЬ D. Телефония: топ-46 АТС, VoIP и облачных телефоний

**Источники списка:**
- раздел «Телефония» в amoМаркет (https://new.amocrm.ru/extensions/): OnlinePBX, МегаФон, Гравител, UIS, Asterisk, Sipuni, Ringostat, Мобилон, Sipnet, Binotel, Mango Office, MCN Telecom, Билайн, Телфин, CoMagic, Плюсофон и др.;
- глобальные лидеры;
- AZ-провайдеры.

**Общая модель событий (`NormalizedEvent`):** `call.ringing` (входящий или исходящий начат), `call.answered`, `call.ended` (длительность, итог), `call.missed`, `call.recording` (URL). Click-to-call — `TelephonyAdapter.originateCall({fromExtension, to})`: АТС сначала звонит сотруднику, после ответа — клиенту.

**Что делает CRM на события:**
- `call.ringing` (входящий): поиск лида по номеру (нормализация E.164; для AZ `+994`), всплывающая карточка звонящего (SSE), создание лида в «Неразобранном», если номер не найден;
- `call.ended` / `call.missed`: запись `Call`, `Activity` в таймлайн; задача «Перезвонить» на пропущенный (после P0-3);
- `call.recording`: скачать в `era-storage`.

**Сопоставление сотрудников:** `UserTelephonyExtension` (внутренний номер ↔ `User`), с автозагрузкой через `listExtensions`, если API это позволяет.

### D1. Адаптер-семейства (минимизация кода)

| Семейство | Механизм | Сколько кода | Провайдеры |
|---|---|---|---|
| **F1 `asterisk` (on-prem)** | AMI (TCP 5038) / ARI (REST + WebSocket) внутри сети клиента; извне недоступно → **`era-pbx-bridge`**: Docker-агент у клиента, слушает AMI/ARI и шлёт HMAC-подписанные нормализованные события на наш webhook; click-to-call через Originate | 1 агент + 1 адаптер | Asterisk, FreePBX, Issabel, MikoPBX, VitalPBX |
| **F2 `freeswitch`** | ESL (Event Socket) через тот же bridge | Модуль в bridge | FreeSWITCH, FusionPBX |
| **F3 `vats_crm_api`** | «REST API ВАТС для CRM»: АТС шлёт в CRM `cmd=event` (INCOMING/ACCEPTED/COMPLETED/CANCELLED), `cmd=history` (итог + ссылка на запись), `cmd=contact` (запрос имени клиента), поле `crm_token`; CRM вызывает `cmd=makeCall` / `history` на URL АТС с API-ключом | 1 базовый класс | МегаФон ВАТС, Гравител, МТС ВАТС (Exolve) |
| **F4 `zadarma_like`** | `NOTIFY_START` / `NOTIFY_INTERNAL` / `NOTIFY_ANSWER` / `NOTIFY_END` / `NOTIFY_OUT_START` / `NOTIFY_OUT_END` / `NOTIFY_RECORD`, подпись HMAC-SHA1 + base64; REST `/v1/request/callback/` | 1 базовый класс | Zadarma, Novofon |
| **F5 `signed_json_sha256`** | JSON + `sha256(id + json + key)` | 1 базовый класс | Mango Office, Ростелеком |
| **F6 `generic_call_webhook`** | Вебхук с маппингом полей + REST для callback, записей, истории | Манифест + маппинг | Sipuni, OnlinePBX, UIS/CoMagic/CallGear, Телфин, Билайн, Яндекс Телефония, Binotel, Ringostat, Мобилон, Sipnet, MCN, Плюсофон, VirtualATS.az, Collabo.az и «своя АТС» |
| **F7 `cpaas`** | Глобальные CPaaS: webhook с подписью + REST originate | По адаптеру на провайдера, общий базовый | Twilio, Vonage, Plivo, Telnyx, Sinch, Infobip, Voximplant, Exolve |
| **F8 `cloud_phone_oauth`** | OAuth 2.0 + подписки на события + REST call/RingOut | По адаптеру на провайдера | RingCentral, Aircall, Dialpad, Zoom Phone, JustCall, CloudTalk, 3CX, Microsoft Teams Phone, Webex Calling |

### D2. Каталог провайдеров

Обозначения: CTC — click-to-call, Rec — доступ к записи.

#### Азербайджан

| # | Ключ | Провайдер | Auth / поля | События | CTC | Rec | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `virtualats_az` | VirtualATS.az (Azerizone) | API-ключ **[U]**; `apiKey`, `domain` | Отправка данных о звонке в CRM, история, статусы внутренних номеров | Да (синхронный и асинхронный вызов, завершение звонка) | Да (скачивание записей) | https://virtualats.az/imkanlar/38-api-ttbiqi-proqramladrma-interfeysi.html | P0 | [C] (возможности с сайта, спецификацию запросить) |
| 2 | `collabo_az` | Collabo.az (облачная АТС, Баку) | **[U]** | Интеграция с CRM заявлена (тариф Medium) | ? | Запись есть | https://collabo.az/en | P1 | [U] |
| 3 | `azercell_vats` | Azercell Virtual ATS | Публичного API не найдено | — | — | — | https://www.azercell.com/en/about-us/press-releases/news/elkmizd-ilk-df-virtual-ats-xidmti-istifady-verdi.html | P2 | [U] → через F6 или SIP-транк + Asterisk |
| — | Bakcell / Nar | API ВАТС не найдено | — | — | — | — | — | — | [U] |

Для AZ реалистичный путь такой: облачная АТС с API (VirtualATS.az, Zadarma, Novofon с AZ-номерами **[U]**) или своя Asterisk/FreePBX с SIP-транком местного оператора плюс `era-pbx-bridge`.

#### СНГ / РФ (из amoМаркет и рынка)

| # | Ключ | Провайдер | Auth / поля | События | CTC | Rec | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|---|
| 4 | `zadarma` | Zadarma (F4) | `userKey`, `secret` (secret); подпись запросов HMAC-SHA1 | `NOTIFY_START`, `NOTIFY_INTERNAL`, `NOTIFY_ANSWER`, `NOTIFY_END` (`duration`, `disposition`, `is_recorded`, `call_id_with_rec`), `NOTIFY_OUT_*`, `NOTIFY_RECORD`; URL задаётся `POST /v1/pbx/webhooks/url/` | `/v1/request/callback/` | `/v1/pbx/record/request/` | https://zadarma.com/en/support/api/ | P0 | [V] |
| 5 | `novofon` | Novofon (F4) | Как у Zadarma | Как у Zadarma | Да | Да | https://api.novofon.com/ , https://novofon.com/instructions/integration/own-crm/ | P0 | [V] |
| 6 | `mango_office` | Mango Office (F5) | `vpbx_api_key`, `vpbx_api_salt` (secret); `sign = sha256(key+json+salt)` | `POST /events/call` (`entry_id`, `call_id`, `call_state`: Appeared / Connected / Disconnected / OnHold, `from`, `to`), `/events/summary`, `/events/recording` | `POST https://app.mango-office.ru/vpbx/commands/callback` | `/queries/recording/post` | https://docs.mango-office.ru/ru/5_api-i-razrabotka/1_api-mango-office/5_opisanie_metodov_api_virtualnoy_ats_mango/1_1_api_realtime/3_1_2_uvedomlenie_o_vyzove.html | P0 | [V] |
| 7 | `megafon_vats` | МегаФон ВАТС (F3) | `crmToken` (наш, АТС его присылает), `apiUrl` (`https://vatsXXXX.megapbx.ru/sys/crm_api.wcgp`), `apiKey` (secret) | `cmd=event` (INCOMING / ACCEPTED / COMPLETED / CANCELLED), `history` (длительность, ссылка на запись), `contact` | `cmd=makeCall` (`phone`, `user`) | Ссылка в `history` | https://www.megapbx.ru/elma365_setup | P1 | [C] |
| 8 | `gravitel` | Гравител (F3) | Как у МегаФон | Как у F3 | Да | Да | https://gravitel.ru/upload/docs/gravitel_rest_api.pdf | P1 | [V] |
| 9 | `mts_vats` | МТС ВАТС / MTS Exolve VPBX (F3) | `crmToken`, `apiUrl`, `apiKey` | `history`, `event`, `contact` | `makeCall` | Да | https://vpbxdocs.exolve.ru/_media/crm_rest_api.pdf | P1 | [V] |
| 10 | `rostelecom_vats` | Ростелеком ВАТС (F5) | `X-Client-ID`, ключ подписи (secret); `X-Client-Sign = sha256hex(id+json+key)` | Интеграционный API: уведомления о вызовах на URL CRM | `call_back` (`request_number`, `from_sipuri`) | Да (по API) | https://rt-static.rt.ru/sites/default/files/b2b/docs/vats-api-rukovodstvo-administratora-domena-v7.5.pdf | P1 | [V] |
| 11 | `beeline_cloudpbx` | Билайн Облачная АТС (F6) | `X-MPBX-API-AUTH-TOKEN` (secret) | Подписка Xsi-Events: `PUT https://cloudpbx.beeline.ru/apis/portal/subscription` (`pattern`, `expires`, `subscriptionType: BASIC_CALL`, `url`); нужен renew до `expires` | `POST .../abonents/{id}/call` **[U]** | `GET .../records` **[U]** | https://cloudpbx.beeline.ru/apidoc (при проверке 500; данные по сообществу: https://github.com/taigasys/beeline-portal-api ) | P1 | [C] |
| 12 | `sipuni` | Sipuni (F6) | `user` (ID), `secret` (secret); подпись запросов md5 по полям **[C]** | Вкл. в «Настройки → API → События на АТС»: `event=1` начало/перевод, `2` завершение (`status`, `call_record_link`), `3` ответ; ответ `{"success":true}` | HTTP API «заказ звонка» | Ссылка в `event=2` | https://doc.sipuni.com/articles/636--api/ , https://doc.sipuni.com/articles/636-640--otpravka-sobytij-http/ | P0 | [V] |
| 13 | `uis` | UIS (F6) | Data API / Call API токен (secret) | Уведомления (HTTP) о начале, ответе, окончании, записи | Call API `start.employee_call` **[C]** | Да | https://www.uiscom.ru/academiya/spravochnyj-centr/dokumentatsiya-api/ | P1 | [V] |
| 14 | `comagic` | CoMagic (та же платформа, что UIS) (F6) | Как у UIS | Как у UIS + коллтрекинг | Да | Да | https://www.comagic.ru/ | P2 | [U] |
| 15 | `onlinepbx` | OnlinePBX (F6) | `domain`, `authKey` (secret) → `POST /{domain}/auth.json` | Вебхуки (form-urlencoded): `call_start`, `call_user_start`, `call_answered`, `call_end`, `call_missed`, `call_transfer_answered` | REST `call/now` **[C]** | Да | https://kb.onlinepbx.ru/vebkhuki-onlinepbx , https://api2.onlinepbx.ru/documentation/static/index.html | P1 | [V] |
| 16 | `telphin` | Телфин (F6) | OAuth2 client_credentials (`clientId`, `clientSecret`) → Bearer, `https://apiproxy.telphin.ru` | Подписка `POST /client/{id}/.../event/` (`event_type`, `url`, `method`) | `POST .../callback/` **[C]** | Да | https://www.telphin.ru/subscribers/documentation-rest-api (при проверке 401, нужна авторизация) | P1 | [C] |
| 17 | `yandex_telephony` | Яндекс Телефония (F6) | API-ключ из «Настройки → API» | Вебхуки входящих и исходящих | Да **[C]** | Да **[C]** | Официальная документация не найдена; источник: https://wirecrm.com/help/integratsiya-yandeks-telefonii | P2 | [U] |
| 18 | `binotel` | Binotel (UA) (F6) | `key`, `secret` (secret) | `apiCallSettings` (во время входящего, можно вернуть данные клиента), `apiCallCompleted` (form-urlencoded) | REST `calls/ext-to-phone` **[C]** | `stats/call-record` — ссылка живёт 15 мин | https://docs.happ.tools/en/docs/integrations/telephony/binotel (сторонний), https://github.com/sashalenz/binotel-api | P2 | [C] |
| 19 | `ringostat` | Ringostat (UA, коллтрекинг) (F6) | `authKey`, `projectId` | Вебхуки входящих и исходящих: до и после звонка, на ответ, переадресация; JSON (`call_id`, `caller`, `status`, `call_duration`, запись) | Да (Callback API) **[C]** | Ссылка в событии | https://help.ringostat.com/en/articles/6313229-how-to-realise-the-ringostat-integration-using-webhooks | P2 | [V] |
| 20 | `mobilon` | Мобилон (F6) | **[U]** | **[U]** | **[U]** | **[U]** | https://mobilon.ru/ | P2 | [U] |
| 21 | `sipnet` | Sipnet (F6) | **[U]** | **[U]** | **[U]** | **[U]** | https://www.sipnet.ru/ | P2 | [U] |
| 22 | `mcn_telecom` | MCN Telecom (F6) | **[U]** | **[U]** | **[U]** | **[U]** | https://www.mcn.ru/ | P2 | [U] |
| 23 | `plusofon` | Плюсофон (F6) | **[U]** | **[U]** | **[U]** | **[U]** | https://plusofon.ru/ | P2 | [U] |
| 24 | `callgear` | CallGear (международная версия UIS/CoMagic) (F6) | **[U]** | **[U]** | **[U]** | **[U]** | https://callgear.com/ | P2 | [U] |

#### On-prem АТС

| # | Ключ | Провайдер | Auth / поля | События | CTC | Rec | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|---|
| 25 | `asterisk` | Asterisk (F1) | В `era-pbx-bridge`: `amiHost`, `amiPort` (5038), `amiUser`, `amiSecret` или `ariUrl`, `ariUser`, `ariPassword`, `recordingsPath`/URL; в CRM: `bridgeSecret` | AMI: `Newchannel`, `DialBegin`, `DialEnd`, `BridgeEnter`, `Hangup`, `Cdr`; ARI: Stasis-события | AMI `Originate` / ARI `POST /channels` | Через bridge (файл MixMonitor → upload) | https://docs.asterisk.org/Configuration/Interfaces/Asterisk-Manager-Interface-AMI/ , https://docs.asterisk.org/Configuration/Interfaces/Asterisk-REST-Interface-ARI/ | P0 | [V] |
| 26 | `freepbx` | FreePBX (Sangoma) (F1) | Как у Asterisk (AMI) | Как у F1 | Да | Да | Через Asterisk AMI | P0 | [V] (через AMI) |
| 27 | `issabel` | Issabel (F1) | Как у Asterisk | — | — | — | Через AMI | P2 | [C] |
| 28 | `mikopbx` | MikoPBX (F1) | AMI / свой REST | — | — | — | https://docs.mikopbx.com/ | P2 | [C] |
| 29 | `vitalpbx` | VitalPBX (F1) | AMI | — | — | — | Через AMI **[U]** | P2 | [U] |
| 30 | `freeswitch` | FreeSWITCH / FusionPBX (F2) | ESL: `host`, `port` 8021, `password` | `CHANNEL_CREATE`, `CHANNEL_ANSWER`, `CHANNEL_HANGUP_COMPLETE` | `originate` | Через bridge | https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Client-and-Developer-Interfaces/Event-Socket-Library/ | P2 | [V] |
| 31 | `3cx` | 3CX (F8) | Call Control API: client credentials (`fqdn`, `clientId`, `clientSecret`) | WebSocket / события Call Control; либо шаблон CRM-интеграции 3CX (contact lookup + call journaling по нашему REST) | `makecall` через Call Control API | Да **[C]** | https://www.3cx.com/docs/call-control-api/ , https://www.3cx.com/docs/crm-integration/ | P1 | [V] |

#### Глобальные CPaaS (F7)

| # | Ключ | Провайдер | Auth / поля | События | CTC | Rec | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|---|
| 32 | `twilio_voice` | Twilio Voice | `accountSid`, `authToken` / API Key | Voice webhooks (TwiML), `statusCallback`: initiated, ringing, answered, completed; `X-Twilio-Signature` | REST `Calls.json` (звонок агенту → `<Dial>` клиенту) | `recordingStatusCallback`, Recordings API | https://www.twilio.com/docs/voice | P1 | [V] |
| 33 | `vonage_voice` | Vonage Voice API | `applicationId` + private key (JWT), signed webhooks | `event_url` (started, ringing, answered, completed), `answer_url` (NCCO) | `POST /v1/calls` | Recording event + download (JWT) | https://developer.vonage.com/en/voice/voice-api/overview | P2 | [V] |
| 34 | `plivo_voice` | Plivo | `authId`, `authToken`; подпись `X-Plivo-Signature-V3` **[U]** | Answer, hangup, ring URLs | `POST /Call/` | Recording API | https://www.plivo.com/docs/voice/ | P2 | [V] |
| 35 | `telnyx_voice` | Telnyx Call Control | API key (Bearer), публичный ключ для ed25519 | `call.initiated`, `call.answered`, `call.hangup`, `call.recording.saved` | `POST /v2/calls` | URL в `call.recording.saved` | https://developers.telnyx.com/docs/voice/programmable-voice/get-started | P2 | [V] |
| 36 | `sinch_voice` | Sinch Voice | App key / secret (signed requests) | ICE, ACE, DiCE callbacks | Callouts API | Да | https://developers.sinch.com/docs/voice/ | P2 | [V] |
| 37 | `infobip_voice` | Infobip Voice | `App apiKey`, `baseUrl` | Webhooks / Calls API events | Calls API | Да | https://www.infobip.com/docs/voice-and-video | P2 | [V] |
| 38 | `voximplant` | Voximplant (СНГ / Global) | `accountId`, API key (JWT service account) | Через VoxEngine-сценарий → HTTP на наш webhook | `StartScenarios` | Да | https://voximplant.com/docs | P2 | [V] |
| 39 | `exolve` | MTS Exolve (CPaaS) | API key | Webhooks событий звонков | Callback API | Да | https://docs.exolve.ru/ | P2 | [V] |

#### Облачные телефонии с OAuth (F8)

| # | Ключ | Провайдер | Auth / поля | События | CTC | Rec | Документация | Ур. | Пров. |
|---|---|---|---|---|---|---|---|---|---|
| 40 | `ringcentral` | RingCentral | OAuth 2.0 (JWT / auth code) | Webhook-подписки: telephony sessions, missed calls | RingOut `POST /restapi/v1.0/account/~/extension/~/ring-out` | Call Log + recording content | https://developers.ringcentral.com/guide/voice | P2 | [V] |
| 41 | `aircall` | Aircall | OAuth / Basic (`apiId`, `apiToken`) | Webhooks `call.created`, `call.answered`, `call.ended`, `call.hungup`, `call.voicemail_left` (+ token) | `POST /v1/users/:id/calls` (dial в приложении Aircall) | `recording` в объекте call (временный URL) | https://developer.aircall.io/api-references/ | P2 | [V] (лимит 120 req/min — по сторонним данным [C]) |
| 42 | `dialpad` | Dialpad | API key / OAuth | Call event subscriptions (webhooks, JWT) | `POST /api/v2/call` | Да | https://developers.dialpad.com/ | P2 | [V] |
| 43 | `zoom_phone` | Zoom Phone | OAuth (Server-to-Server) | Webhooks `phone.callee_*`, `phone.caller_*`, `phone.recording_completed` | Через Zoom Phone Smart Embed **[U]** | Recordings API | https://developers.zoom.us/docs/api/phone/ | P2 | [V] |
| 44 | `justcall` | JustCall | `apiKey`, `apiSecret` | Webhooks call completed, missed | Да | Да | https://developer.justcall.io/ | P2 | [V] |
| 45 | `cloudtalk` | CloudTalk | API key (Basic) | Webhooks через workflow automation | Да | Да | https://developers.cloudtalk.io/ | P2 | [C] |
| 46 | `ms_teams_phone` | Microsoft Teams Phone | Graph OAuth (`CallRecords.Read.All`) | Подписки на `callRecords` (пост-фактум) | Нет (только через Teams-клиент) | Нет / ограниченно | https://learn.microsoft.com/en-us/graph/api/resources/callrecords-api-overview | P2 | [V] |

**Про «Bitrix24-совместимость».** Многие АТС дают готовый коннектор к Bitrix24 через REST `telephony.externalcall.*` (https://apidocs.bitrix24.com/api-reference/telephony/). Этот протокол работает в направлении «АТС → Bitrix24» и для нашей CRM не подходит. Переиспользовать можно только идею: сделать свой «публичный телефонный API ERA» с похожей семантикой (`externalcall.register`, `finish`, `attachRecord`), чтобы АТС-вендоры могли сами интегрироваться с ERA. Задача T-I14 (P2).

**Webex Calling:** официальная ссылка, использованная при проверке, вернула 404. В каталог не включён, **[U]**.

### D3. Итог по телефонии

| Группа | Кол-во | P0 | P1 | P2 |
|---|---|---|---|---|
| Азербайджан | 3 | 1 | 1 | 1 |
| СНГ / РФ облачные | 21 | 4 | 8 | 9 |
| On-prem (Asterisk, FreeSWITCH, 3CX) | 7 | 2 | 1 | 4 |
| Глобальные CPaaS | 8 | 0 | 1 | 7 |
| Облачные телефонии с OAuth | 7 | 0 | 0 | 7 |
| **Всего** | **46** | **7** | **11** | **28** |

**Первая волна (P0):** Asterisk/FreePBX через `era-pbx-bridge`, Zadarma, Novofon, Mango Office, Sipuni, VirtualATS.az плюс `generic_call_webhook`. Она покрывает семейства F1, F4, F5, F6, и дальше большинство провайдеров добавляются манифестом.

---
