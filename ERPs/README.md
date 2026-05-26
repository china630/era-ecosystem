# Industry ERP research — reference index

Decomposition of industry ERP modules (research input). **Not** implementation specs — mapped to ERA in [MODULES_CATALOG.md](../docs/MODULES_CATALOG.md#industry-module-roadmap) and each app `PRD.md` §4.

Versioning: [PRODUCT_VERSIONING.md](../docs/PRODUCT_VERSIONING.md).

## Files → ERA apps

| File | ERA app | In v1.0 | Planned |
|------|---------|---------|---------|
| [01 Отельный ERP.md](./01%20Отельный%20ERP.md) | era-hotel-pms | M20–M23 | — |
| [02 СТО ERP.md](./02%20СТО%20ERP.md) | era-auto-sto | M6, M8–M10 | M5 ext, M7, M11 (v1.1) |
| [03 Ритейл ERP.md](./03%20Ритейл%20ERP.md) | era-retail-pos | M7, M11–M13 | M14–M16 (v1.1); M8–M10 (v2.0) |
| [04 Ресторанный ERP.md](./04%20Ресторанный%20ERP.md) | era-fb-pos | Core + M11–M13 | M14 (v1.1) |
| [05 Строительная ERP.md](./05%20Строительная%20ERP.md) | era-construction | M6, M7, M9 | M8, M10–M12 (v1.1) |
| [06 Логистическая ERP.md](./06%20Логистическая%20ERP.md) | era-logistics | M3, M4, M7–M9, M13 | M10–M12 (v1.1) |
| [07 Медицинская ERP.md](./07%20Медицинская%20ERP.md) | era-clinic | M5–M6, M9, M14 | M10–M13 (v1.1) |

**CRM field** (no research file): Kommo/Respond patterns → `era-crm-field` M8–M10.

## Owner legend

| Owner | Meaning |
|-------|---------|
| **SATELLITE** | `era-*` operational UX + events |
| **FINANCE** | era-finance-core |
| **PLATFORM** | orchestrator add-ons — [PLATFORM_ADDONS.md](../docs/PLATFORM_ADDONS.md) |
| **PLANNED** | Target version in MODULES_CATALOG (v1.1 / v2.0) |

**Retail-only IDs:** **M11** = promotions at checkout · **M12** = customer at POS (`era-retail-pos` only).
