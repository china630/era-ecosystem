# 00. Видение и границы era-fb-pos

## Продукт

**era-fb-pos** — облачный сателлит **ресторанного контура** (Food & Beverage): приём заказа в зале, кухня, оплата, смена кассира POS, фискализация на месте.

**Целевые объекты:**

- Ресторан при отеле (санаторий Nafta и аналоги)
- Бар / room service outlet (опционально)
- **Вне отеля:** ресторан без номерного фонда (walk-in only) — тот же продукт, без интеграции room-charge

**Не является:**

- PMS (бронь, шахматка, night audit) — **era-hotel-pms**
- Складским ERP и производством — **ERA Finance**
- Медицинской информационной системой — **медконтур в hotel-pms**
- Универсальной кассой продуктового магазина

---

## Принципы

1. **Операции зала — в fb-pos.** Меню, стол, чек, кухня, смена официанта.
2. **Проживание и folio — в hotel-pms.** Баланс номера, check-out, night audit — только там.
3. **«На номер» — через контракт, не дублирование folio.** `POST room-charge` в PMS после закрытия чека с типом «room».
4. **Учёт и рецептуры — в ERP.** Списание ингредиентов по продаже — событие в Finance, не локальный GL.
5. **KKM на месте, e-qaimə в ERP** — как в [17-az-compliance.md](../clone-spec/17-az-compliance.md).
6. **Паритет Elektraweb POS** — по операциям зала; не клонировать турецкий F&B Üretim.

---

## Разделение с era-hotel-pms

| Функция | hotel-pms | era-fb-pos |
|---------|-----------|------------|
| Quick posting WA0135 | ✅ | ❌ |
| Календарь слотов (lite) | ✅ `/pos/calendar` | Опционально полный (бронь → чек) |
| Карта зала, открытые чеки | ❌ | ✅ |
| KDS | ❌ | ✅ |
| POS shift X/Z | ❌ | ✅ |
| Cash shift ресепшена (FIN-05) | ✅ | ❌ (своя смена POS) |
| Room charge на folio | **Принимает** API | **Инициирует** при оплате «на номер» |
| Мед. процедуры в пакете номера | ✅ | ❌ |

---

## Разделение с ERA Finance

| Данные | Владелец |
|--------|----------|
| Коды дохода `FOOD`, `BAR`, … (операционные) | Согласованный мастер; синхрон E5 из PMS или общий каталог Finance |
| GL / NAS маппинг | Finance |
| Product, Recipe, склад | Finance |
| Факт оплаты, KKM receipt id | fb-pos → событие E7; Finance при необходимости |
| Room charge line | fb-pos → PMS folio → E1/E2 цепочка через PMS |

---

## Nafta — рабочие допущения

См. [13-nafta-validation-checklist.md](../clone-spec/13-nafta-validation-checklist.md):

- Ресторан **да** → отдельный сателлит fb-pos.
- SPA-касса **нет** → SPA не в scope v1 fb-pos для Nafta.
- Мед. услуги **в оплате номера** → не дублировать в fb-pos.
- Склад **только ERP** — fb-pos шлёт consumption event, не ведёт остатки.

---

## Пользователи

| Роль | Где работает |
|------|----------------|
| Официант / официант-кассир | fb-pos |
| Повар / бар | KDS (fb-pos) |
| Менеджер ресторана | fb-pos (скидки, void, Z) |
| Хостес | Календарь столов (fb-pos или PMS lite) |
| Ресепшен | hotel-pms (folio); в fb-pos — только просмотр in-house для room charge |
| Ночной аудитор | hotel-pms (блок NA при open POS shift — сигнал из fb-pos) |

---

## Вне scope (явно)

- Dark kitchen / агрегаторы доставки
- Полный F&B production planning (Elektraweb Üretim)
- Интеграция iiko/rKeeper без API заказчика
- DMENU QR-меню гостя (P2-E hotel)
- Отдельный **era-spa-pos** для Nafta
