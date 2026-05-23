# 11. Трассировка экранов WA → спецификация

> Автогенерация: `npm run trace:screens`  
> Полная таблица (292 строки): [../nafta/screens-traceability.csv](../nafta/screens-traceability.csv)

## Назначение

Связь каждого скриншота Elektraweb (WA0056–WA0347) с разделом функциональной спецификации v0.2. Используйте для:

- проверки покрытия ТЗ;
- приоритизации разработки UI;
- ответа «где в спеке этот экран?».

## Сводка

| Показатель | Значение |
|------------|----------|
| Всего экранов | 292 |
| Рабочих (не empty) | 190 |
| Фаза 1 (рабочие) | 161 |
| Вне фазы 1 / ERP (рабочие) | 22 |
| Пустых (menu-only) | 102 |

### По документу спеки

| spec_doc | Экранов |
|----------|---------|
| 06-channel-crm-med | 50 |
| 04-pms-core | 40 |
| 09-master-data | 37 |
| 05-folio-and-cash | 19 |
| 10-housekeeping | 10 |
| 16-stock-procurement | 9 |
| 18-erp-integration | 8 |
| 03-phase1-modules | 4 |
| 07-night-audit-and-reports | 4 |
| 01-finance-boundary | 4 |
| 15-pos-fb-spa | 2 |

### По фазе

| phase | Экранов |
|-------|---------|
| 1 | 161 |
| — | 102 |
| 2 | 22 |
| meta | 7 |

## Как читать CSV

| Колонка | Смысл |
|---------|--------|
| `wa_num` | Номер WA (0056 = WA0056) |
| `spec_doc` | Файл в `clone-spec/` без расширения |
| `spec_section` | Раздел внутри документа (или `menu-only`, `out-of-scope`) |
| `phase` | `1` фаза 1 · `2` позже · `ERP` только внешний учёт · `meta` лицензия |
| `trace_source` | `spec+rules` если WA упомянут в углублённой спеке |

## Примеры быстрого поиска

| Вопрос | Где смотреть |
|--------|--------------|
| Room Plan | `04-pms-core` · WA0209 |
| Night audit wizard | `07-night-audit-and-reports` · WA0131 |
| Коды дохода | `09-master-data` §9.4 · WA0066 |
| OTA extranet | `06-channel-crm-med` §A · WA0127 |
| Folio | `05-folio-and-cash` · WA0136 |

## Требуют ручной проверки

_Нет — все рабочие экраны размечены правилами._



## Связанные документы

- [12-user-stories-index.md](12-user-stories-index.md) — реестр user stories  
- [13-nafta-validation-checklist.md](13-nafta-validation-checklist.md) — вопросы к отелю
