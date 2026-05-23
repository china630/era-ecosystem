# Оптимизация лицензии Elektraweb — Nafta Sanatorium

> Сгенерировано: 2026-05-22  
> Отель: 78 номеров, Standart, факт ~5000 EUR/год, прайс API ~5860 EUR/год

## Активные модули в лицензии

PMS, ChannelManager&BookingEngine, POS, STOCK, F&B, ACC, Procurement, FixedAsset, SPA, DMENU, DoorLockIntegration

## Использование по манифесту (292 скрина)

| license_module | Рабочих экранов | Пустых | Вывод |
|----------------|-----------------|--------|-------|
| PMS | 98 | 50 | |
| SETTINGS | 47 | 9 | |
| ACC | 21 | 33 | |
| STOCK | 9 | 7 | |
| ChannelManager | 8 | 2 | |
| DMENU | 2 | 1 | |
| FixedAsset | 2 | 0 | |
| OTHER | 2 | 0 | |
| POS | 1 | 0 | |

## Рекомендации по отключению

### Смело отключить (~620 EUR/год)

| Модуль | EUR/год | Обоснование |
|--------|---------|-------------|
| **DMENU** | ~37 | Нет экранов цифрового меню |
| **Procurement** | ~214 | Нет заявок/PO; только настройки WA0321 |
| **DoorLockIntegration** | ~214 | Нет UI замков (если замки не используются) |
| **FixedAsset** | ~154 | Только импорт справочников ОС |

### Обсудить с Nafta (~780 EUR/год дополнительно)

| Модуль | EUR/год | Вопрос отелю |
|--------|---------|--------------|
| **SPA** | ~475 | Отдельная SPA-касса или только CRM + календарь WA0146? |
| **F&B** | ~307 | Себестоимость блюд в системе или только склад? |

### Не отключать

**PMS**, **Channel**, **ACC**, **CASH/Folio**, **CRM/MED**, **HK**, **POS** (минимум WA0098, WA0146, quick posting), **STOCK** (справочники; операционка не снята).

## Сценарии экономии

См. [license-scenarios.csv](license-scenarios.csv) и [license-pricing.csv](license-pricing.csv).

| Сценарий | EUR/год (API) |
|----------|---------------|
| Текущий набор | 5860 |
| Без DMENU + Procurement + Fixed + DoorLock | ~5240 |
| + без SPA + F&B | ~4460 |
| Только PMS + Channel | ~3180 |

## Файлы

- [screens-manifest.csv](screens-manifest.csv) — реестр 292 экранов
- [business-processes.md](business-processes.md) — E2E сценарии
- [supplement-pos-spa.md](supplement-pos-spa.md) — пробелы POS/SPA
- [supplement-stock-procurement.md](supplement-stock-procurement.md) — пробелы ERP
