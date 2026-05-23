# 12. Реестр пользовательских историй (фаза 1)

> Свод из углублённых спецификаций v0.2 + сквозные процессы [02-roles-and-processes.md](02-roles-and-processes.md)  
> Трассировка экранов: [11-screen-traceability.md](11-screen-traceability.md)

## Как пользоваться

| Колонка | Смысл |
|---------|--------|
| **ID** | Уникальный код для backlog / тест-кейсов |
| **Процесс** | P1–P8 из док. 02 |
| **Приоритет** | must = критично для go-live · should = важно · later = фаза 2 |

---

## Сводная таблица

| ID | Модуль | История (кратко) | Процесс | Документ | Приоритет |
|----|--------|------------------|---------|----------|-----------|
| MD-01 | Справочники | Админ заводит тип номера DLX для OTA | P1 | [09](09-master-data.md) §9.2 | must |
| MD-02 | Справочники | Привязать 10 физ. номеров к DLX | P1 | [09](09-master-data.md) §9.2 | must |
| MD-03 | Справочники | Revenue меняет тариф Medical на сезон | P1 | [09](09-master-data.md) §9.3 | must |
| MD-04 | Справочники | Код дохода MEDICAL для отчёта врача | P1, P3 | [09](09-master-data.md) §9.4 | must |
| PMS-01 | PMS | Бронь 7 ночей HB (санаторий) | P1 | [04](04-pms-core.md) §4.4 | must |
| PMS-02 | PMS | Нераспределённые заезды сегодня → номера до 14:00 | P2 | [04](04-pms-core.md) §4.6 | must |
| PMS-03 | PMS | Check-in с паспортом, открыть folio | P2 | [04](04-pms-core.md) §4.6 | must |
| PMS-04 | PMS | Room Plan: продлить на 2 ночи drag | P1, P3 | [04](04-pms-core.md) §4.5 | must |
| PMS-05 | PMS | Check-out при нулевом балансе | P5 | [04](04-pms-core.md) §4.6 | must |
| PMS-06 | PMS | Occupancy 30 дней для цен OTA | P1 | [04](04-pms-core.md) §4.3 | should |
| PMS-07 | PMS | No-show список для night audit | P6 | [04](04-pms-core.md) · [07](07-night-audit-and-reports.md) | must |
| CH-01 | Channel | Закрыть продажи 1 января (quota=0) | P1 | [06](06-channel-crm-med.md) §A.4 | should |
| CH-02 | Channel | Исправить ошибку mapping по журналу | P1 | [06](06-channel-crm-med.md) §A.4 | must |
| CH-03 | Channel | OTA cancel → PMS cancelled | P1 | [06](06-channel-crm-med.md) §A.5 | must |
| FIN-01 | Folio/Cash | Наличные 200 AZN на folio + чек | P4 | [05](05-folio-and-cash.md) §5.4 | must |
| FIN-02 | Folio/Cash | Routing: ROOM компания, бар гость | P3, P4 | [05](05-folio-and-cash.md) §5.1 | must |
| FIN-03 | Folio/Cash | Зачесть депозит 500 при check-out | P4, P5 | [05](05-folio-and-cash.md) §5.6 | must |
| FIN-04 | Folio/Cash | Счёт компании за месяц (city ledger) | P4 | [05](05-folio-and-cash.md) §5.9 | should |
| FIN-05 | Folio/Cash | Night audit блок при открытой смене | P6 | [05](05-folio-and-cash.md) §5.5 | must |
| HK-01 | HK | 15 dirty после выездов → задания | P3 | [10](10-housekeeping.md) §10.3 | must |
| HK-02 | HK | Горничная: 401 clean с телефона | P3 | [10](10-housekeeping.md) | later |
| HK-03 | HK | Assign только на inspected | P2 | [10](10-housekeeping.md) §10.1 | must |
| HK-04 | HK | 512 OOO на 3 дня (ремонт) | P3 | [10](10-housekeeping.md) §10.1 | must |
| MED-01 | Санаторий | T=38° → alert врачу | P2, P3 | [06](06-channel-crm-med.md) §C | must |
| MED-02 | Санаторий | Врач назначает панель анализов | P3 | [06](06-channel-crm-med.md) §C | must |
| MED-03 | Санаторий | Лаборатория: результат High | P3 | [06](06-channel-crm-med.md) §C | must |
| MED-04 | Санаторий | Магнитотерапия на folio | P3, P4 | [06](06-channel-crm-med.md) §C | must |
| NA-01 | Night audit | Wizard 00:30, 180 room charges | P6 | [07](07-night-audit-and-reports.md) §A.3 | must |
| NA-02 | Night audit | Блок при открытой кассе | P6 | [07](07-night-audit-and-reports.md) §A.3 | must |
| NA-03 | Night audit | Архив вчерашнего дня утром | P7 | [07](07-night-audit-and-reports.md) §A.5 | should |

---

## Истории по модулям (детально)

### Master data (MD)

| ID | Роль | История |
|----|------|---------|
| MD-01 | Админ | Завести тип номера DLX, чтобы продавать на OTA |
| MD-02 | Админ | Привязать 10 номеров к DLX, чтобы квота считалась верно |
| MD-03 | Revenue | Изменить тариф Medical на сезон |
| MD-04 | Админ | Добавить код MEDICAL для начислений и ERP-маппинга |

### PMS (PMS)

