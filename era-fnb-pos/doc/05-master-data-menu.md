# 05. Справочники и меню

## 5.1 Источник данных

| Подход | Nafta | Комментарий |
|--------|-------|-------------|
| **Мастер в fb-pos** | Да v1 | PLU, цены, категории |
| Синхрон из ERP | Фаза 2 | Import products/recipes |
| Синхрон из hotel-pms | Нет | Только revenue codes согласованы |

Revenue codes `FOOD`, `BAR` — те же коды, что в PMS master ([09-master-data.md](../clone-spec/09-master-data.md)), маппинг GL в Finance.

---

## 5.2 Настройки outlet (WA0098)

| Группа | Параметры |
|--------|-----------|
| Чек | Логотип, валюта USD/EUR на печати, подпись, строка налога |
| POS | Лимит брони, % комиссии эквайринга, контроль открытых столов при Z |
| X-report | Автоперенос наличных, формат |
| Printer | Маршруты: кухня, бар, пречек |

---

## 5.3 Меню

### Admin UI (fb-pos)

| Экран | Функции |
|-------|---------|
| Categories | CRUD, sort order |
| Items | price, station, tax, recipeSku, barcode |
| Modifiers | groups, min/max select |
| Combos | Фаза 2 |
| Happy hour | Фаза 2 — price rules by time |

### Публикация меню

| Версия | Описание |
|--------|----------|
| Draft | Редактирование |
| Published | Видно официантам |
| Scheduled | Смена с даты |

---

## 5.4 Маппинг WA0282 (SPA/Med)

Для **ресторана** fb-pos использует коды **FOOD**, **BAR**, **MINIBAR** — не WA0282 med/spa store.

WA0282 в fb-pos — только если включён outlet SPA retail (не Nafta v1).

---

## 5.5 Пользователи и outlet access

| User | outlets[] |
|------|-----------|
| Waiter Anna | RESTAURANT |
| Bar lead | BAR, POOL_BAR |
| Manager | all |

Seat licensing — по аналогии [20-seat-licensing.md](../clone-spec/20-seat-licensing.md): квота через ERA Core (при выносе в repo).
