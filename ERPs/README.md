# Gemini ERP research — reference index

Decomposition of industry ERP modules (research input). **Not** implementation specs — mapped to ERA in [MODULES_CATALOG.md](../docs/MODULES_CATALOG.md#industry-enrichment-backlog-gemini-erp--era) and each app `PRD.md` §4.

## Files → ERA apps

| File | ERA app | W1 code | W2 doc |
|------|---------|---------|--------|
| [01 Отельный ERP.md](./01%20Отельный%20ERP.md) | era-hotel-pms | — | M20–M23 |
| [02 СТО ERP.md](./02%20СТО%20ERP.md) | era-auto-sto | — | M5–M12 |
| [03 Ритейл ERP.md](./03%20Ритейл%20ERP.md) | era-retail-pos | M11–M12, M7 | M13–M16 |
| [04 Ресторанный ERP.md](./04%20Ресторанный%20ERP.md) | era-fb-pos | FB-1 core | M11–M14 |
| [05 Строительная ERP.md](./05%20Строительная%20ERP.md) | era-construction | C1–C2 | M6–M12 |
| [06 Логистическая ERP.md](./06%20Логистическая%20ERP.md) | era-logistics | M3, M7 | M8–M13 |
| [07 Медицинская ERP.md](./07%20Медицинская%20ERP.md) | era-clinic | M5–M6 | M9–M14 |

**CRM field** (no Gemini file): Kommo/Respond patterns → `era-crm-field` M8–M10.

## Owner legend

| Owner | Meaning |
|-------|---------|
| **SATELLITE** | `era-*` operational UX + events |
| **FINANCE** | era-finance-core |
| **PLATFORM** | orchestrator add-ons — [PLATFORM_ADDONS.md](../docs/PLATFORM_ADDONS.md) |
| **DEFERRED** | Documented; Phase 3+ |

## Implementation status

| Wave | Status | Traceability |
|------|--------|--------------|
| W1 | **Done** 2026-05-28 | [MODULES_CATALOG § W1](../docs/MODULES_CATALOG.md#w1--implementation-queue-4-apps) · DELIVERY § W1-E ×4 |
| W2 MVP | **Done** 2026-05-28 | [MODULES_CATALOG § W2](../docs/MODULES_CATALOG.md#w2--documented-backlog-all-industry-satellites) · DELIVERY § W2-E |
| W2 DEFERRED | **Next queue** | Same catalog table · `PRD.md` §4 |

**Retail-only IDs:** **M11** = promotions at checkout · **M12** = customer at POS (`era-retail-pos` only).
