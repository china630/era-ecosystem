# Finance Core — планы исполнения (composer)

Запускать **строго по порядку**:

| # | Файл | Содержание | Зависимости | Статус |
|---|------|------------|-------------|--------|
| 1 | [1_core.md](./1_core.md) | Posting-роли, де-хардкод, CI-гард-рейл, Data Hub consumer (PRD §4.18 / TZ §28) | — | ✅ приёмка 2026-06-05 |
| 2 | [2_core.md](./2_core.md) | UX и онбординг FEAT-FC-UX-001…009 (PRD §4.17 / TZ §27) | 1_core | ✅ приёмка 2026-06-05 |
| 3 | [3_core.md](./3_core.md) | Intercompany network exchange (PRD §4.19 / TZ §29) | 1_core | ✅ приёмка 2026-06-05 |
| 4 | [4_orchestrator.md](./4_orchestrator.md) | БД граждан (FIN), e-Qaimə, кросс-деплой | 2_core, 3_core | ✅ приёмка 2026-06-05 *(E2E multi-finance — отложено)* |

**Продуктовая документация:** [PRD.md](../../PRD.md) · [TZ.md](../../TZ.md)

**Не редактировать:** `.cursor/plans/finance_core_full_cycle_*.plan.md` (мета-план).
