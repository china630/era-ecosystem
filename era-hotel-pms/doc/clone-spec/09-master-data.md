# 9. Справочники и настройки отеля (master data)

## Назначение

Единые правила, без которых невозможны бронь, начисление и отчёт. Настраивает **администратор / IT отеля**, используют все операционные модули.

> Бухгалтерский маппинг на ERP — только коды и отделы; проводки — [01-finance-boundary.md](01-finance-boundary.md).

---

## 9.1 Профиль отеля

| Поле / блок | Зачем | Правила |
|-------------|-------|---------|
| Название, логотип | Документы, UI | Обязательно |
| Вместимость (номеров) | Лицензия, отчёты | 78 для Nafta |
| Валюта по умолчанию | AZN | Все отчёты менеджмента в базовой валюте |
| Координаты / адрес | Карты, booking engine | Опционально фаза 1 |
| Юр.лицо, IBAN, рег. № | Счета гостям | Для печати invoice; синхр. с ERP позже |
| Часовой пояс | Night audit, OTA | Критично для даты «гостиничного дня» |

**Экраны (реф.):** WA0061, WA0075, WA0094.

---

## 9.2 Номерной фонд

### Тип номера (room type)

| Атрибут | Пример Nafta | Влияние |
|---------|--------------|---------|
| Код | STWN, SDBL, DLX | OTA mapping, цены |
| Название RU/AZ/EN | Для персонала и гостя | |
| Вместимость (adults/children/extra bed) | Коэффициент | Тарификация, поиск |
| Базовая квота | Сколько номеров этого типа | Availability |
| Фото галерея | OTA, booking | WA0077 |

### Физический номер (room)

| Атрибут | Правило |
|---------|---------|
| Номер (101, 205…) | Уникален в отеле |
| Тип номера | Обязательная связь |
| Этаж | HK, карта |
| Статус HK | Clean/Dirty/OOO — операционный, не справочник |
| Свойства | Вид, кровать (King/Twin) — фильтр WA0115 |

**Экраны:** WA0062, WA0065, WA0334.

### Блокировка номера (OOO / OOS)

- **Out of Order** — ремонт, не продаётся.  
- **Out of Service** — временно снят с продажи.  
- Журнал: WA0168.

---

## 9.3 Тарифы и питание

### Dynamic Rate Plans (BAR + derived + add-ons)

Ценообразование декомпозировано на три независимых слоя (Mews/Cloudbeds-style):

| Слой | Модели | Правило |
|------|--------|---------|
| **BASE (BAR)** | `RatePlan` (`type=BASE`) + `RoomTypeRate` | Абсолютные цены **только** в календаре `RoomTypeRate(ratePlanId, roomTypeId, date)`. Одна строка = одна ночь × тип номера. |
| **Derived** | `RatePlan` (`type=DERIVED`, `derivedFromId`, `adjustmentMode`, `adjustmentValue`) | Цены **не хранятся** — вычисляются on-the-fly от BAR: `PERCENT` (−10 ⇒ BAR−10%) или `FIXED` (+5 ⇒ BAR+5 AZN). Деривация только от BASE (без цепочек). |
| **Add-ons** | `AddOn` + `RatePlanAddOn` | Питание/SPA — независимые услуги с `pricingUnit` (`PER_GUEST_NIGHT`, …). Привязка к тарифу: `INCLUDED` или `OPTIONAL`. |

**PricingEngine:** `quoteStay()` в `src/lib/services/pricing-engine.service.ts` — BAR → derivation → add-ons. Выход `RateQuote` **строго разделяет** `room.total` (Room Revenue, код `ROOM`) и `addOns[]` (Add-on Revenue, коды `FOOD`, `SPA`, …) для маршрутизации выручки Оркестратором.

### Тип питания (meal plan) — legacy

| Код | Смысл |
|-----|-------|
| BB | Завтрак |
| HB | Полупансион |
| FB | Полный пансион |
| OB | Только номер |

`MealPlan` сохранён для обратной совместимости; целевая модальность — `AddOn` с `revenueCode=FOOD`. Цена доп. питания при апгрейде — справочник WA0063.

### Тариф (rate plan) — атрибуты

| Атрибут | Примеры |
|---------|---------|
| Код | BAR, OOTA-NR, CORP, Medical |
| Тип | BASE / DERIVED |
| Формула (derived) | −10% от BAR, +5 AZN fixed |
| Отмена | До N дней, penalty % (`isRefundable`) |
| Гарантия | Карта / депозит / agency |
| Medical flag | Санаторий: лечебный пакет (legacy + `RatePlanPackageLine`) |
| Included add-ons | BB included на HB-плане |

**Экраны:** WA0064, настройки бронирования WA0083–0084.

> **Deprecated:** `ContractPricingRule` (Stage 24) — agency % discount/supplement заменяется derived rate plans. CRUD остаётся до миграции данных.

### Bed Type / Room View (справочники)

| Модель | Ключ | Файл Elektraweb |
|--------|------|-----------------|
| `BedType` | `code` | Bed Type.xlsx |
| `RoomView` | `code` | Room Views.xlsx |

Универсальный seed: `npm run db:seed:reference`.

### Импорт Elektraweb (.xlsx)

Идемпотентный upsert (`code`, `roomNumber`, `externalRef`). **Единая точка загрузки:** `/admin/import` (phased wizard, platform super-admin). Подробно: [ELEKTRAWEB-IMPORT.md](../ELEKTRAWEB-IMPORT.md).

