# Реестр документации (Documentation Index)

> **Версия индекса:** 1.0 · 2026-05  
> **Назначение:** единый каталог для перехода в [umbrella monorepo](MONOREPO.md) без потери файлов и ссылок.

**Легенда `monorepo_path`:** куда файл переезжает (сейчас = целевой канон).

| Статус | Значение |
|--------|----------|
| stable | Не менять путь при M1 |
| move-with-app | Переезд вместе с кодом app (только README в apps) |
| copy-to-contracts | Дубли в `packages/contracts` |

---

## Корень `doc/`

| Файл | monorepo_path | Владелец | Статус |
|------|---------------|----------|--------|
| [README.md](README.md) | `doc/README.md` | umbrella | stable |
| [DELIVERY.md](DELIVERY.md) | `doc/DELIVERY.md` | hotel-pms | stable |
| [MONOREPO.md](MONOREPO.md) | `doc/MONOREPO.md` | umbrella | stable |
| [DOCUMENTATION-INDEX.md](DOCUMENTATION-INDEX.md) | `doc/DOCUMENTATION-INDEX.md` | umbrella | stable |
| [UAT-SMOKE.md](UAT-SMOKE.md) | `doc/UAT-SMOKE.md` | hotel-pms | stable |
| [i18n.md](i18n.md) | `doc/i18n.md` | hotel-pms | stable |

---

## `doc/clone-spec/` — ТЗ hotel-pms (29 файлов)

| № | Файл | monorepo_path | Примечание |
|---|------|---------------|------------|
| 00–13 | `00-vision` … `13-nafta-validation` | `doc/clone-spec/` | Фаза 1 + валидация |
| 14 | [14-phase2-roadmap.md](clone-spec/14-phase2-roadmap.md) | stable | Ссылка MONOREPO |
| 15 | [15-pos-fb-spa.md](clone-spec/15-pos-fb-spa.md) | stable | → `doc/fb-pos/` |
| 16–22 | `16-stock` … `22-outbound` | stable | Stock = ERP для Nafta |
| 23 | [23-pos-bridge.md](clone-spec/23-pos-bridge.md) | stable | **Сервер** room-charge |
| — | [README.md](clone-spec/README.md) | stable | Карта + fb-pos link |

**Входящие ссылки из:** `doc/fb-pos/*`, DELIVERY, код (комментарии).

---

## `doc/fb-pos/` — ТЗ era-fb-pos

| Файл | monorepo_path | Зависимости |
|------|---------------|-------------|
| [README.md](fb-pos/README.md) | stable | INDEX |
| [DELIVERY-FB.md](fb-pos/DELIVERY-FB.md) | stable | DELIVERY Stage 16–17 |
| [00-vision-and-boundaries.md](fb-pos/00-vision-and-boundaries.md) | stable | clone-spec 01, 13 |
| [01-architecture-and-integrations.md](fb-pos/01-architecture-and-integrations.md) | stable | 23, openapi |
| [02-domain-model.md](fb-pos/02-domain-model.md) | stable | — |
| [03-floor-orders-kds.md](fb-pos/03-floor-orders-kds.md) | stable | nafta supplement |
| [04-payments-shifts-fiscal.md](fb-pos/04-payments-shifts-fiscal.md) | stable | 17-az |
| [05-master-data-menu.md](fb-pos/05-master-data-menu.md) | stable | 09-master |
| [06-rbac-and-operations.md](fb-pos/06-rbac-and-operations.md) | stable | 21-satellite-rbac |
| [07-phases-delivery-user-stories.md](fb-pos/07-phases-delivery-user-stories.md) | stable | DELIVERY-FB |
| [08-extraction-to-satellite-repo.md](fb-pos/08-extraction-to-satellite-repo.md) | stable | **MONOREPO** primary |
| [09-wireflow-ticket-to-folio.md](fb-pos/09-wireflow-ticket-to-folio.md) | stable | openapi bridge |
| [10-wireflow-cash-fiscal.md](fb-pos/10-wireflow-cash-fiscal.md) | stable | 22-outbound E3/E7 |

