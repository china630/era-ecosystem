# Планы реализации (индекс)

Единая точка входа. Детали фаз — только в **Cursor plan** (не дублировать отдельными `docs/*.md`).

| Версия / фаза | Статус | Cursor plan |
|---------------|--------|-------------|
| v1.1 | Shipped 2026-05-26 | [era_v1.1_release](../.cursor/plans/era_v1.1_release_75a73624.plan.md) |
| v2.0 | Shipped 2026-05-26 · DELIVERY 432/432 | [era_v2.0_release](../.cursor/plans/era_v2.0_release_ee4a671b.plan.md) |
| pre-GA | Shipped 2026-05-25 | [era_pre-ga_hardening](../.cursor/plans/era_pre-ga_hardening_447867e7.plan.md) |
| Module maturity | Shipped 2026-05-26 (M0–M5, MVP backlog closed) | [era_modules_catalog_maturity](../.cursor/plans/era_modules_catalog_maturity_2dc76166.plan.md) |
| ERA Data Hub (DaaS) | **Pass 2 2026-06-02** — CBAR ingest, cache, cutover, orch keys | [era_data_hub_p1](../.cursor/plans/era_data_hub_p1_6337429e.plan.md) · [era_data_hub_pass_2](../.cursor/plans/era_data_hub_pass_2_7f78d60e.plan.md) · [ADR](./adr/era-data-hub.md) · [DELIVERY](../era-data-hub/doc/DELIVERY-DATA-HUB.md) |

**Порядок:** v1.1 → v2.0 → pre-GA (parallel hardening) → module maturity.

**Module maturity (кратко):** M-sync каталога · M1 v1.1 **DONE** · M2 v1.0/v2.0 core · M3 Auto vehicle/labor/parts · M4 Orch launcher · M5 Con M5 **DEFERRED** — см. [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md) § Module maturity.

**Версионирование:** [PRODUCT_VERSIONING.md](./PRODUCT_VERSIONING.md) · **Roadmap:** [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)

**Матрица:** `node scripts/delivery-readiness.mjs` · `node scripts/readiness-coverage.mjs` · [READINESS_MATRIX.md](./READINESS_MATRIX.md)
