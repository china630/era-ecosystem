# 10. Housekeeping (служба уборки номеров)

## 10.0 Обзор

| Показатель | Значение |
|------------|----------|
| Экранов | 10 HK + lost&found WA0197 |
| Роли | Горничная, супервайзер HK, ресепшен (read) |
| Связь с PMS | Статус номера блокирует assign; check-out → dirty |

---

## 10.1 Статусы номера (HK)

| Статус | Код | Sellable | Assignable |
|--------|-----|----------|------------|
| Clean | CL | Да* | Да |
| Dirty | DI | Да* | Нет |
| Inspected | IS | Да | Да |
| Out of Order | OO | Нет | Нет |
| Out of Service | OS | Нет | Нет |
| Occupied | OC | — | In-house |

\* Clean/Dirty для **свободного** номера; occupied overlay от PMS.

### Переходы

```
Check-out → Dirty
Dirty → Clean (горничная)
Clean → Inspected (супервайзер)
Any → OOO (ремонт WA0168)
OOO → Clean (ремонт завершён)
```

**Экран смены статуса:** WA0186 (dialog).

---

## 10.2 Панель управления HK

**Экраны:** WA0154, WA0189, WA0200.

### Виджеты

| Виджет | Данные |
|--------|--------|
| Dirty count | Номера к уборке |
| Clean / Inspected | Готовы к заезду |
| Occupied | In-house |
| Expected departures | Выезды сегодня → будут dirty |
| Expected arrivals | Нужны inspected rooms |
| Repeat guest rooms | Приоритет (опционально) |

**Обновление:** real-time или refresh 1–5 min.

---

## 10.3 Управление горничными

**Экран:** WA0152, WA0187.

| Функция | Описание |
|---------|----------|
| Список горничных | Смена дня |
| Назначение номеров | Drag room → housekeeper |
| Лист заданий | Печать WA0205 |
| Прогресс | 12/20 done |

**Правила:**

- Один номер — одна горничная в день (обычно).  
- Приоритет: departure dirty first, then arrival prep.

---

## 10.4 СУН операции в номерах

**Экран:** WA0191.

Журнал фактов уборки:

| Поле | Пример |
|------|--------|
| Room | 305 |
| Housekeeper | Ayşə |
| Start / end time | |
| Status set | Dirty → Clean |
| Minibar check | OK / charges |

---

## 10.5 СУН контроль и состояние

**Экран:** WA0167.

Расширенный контроль:

| Вкладка | Содержание |
|---------|------------|
| Morning / Evening | Сверка с ресепшен |
| Discrepancy | Система occupied vs HK clean |
| Legionella / compliance | Санаторий/регуляторика (если ведётся) |

**Действие при расхождении:** задача ресепшену или супервайзеру.

---

## 10.6 Закрытые номера (OOO/OOS)

**Экран:** WA0168.

| Поле | Описание |
|------|----------|
| Room | |
| Причина | Ремонт, протечка |
| Даты from–to | Не sellable |
| Комментарий | |

**Влияние:** availability −1; Room Plan серый.

---

## 10.7 Lost & Found

**Экран:** WA0197 (под меню касса в Elektraweb — у нас HK или reception).

| Статус | Описание |
|--------|----------|
| Lost | Гость сообщил |
| Found | Найдено |
| Delivered | Возвращено |

| Поле | Значение |
|------|----------|
| Room / date | |
| Описание вещи | |
| Хранение | Сейф стойки |

---

## 10.8 Настройки HK (из master data)

**Экран:** WA0090.

| Политика | Пример |
|----------|--------|
| Смена белья | Каждые N ночей |
| Minibar check | При каждой уборке |
| Inspected required | Да — без IS нельзя assign |

---

## 10.9 Интеграция с PMS

| Событие PMS | Реакция HK |
|-------------|------------|
| Check-out | Room → Dirty |
| Check-in на dirty | Warning/block |
| Room move | Old dirty, new needs status |
| Night audit | Report uninspected for tomorrow arrivals |

---

## 10.10 Пользовательские истории

| ID | История |
|----|---------|
| HK-01 | Супервайзер видит 15 dirty после выездов, распределяет горничных |
| HK-02 | Горничная отмечает 401 clean с телефона (фаза 2 mobile) |
| HK-03 | Ресепшен видит только inspected для assign arrival |
| HK-04 | Закрыть 512 на OOO на 3 дня (ремонт) |

---

## Референс

WA0152, WA0154, WA0167–0168, WA0186–0191, WA0200, WA0205, WA0197, WA0090.
