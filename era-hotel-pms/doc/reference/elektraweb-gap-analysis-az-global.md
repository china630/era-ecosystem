# Elektraweb vs мировые PMS: пробелы и приоритеты для Nafta (учёт по стандартам AZ)

> **Контекст:** Nafta уходит с Elektraweb (~5000 EUR/год) на собственный продукт с возможной перепродажей. Весь учёт и compliance должны соответствовать **законодательству и практике Азербайджана (AZ)**, а не Турции.  
> **Дата:** 20 мая 2026  
> **Бенчмарки:** Oracle OPERA Cloud, Cloudbeds, Mews, Protel; нормы AZ: e-qaimə, НДС, NAS, туристический реестр.

### Легенда приоритетов

| Метка | Значение |
|-------|----------|
| 🔴 **Обязательно** | Без этого продукт в AZ юридически/финансово рискован или непродаваем |
| 🟡 **Желательно** | Конкурентное преимущество или ожидание сегмента 3–4★ / сетей |
| 🟢 **Можно отложить** | Nice-to-have; Elektraweb тоже не закрывает / не критично на старте |

---

## 1. Краткий вывод

**Elektraweb** — зрелый **турецко-ориентированный** cloud PMS+ERP с широким функционалом для отеля «под ключ», но **не заточен под AZ compliance** и **уступает лидерам** по открытой экосистеме, AI/revenue tech и enterprise-масштабу.

Для Nafta **критический разрыв** — не «ещё один экран бронирования», а:

1. **Локальный fiscal stack AZ** (e-qaimə, онлайн-KKM, Asan İmza, выгрузка в 1C/NAS).
2. **Государственная отчётность туризма AZ** (Tourism Information System / реестр).
3. **Бухучёт по NAS + план счетов AZ**, а не турецкий e-Defter/e-Arşiv.
4. **Открытый API** для партнёров (ваша модель перепродажи).

Функционал «как у Elektraweb» (PMS, channel, POS, stok) — **база**, но мировые аналоги уже воспринимают это как **минимум 2018–2020**, а не дифференциатор 2026.

---

## 2. Что требует Азербайджан (AZ standards) — эталон для Nafta