| Файл | Сущность | Ключ |
|------|----------|------|
| Revenue Code Definitions | `RevenueCode` | `code` |
| Room Types / Rate Codes / Rooms | master | `code` / `roomNumber` |
| Travel Agencies | `Agency` | `code` |
| Product / Stock Cards | `Product` | `code` |
| Guests / Reservations / Folios | transactional | `externalRef` |
| Chart of Accounts | — | не импортируется (finance-core) |

Порядок: справочники → room types → **BAR + bar-rates** → rate plans (DERIVED) → sales contracts → rooms → agencies/products → guests → reservations → folios.

Nafta greenfield (empty DB): полный маппинг и чеклист адаптеров — [nafta/IMPORT-PRICING-MAP.md](../nafta/IMPORT-PRICING-MAP.md).

---

## 9.4 Финансовые справочники (операционные, не GL)

### Код дохода (revenue code)

| Код Nafta | Назначение | НДС-метка (для ERP) |
|-----------|------------|---------------------|
| ROOM | Проживание | 18% |
| FOOD | Питание | 18% |
| MEDICAL | Процедуры, анализы | по политике |
| SPA STORE | Товары SPA | 18% |

**Правило:** каждый charge обязан иметь revenue code.

**Экран:** WA0066.

### Отдел (department)

| Отдел | Примеры начислений |
|-------|-------------------|
| Accommodation | ROOM |
| Restaurant | FOOD |
| Medical | MEDICAL |
| Laundry | Прачечная |

Маппинг «тип выручки → отдел по умолчанию»: WA0086.

### Касса / точка оплаты

- CASH, ON OFIS TERMINAL, PAYRIFF (из quick posting WA0135).  
- Отдельные смены на кассира.

---

## 9.5 Источники и агентства

| Сущность | Поля | Использование |
|----------|------|---------------|
| Источник брони | Walk-in, Phone, Booking.com | Аналитика WA0155 |
| Агентство / компания | Название, договор, city ledger | B2B, agency statement |
| OTA канал | См. [06-channel-crm-med.md](06-channel-crm-med.md) | WA0068 |

---

## 9.6 Пользователи и права

| Элемент | Описание |
|---------|----------|
| Пользователь | Логин, ФИО, роль, отдел, срок действия, IP |
| Группа | Наследование прав |
| Матрица уведомлений | Кто получает какие алерты WA0103 |
| 2FA, политика пароля | WA0341 |

**Роли (минимум Elektraweb):** Admin, Manager, Reception, Night Auditor, HK Supervisor, Doctor, CRM.

**Реализация в сателлите** ([21-satellite-rbac.md](21-satellite-rbac.md)):

| Спека | Код в era-hotel-pms |
|-------|---------------------|
| Admin | `Hotel_Admin` |
| Manager | `Manager` |
| Reception | `Receptionist` |
| Night Auditor | `NightAuditor` |
| HK Supervisor | `Housekeeper` |
| Doctor | `Doctor` |
| CRM | `CRM` |
| — (SSO из ERP) | `Financial_Auditor` |

Квоты активных пользователей: [20-seat-licensing.md](20-seat-licensing.md). Пароли сотрудников отеля **не** в ERP.

**Экраны:** WA0060, WA0336, WA0342–0343.

---

## 9.7 Политики бронирования (настройки)

Свод правил из WA0083–0091 (без TR-специфики):

| Область | Примеры правил |
|---------|----------------|
| Подтверждение брони | Авто / ручное |
| Овербукинг | Разрешён с warning / запрет |
| Обязательные поля гостя | Паспорт, телефон, email |
| Folio | Авто-создание при check-in |
| Invoice | Авто при check-out / по запросу |
| End of day | Асинхронное закрытие, проверка открытых касс WA0088 |
| HK | Период смены белья, минибар WA0090 |
| Курсы валют | Источник: ручной / ЦБ AZ (фаза 2) |

**Не копируем:** полицейская интеграция TR (WA0081 tr_specific).

---

## 9.8 Уведомления

| Канал | События |
|-------|---------|
| Email | Подтверждение брони, счёт |
| SMS | Напоминание заезда (шлюз в настройках WA0082) |
| In-app | Задачи CRM, ошибки night audit |

Журнал отправленных: WA0102. Матрица ролей: WA0103.

---

## 9.9 Связи с другими модулями

```
Справочники → PMS (тариф, тип, номер)
           → Channel (маппинг типов, OTA)
           → Folio (код дохода, отдел, касса)
           → HK (этаж, тип кровати)
           → CRM (отделы для анкет)
           → ERP (коды выручки — экспорт)
```

---

## 9.10 Пользовательские истории (выборка)

| ID | Как | Хочу | Чтобы |
|----|-----|------|-------|
| MD-01 | Админ | завести новый тип номера DLX | продавать на OTA |
| MD-02 | Админ | привязать 10 физ. номеров к DLX | квота считалась верно |
| MD-03 | Revenue | изменить тариф Medical на сезон | корректная цена санатория |
| MD-04 | Админ | добавить код MEDICAL | начисления шли в отчёт врача |

---

## Вне фазы 1 (справочно)

- Loyalty / agency portal (WA0238–0239)  
- Banquet definitions (WA0231)  
- Hotel map координаты (WA0344)  
- Online booking SEO (WA0258–0259) — если нет своего B2C  

## Референс Elektraweb

~47 справочных экранов SETTINGS с `must`/`should` в манифесте (WA0056–0076, WA0080–0096, CRM/channel settings).