---

## `doc/openapi/`

| Файл | monorepo_path | copy-to-contracts |
|------|---------------|-------------------|
| [README.md](openapi/README.md) | stable | — |
| [fb-pos-pms-bridge.yaml](openapi/fb-pos-pms-bridge.yaml) | stable | yes |
| [erp-inbound-e6.yaml](openapi/erp-inbound-e6.yaml) | stable | yes |
| [erp-outbound-catalog.yaml](openapi/erp-outbound-catalog.yaml) | stable | yes |

---

## `doc/nafta/`

| Артефакт | monorepo_path | Примечание |
|----------|---------------|------------|
| `screens-manifest.csv` / `.json` | `doc/nafta/` | 292 экрана |
| `license-optimization.md` | stable | |
| `business-processes.md` | stable | |
| [supplement-pos-spa.md](nafta/supplement-pos-spa.md) | stable | WA0098, 0135, 0146 |
| [supplement-stock-procurement.md](nafta/supplement-stock-procurement.md) | stable | ERP scope |
| `license-*.csv`, `.xlsx` | stable | |

---

## `doc/reference/`

| Файл | monorepo_path |
|------|---------------|
| elektraweb-gap-analysis-az-global.md | stable |
| elektraweb-modules-catalog.md | stable |
| elektraweb-modules-pricing-analysis.md | stable |

---

## `doc/screens/`, `doc/data/`, `doc/archive/`

| Путь | monorepo_path | Примечание |
|------|---------------|------------|
| `doc/screens/*.jpg` | stable | Бинарники — не в git LFS без нужды |
| `doc/data/` | stable | JSON scrape |
| `doc/archive/` | stable | NotebookLM |

---

## Код → документация (после M1)

| Код (сейчас) | Документация |
|--------------|--------------|
| `app/api/pos/room-charge` | 23-pos-bridge, openapi, 09-wireflow |
| `app/api/integration/*` | 18, 22, openapi erp-* |
| `src/lib/integration/*` | 19, 22 |
| `app/admin/stock` | 16-stock (**dev**, Nafta → ERP) |
| `messages/*.json` | i18n.md |

**apps/hotel-pms/README.md** (создать при M1):

```markdown
# @era/hotel-pms
Документация: [../../doc/README.md](../../doc/README.md)
Delivery: [../../doc/DELIVERY.md](../../doc/DELIVERY.md)
```

**apps/fb-pos/README.md** (создать при M3):

```markdown
# @era/fb-pos
Спека: [../../doc/fb-pos/README.md](../../doc/fb-pos/README.md)
Delivery: [../../doc/fb-pos/DELIVERY-FB.md](../../doc/fb-pos/DELIVERY-FB.md)
```

---

## Граф зависимостей (ключевые)

```text
doc/fb-pos/09,10 ──► doc/openapi/fb-pos-pms-bridge.yaml
        │                    │
        └──────► doc/clone-spec/23-pos-bridge.md
                        │
                        ▼
              apps/hotel-pms (room-charge API)
doc/fb-pos/10 ──► doc/clone-spec/22-outbound (E3,E7)
doc/clone-spec/18 ──► openapi/erp-*
doc/nafta/supplement-pos-spa ──► doc/fb-pos/03,04
```

---

## Проверка перед merge monorepo

```bash
# из корня repo после M1
rg "\]\(\.\./" doc/ -g "*.md"   # относительные ссылки
rg "era-hotel-pms/doc" .         # старые абсолютные пути
rg "doc/fb-pos" apps/            # должны указывать на ../../doc/fb-pos
```

Рекомендуется CI job: `markdown-link-check` на `doc/**/*.md`.

---

## История версий индекса

| Версия | Дата | Изменение |
|--------|------|-----------|
| 1.0 | 2026-05 | Первый реестр + monorepo plan |