| Требование | Суть | Источник / практика |
|------------|------|---------------------|
| **e-qaimə (e-VHF)** | Электронные счета-фактуры для НДС-плательщиков; XML + усиленная ЭП (Asan İmza / e-Signer); портал [e-taxes.gov.az](https://www.taxes.gov.az/en/page/elektron-qaime-faktura) | Обязательно с 2017 для VAT |
| **Онлайн-кассы (B2C)** | Новое поколение ККМ с онлайн-передачей в Налоговую службу, QR для покупателя | С 01.01.2020 для B2C |
| **НДС и отчётность** | Стандартная ставка **18%**; входной НДС по e-qaimə; хранение **5 лет** | Налоговый кодекс AZ |
| **NAS / фин. отчётность** | Национальные стандарты бухучёта (сближение с IFRS); план счетов Минфина (приказ 1995-I-94) | Закон «О бухучёте» |
| **Валюта AZN** | Учёт в манатах; курсовые разницы | Обязательно |
| **Tourism Information System** | Единая цифровая платформа отрасли [data.tourism.gov.az](https://data.tourism.gov.az); реестр субъектов туризма | С 2023 |
| **Звёздная классификация** | Сертификат категории отеля в срок после открытия | Закон о туризме |
| **VAT refund для туристов** | Возврат НДС гостям (до **30%** безнал / **5%** нал) при использовании онлайн-ККМ | Отраслевая практика AZ |

**Вывод:** Nafta-PMS без модуля **«AZ Fiscal & Accounting»** — это не «клон Elektraweb», а продукт с юридическим долгом.

---

## 3. Что есть у Elektraweb вместо AZ (турецкий compliance)

| Модуль Elektraweb | Назначение | Релевантность для AZ |
|-------------------|------------|----------------------|
| e-Fatura / e-Arşiv / e-İrsaliye (Turkcell, Efinans…) | Турецкая электронная отчётность | 🔴 **Не подходит** — нужен e-qaimə |
| KBS / Kimlik bildirimi | Полиция TR | 🟢 **Не нужно** |
| 5651 Hotspot logging | Закон TR | 🟢 **Не нужно** (если нет аналога в AZ) |
| KTM Api | Konaklama Tesisleri Merkezi **Turkey** | 🟢 **Не нужно** |
| Yazarkasa / GMP3 | Турецкая фискализация | 🔴 **Не подходит** — нужны AZ KKM |
| TGA Entegrasyonu | Турецкий туризм | 🟢 **Не нужно** |
| Taxman Fiscal (в прайсе) | Упоминается для других рынков | 🟡 Проверить, есть ли AZ — **скорее нет** |

**Пометка:** переносить эти модули «как есть» в Nafta **не стоит** — только как референс UX, не как код compliance.

---

## 4. Сравнительная матрица: пробелы Elektraweb vs мировые PMS

### 4.1 Compliance, учёт и fiscal (самое важное для AZ)

| Пробел | Elektraweb | OPERA / Cloudbeds / Mews | Обратить внимание? |
|--------|------------|-------------------------|-------------------|
| **Интеграция e-qaimə (AZ)** | Нет (есть TR e-Fatura) | Нет «из коробки» у глобальных; делают через **1C / VAT Portal / кастом** | 🔴 **Да** — ядро AZ-учёта |
| **Онлайн-KKM AZ + QR** | TR yazarkasa | Локальные интеграторы | 🔴 **Да** |
| **Asan İmza / e-Signer** | TR mali mühür | — | 🔴 **Да** |
| **Выгрузка в 1C:Бухгалтерия AZ / NAS** | TR ERP, нет NAS AZ | Часто 1C/локальный ERP | 🔴 **Да** |
| **План счетов AZ (синтетика/аналитика)** | Турецкая muhasebe логика | Enterprise → внешний GL | 🔴 **Да** |
| **Отчёты для налоговой / VAT return** | TR odaklı | Через ERP | 🔴 **Да** |
| **Tourism Registry AZ (data.tourism.gov.az)** | TR KTM/TGA | Нет у глобальных | 🔴 **Да** — если отели обязаны |
| **Мультивалютность + AZN base** | Есть multi-currency | Есть | 🟡 **Да** — проверить курсы ЦБ AZ |
| **Аудит-трейл / неизменяемость fiscal docs** | Базово | Сильнее у enterprise | 🟡 **Да** |
| **PCI DSS / токенизация карт** | Sanal POS (TR acquirers) | Сильнее у Mews/Cloudbeds | 🟡 **Да** — локальные банки AZ |

### 4.2 PMS — операционное ядро

| Пробел | Elektraweb | Мировые лидеры | Обратить внимание? |
|--------|------------|----------------|-------------------|
| **Современный UX / скорость UI** | Функционально богато, UI «классический» | Cloudbeds/Mews — mobile-first | 🟡 **Да** для перепродажи |
| **Open API + webhooks бесплатно** | API **платный** (1 EUR/номер/год, min 120 EUR) | Mews — open ecosystem | 🔴 **Да** для Nafta как платформы |
| **Документация API (OpenAPI, sandbox)** | Закрытая/партнёрская | Mews docs public | 🔴 **Да** |
| **Marketplace интеграций** | Магазин модулей, TR-центричный | 300–500+ каналов/партнёров | 🟡 **Да** |
| **Night Audit (стандарт USALI)** | Есть отчёты, не брендировано | OPERA — эталон | 🟡 **Да** для 4–5★ / международных |
| **Group / Block / Allotment enterprise** | Есть banket/sales | OPERA сильнее | 🟡 Зависит от клиентов Nafta |
| **Housekeeping mobile** | Var (Operator app) | Все имеют | 🟢 База — скопировать логику |
| **Room assignment AI** | Нет нативно | Mews экспериментирует | 🟢 Отложить |
| **Contactless journey** | Online check-in, kiosk, mobile ID | Mews/Cloudbeds сильны | 🟡 **Да** post-COVID ожидание |

### 4.3 Distribution & Revenue

| Пробел | Elektraweb | Мировые | Обратить внимание? |
|--------|------------|---------|-------------------|
| **Channel Manager (40+ OTA)** | **Сильная сторона** Elektraweb | Сопоставимо | 🟢 Не отставать; AZ OTA — отдельно |
| **Booking Engine** | Встроен | Стандарт | 🟢 Обязательный минимум |
| **Dynamic Pricing / RMS** | Базовый модуль | Cloudbeds Signals, Oracle RMS | 🟡 **Да** для upscale |
| **Rate shopping / comp set** | Слабо | Duetto, Atomize, Cloudbeds | 🟢 Отложить (интеграция) |
| **Metasearch (Google Hotel Ads)** | Через каналы | Нативнее у Cloudbeds | 🟡 **Да** для direct revenue |
| **OTA для AZ/CIS** | TR/EU каналы | Нужен mapping локальных | 🟡 **Да** для Nafta рынка |

### 4.4 ERP, F&B, закупки

| Пробел | Elektraweb | Мировые | Обратить внимание? |
|--------|------------|---------|-------------------|
| **POS + рецептуры + себестоимость** | **Сильная сторона** | Часто отдельный POS | 🟢 Закрыть на уровне Elektraweb |
| **Stok / satın alma** | Есть | Есть | 🟢 База |
| **Интеграция POS → folio → e-qaimə** | TR fiscal chain | Нужна **новая** AZ chain | 🔴 **Да** |
| **Инвентарь по NAS счетам** | TR | Через GL mapping | 🔴 **Да** |

### 4.5 CRM, гость, маркетинг

| Пробел | Elektraweb | Мировые | Обратить внимание? |
|--------|------------|---------|-------------------|
| **CRM + loyalty** | Есть | Есть | 🟢 База |
| **CDP / единый профиль гостя** | Средне | Enterprise сильнее | 🟡 Для сетей |
| **WhatsApp / messaging** | Модуль (TR) | Интеграции | 🟡 Популярно в AZ/CIS |
| **Reputation / AI reviews** | Модуль | Cloudbeds и др. | 🟢 Можно v2 |
| **Guest App** | Generic / white-label | Mews Guest Journey | 🟡 **Да** для премиум |

### 4.6 Технология, безопасность, масштаб

| Пробел | Elektraweb | Мировые | Обратить внимание? |
|--------|------------|---------|-------------------|
| **Multi-tenant SaaS architecture** | Есть cloud | Стандарт | 🟢 Обязательно |
| **SOC 2 / ISO 27001 публично** | Не акцент | OPERA/Mews заявляют | 🟡 **Да** для enterprise/gov |
| **99.9% SLA, status page** | Не публично | Стандарт SaaS | 🟡 **Да** для перепродажи |
| **Real-time BI / data warehouse** | Отчёты в системе | Oracle BI, внешние DWH | 🟢 v2 |
| **Offline mode** | Web-only | Ограниченно везде | 🟢 Низкий приоритет |
| **Локализация az / ru / en** | TR + EN marketing | Полная i18n | 🔴 **Да** для AZ рынка |

### 4.7 AI и «2026 expectations»

| Пробел | Elektraweb | Мировые | Обратить внимание? |
|--------|------------|---------|-------------------|
| **AI dynamic pricing** | Базовый модуль | Cloudbeds native | 🟡 v2 |
| **AI guest chat (multilingual)** | Akıllı Sohbet (TR) | Слабо у всех | 🟢 Дифференциатор, не блокер |
| **Predictive housekeeping** | Нет | Эксперименты | 🟢 Отложить |
| **Automated upsell** | Частично (digital menu) | Растёт | 🟡 v2 |

---

## 5. Где Elektraweb **не хуже** или сильнее мировых (не выбрасывать при клонировании)

| Сильная сторона | Комментарий | Обратить внимание? |
|-----------------|-------------|-------------------|
| **All-in-one PMS+ERP+POS** | Один вендор — меньше интеграционного ада | 🟢 Сохранить архитектуру «единый folio» |
| **Channel + Booking в одной лицензии** | Выгодно для mid-market | 🟢 Сохранить |
| **Широта модулей (SPA, timeshare, marina…)** | У Mews/Cloudbeds — через партнёров | 🟡 Только нужные AZ-вертикали |
| **Цена для mid-market** | ~5k EUR/год vs OPERA 60k+ | 🟢 Ваше конкурентное позиционирование |
| **Локальный support TR** | Для AZ нужен **свой** support | 🔴 Построить Nafta support |

---

## 6. Рекомендуемая архитектура Nafta (чтобы закрыть пробелы)

```
┌─────────────────────────────────────────────────────────┐
│  Nafta PMS Core (операции: rez, HK, folio, POS post)    │
└───────────────┬─────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬──────────────┬─────────────┐
    ▼           ▼           ▼              ▼             ▼
 Channel    Booking     Open API      AZ Fiscal      GL Export
 Manager    Engine      (partners)    Hub            (1C/NAS)
                              │          │
                              │    e-qaimə + KKM + Asan İmza
                              │          │
                              ▼          ▼
                         Tourism     VAT Portal /
                         Registry    e-taxes.gov.az
```

**Фаза 0 (блокер):** AZ Fiscal Hub — без этого не запускать commercial.

---

## 7. Сводная таблица «стоит ли обращать внимание»

| # | Пробел | Приоритет для Nafta |
|---|--------|---------------------|
| 1 | e-qaimə + KKM AZ | 🔴 Обязательно |
| 2 | NAS / план счетов / выгрузка в 1C | 🔴 Обязательно |
| 3 | Tourism Registry / гос. отчётность AZ | 🔴 Обязательно (уточнить у клиентов) |
| 4 | Open API + partner program | 🔴 Обязательно (перепродажа) |
| 5 | Локализация az/ru/en | 🔴 Обязательно |
| 6 | Цепочка folio → счёт → fiscal | 🔴 Обязательно |
| 7 | Не копировать TR compliance (KBS, 5651, e-Fatura) | 🔴 Обязательно (избегать) |
| 8 | Современный UX / mobile | 🟡 Желательно |
| 9 | RMS / dynamic pricing v2 | 🟡 Желательно |
| 10 | SOC2, SLA, status page | 🟡 Желательно |
| 11 | Enterprise group/block | 🟡 По сегменту |
| 12 | AI chat / predictive HK | 🟢 Отложить |
| 13 | Marina / golf / timeshare | 🟢 Только если есть спрос в AZ |

---

## 8. Практический следующий шаг

1. **Аудит Nafta:** какие модули Elektraweb реально включены и как сейчас делают e-qaimə (1C? вручную? VAT Portal?).
2. **Интервью с бухгалтером Nafta:** NAS-счета, период закрытия, связка POS–НДС–банк.
3. **Проверка обязательности Tourism Registry** для их категории отелей.
4. **MVP scope:** PMS core + Channel + **AZ Fiscal Hub v1** + Open API — всё остальное parity с Elektraweb поэтапно.

---

## Источники

- [E-invoicing Azerbaijan (State Tax Service)](https://www.taxes.gov.az/en/page/elektron-qaime-faktura)
- [E-Invoicing in Azerbaijan 2025 Overview](https://www.vatupdate.com/2025/05/17/e-invoicing-in-azerbaijan/)
- [VAT Portal Enterprise AZ](https://www.vatportal.az/enterprise.html)
- [Tourism Information System AZ](https://tourism.gov.az/en/news/the-state-tourism-agency-presented-the-tourism-information-system)
- [Elektraweb API pricing](https://www.elektraweb.com/en/api-integrations)
- [Mews Open API](https://docs.mews.com/getting-started/the-mews-apis)
- Внутренний каталог: `doc/elektraweb-modules-catalog.md`