| ID | Роль | История |
|----|------|---------|
| PMS-01 | Ресепшен | Создать бронь 7 ночей HB |
| PMS-02 | Ресепшен | Видеть нераспределённые заезды и назначить номера |
| PMS-03 | Ресепшен | Check-in с документом, открыть folio |
| PMS-04 | Менеджер | Продлить бронь на Room Plan |
| PMS-05 | Ресепшен | Check-out при нулевом балансе |
| PMS-06 | Revenue | Occupancy 30 дней для решения по OTA |
| PMS-07 | Night audit | No-show список перед закрытием дня |

### Channel (CH)

| ID | Роль | История |
|----|------|---------|
| CH-01 | Revenue | Закрыть все каналы на дату (quota 0) |
| CH-02 | Менеджер | Увидеть ошибку sync и исправить mapping |
| CH-03 | Система | OTA cancellation → статус cancelled в PMS |

### Folio & Cash (FIN)

| ID | Роль | История |
|----|------|---------|
| FIN-01 | Кассир | Принять наличные на folio, чек |
| FIN-02 | Ресепшен | Split folio: компания / гость |
| FIN-03 | Кассир | Зачесть депозит при выезде |
| FIN-04 | Бух. операции | Выписка по агентству (city ledger) |
| FIN-05 | Night audit | Не закрыть день при открытой смене |

### Housekeeping (HK)

| ID | Роль | История |
|----|------|---------|
| HK-01 | Супервайзер | Распределить dirty после выездов |
| HK-02 | Горничная | Отметить clean (mobile, фаза 2) |
| HK-03 | Ресепшен | Назначать номер только inspected |
| HK-04 | Супервайзер | OOO на период ремонта |

### Medical / санаторий (MED)

| ID | Роль | История |
|----|------|---------|
| MED-01 | Медсестра | Температура 38° → alert |
| MED-02 | Врач | Назначить панель анализов |
| MED-03 | Лаборатория | Внести результат с флагом |
| MED-04 | Ресепшен | Начислить процедуру на folio |

### Night audit & reports (NA)

| ID | Роль | История |
|----|------|---------|
| NA-01 | Night auditor | Запустить wizard, room charges |
| NA-02 | Night auditor | Блок при открытой кассе |
| NA-03 | Менеджер | Архив закрытого дня |

---

## CRM — истории для дополнения (backlog)

В углублённой спеке CRM описан экранами, отдельные ID не выделены. Рекомендуемые **CRM-01…05** для согласования с Nafta:

| ID (draft) | История | Экраны (реф.) |
|------------|---------|---------------|
| CRM-01 | Ресепшен открывает профиль гостя с историей stays | WA0243 |
| CRM-02 | Менеджер создаёт задачу «замена полотенец» на 305 | WA0133, WA0233 |
| CRM-03 | Закрыть жалобу гостя с шаблоном ответа | WA0138, WA0232 |
| CRM-04 | Заполнить анкету качества после выезда | WA0223 |
| CRM-05 | Отчёт VIP заезды на сегодня | WA0137 |

---

## ERP handoff — концепт (не user stories UI)

События из [08-erp-handoff.md](08-erp-handoff.md) — acceptance для интеграции, не экраны PMS:

| Событие | Триггер | Критерий приёмки |
|---------|---------|------------------|
| E1 | Успешный night audit | ERP получает агрегаты выручки/платежей за день |
| E2 | Invoice «выставлен» | ERP получает строки счёта с кодами дохода |
| E3 | Платёж на folio | ERP получает сумму, способ, привязку |
| E4 | Запрос city ledger | Остаток/оборот по агентству |
| E5 | Изменение справочника | Синхрон кодов PMS ↔ ERP |

---

## Матрица: процесс → истории

| Процесс | Название | Истории |
|---------|----------|---------|
| P1 | Продажа и бронирование | MD-01–03, PMS-01, PMS-06, CH-01–03 |
| P2 | Заезд | PMS-02–03, HK-03, MED-01 |
| P3 | Проживание и услуги | FIN-02, MED-02–04, HK-01, HK-04 |
| P4 | Оплата | FIN-01–03, FIN-04 |
| P5 | Выезд | PMS-05, FIN-03 |
| P6 | Night audit | PMS-07, FIN-05, NA-01–02 |
| P7 | Утро / отчёты | NA-03 |
| P8 | ERP (концепт) | E1–E5 |

---

## Статистика

| Метрика | Значение |
|---------|----------|
| Историй с ID (фаза 1) | **28** |
| Draft CRM | 5 |
| События ERP | 5 |

---

## Фаза 2 (дополнение)

См. [14-phase2-roadmap.md](14-phase2-roadmap.md).

| ID | Модуль | История | Документ |
|----|--------|---------|----------|
| POS-01…03 | POS | Бронь стола / SPA-слот | [15](15-pos-fb-spa.md) |
| STK-01…05 | Склад | Приход, списание, PR | [16](16-stock-procurement.md) |
| AZ-01…02 | Compliance | Tourism registry | [17](17-az-compliance.md) |
| ERP-01…04 | Интеграция | E1 доставка, fiscal status | [18](18-erp-integration.md) |

---

## Связанные документы

- [13-nafta-validation-checklist.md](13-nafta-validation-checklist.md) — валидация с отелем  
- [14-phase2-roadmap.md](14-phase2-roadmap.md) — дорожная карта ф.2
