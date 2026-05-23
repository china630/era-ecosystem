# Спецификация продукта Nafta PMS (функциональная)



> Версия: **0.4** · фаза 1 углублённо + фаза 2 (roadmap)  

> Без технических деталей (API, БД, UI-фреймворк) — кроме [18-erp-integration.md](18-erp-integration.md) (бизнес-контракт событий).



## Назначение



Полное функциональное ТЗ для клона **отельных операций** Elektraweb под Nafta Sanatorium. Финансы GL — во внешнем ERP ([01-finance-boundary.md](01-finance-boundary.md)).



## Карта документов



### Фаза 1 — go-live



| № | Документ | Содержание | Глубина |

|---|----------|------------|---------|

| 0 | [00-vision-and-boundaries.md](00-vision-and-boundaries.md) | Видение, границы | Обзор |

| 1 | [01-finance-boundary.md](01-finance-boundary.md) | ACC ≠ GL | Обзор |

| 2 | [02-roles-and-processes.md](02-roles-and-processes.md) | 8 процессов | Обзор |

| 3 | [03-phase1-modules.md](03-phase1-modules.md) | Модули ф.1 | Карта |

| 4 | [04-pms-core.md](04-pms-core.md) | PMS | **Углублённо** |

| 5 | [05-folio-and-cash.md](05-folio-and-cash.md) | Folio, касса | **Углублённо** |

| 6 | [06-channel-crm-med.md](06-channel-crm-med.md) | OTA, CRM, мед. | **Углублённо** |

| 7 | [07-night-audit-and-reports.md](07-night-audit-and-reports.md) | Night audit | **Углублённо** |

| 8 | [08-erp-handoff.md](08-erp-handoff.md) | События E1–E5 (кратко) | Концепт |

| 9 | [09-master-data.md](09-master-data.md) | Справочники | **Углублённо** |

| 10 | [10-housekeeping.md](10-housekeeping.md) | HK | **Углублённо** |



### Индексы и валидация



| № | Документ | Назначение |

|---|----------|------------|

| 11 | [11-screen-traceability.md](11-screen-traceability.md) | WA → раздел спеки |

| 12 | [12-user-stories-index.md](12-user-stories-index.md) | 28 + ф.2 stories |

| 13 | [13-nafta-validation-checklist.md](13-nafta-validation-checklist.md) | Вопросы к отелю |



### Фаза 2 — после go-live



| № | Документ | Содержание |

|---|----------|------------|

| **14** | **[14-phase2-roadmap.md](14-phase2-roadmap.md)** | **Дорожная карта** |

| 15 | [15-pos-fb-spa.md](15-pos-fb-spa.md) | POS, F&B, SPA-касса |

| 16 | [16-stock-procurement.md](16-stock-procurement.md) | Склад, закупки |

| 17 | [17-az-compliance.md](17-az-compliance.md) | e-qaimə, KKM, tourism AZ |

| 18 | [18-erp-integration.md](18-erp-integration.md) | Контракт E1–E10 |

| 19 | [19-satellite-bridge-event.md](19-satellite-bridge-event.md) | Реализация SATELLITE event в коде |
| 20 | [20-seat-licensing.md](20-seat-licensing.md) | Квоты мест ERA Core ↔ сателлит |
| 21 | [21-satellite-rbac.md](21-satellite-rbac.md) | JWT, роли, SSO (код) |
| 22 | [22-outbound-integration-policy.md](22-outbound-integration-policy.md) | Real-time folio → ERP + настройки отключения |
| 23 | [23-pos-bridge.md](23-pos-bridge.md) | Мост PMS ↔ era-fb-pos (room-charge) |
| — | **[../../era-fb-pos/doc/README.md](../../era-fb-pos/doc/README.md)** | **Спека era-fb-pos** (сателлит) |



## Порядок чтения



**Продукт / разработка ф.1:** 00 → 01 → 03 → 09 → 04 → 10 → 05 → 06 → 07 → 08  



**Аналитик / сопоставление скринов:** 11 + `screens-traceability.csv`  



**Планирование ф.2:** 14 → 18 → 17 → 15 → [fb-pos](../fb-pos/README.md) → 16  



**Встреча с Nafta:** 13



## Команды



```bash

npm run trace:screens   # пересобрать WA → spec

npm run build:docs      # манифест Nafta

```



## Статус



| Блок | Статус |

|------|--------|

| Фаза 1 функции | ✅ v0.2 |

| Трассировка + stories | ✅ v0.3 |

| Фаза 2 спека | ✅ v0.4 (концепт) |

| OpenAPI / wireframes | ⏸ |

| Заполнен чеклист 13 | ⏸ |


