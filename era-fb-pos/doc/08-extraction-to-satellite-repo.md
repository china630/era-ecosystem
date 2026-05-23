# 08. Размещение era-fb-pos (monorepo и legacy)

> Чеклист для старта кода fb-pos.  
> **Для Nafta рекомендуется:** [umbrella monorepo](../MONOREPO.md) — `apps/fb-pos`, не отдельный GitHub repo.

---

## Вариант A — Umbrella monorepo (рекомендуется)

| Шаг | Действие |
|-----|----------|
| 1 | Создать / расширить repo по [MONOREPO.md](../MONOREPO.md) |
| 2 | `apps/fb-pos/` — Next.js + Prisma + `package.json` `@era/fb-pos` |
| 3 | Спека **остаётся** в `doc/fb-pos/` (не копировать в app) |
| 4 | OpenAPI → `packages/contracts/openapi/` + зеркало `doc/openapi/` |
| 5 | [DELIVERY-FB.md](DELIVERY-FB.md) — tracker FB-0…FB-3 |
| 6 | `docker compose --profile fb-pos` + profile `all` для E2E |
| 7 | `.env.example` в app: `PMS_BRIDGE_URL`, `POS_BRIDGE_SECRET`, `DATABASE_URL`, KKM |

**Связь с PMS:** тот же compose network; Stage 17 [DELIVERY.md](../DELIVERY.md).

**Не дублировать:** folio, night audit, quick posting, medical — только в `apps/hotel-pms`.

---

## Вариант B — Отдельный репозиторий (legacy)

Использовать только если fb-pos — отдельный продукт / команда без доступа к PMS.

| Шаг | Действие |
|-----|----------|
| 1 | Создать `era-fb-pos` (GitHub/GitLab) |
| 2 | Скопировать `doc/fb-pos/*` → `doc/` |
| 3 | Submodule или mirror: `23-pos-bridge`, `17-az`, `18-erp`, `22-outbound` |
| 4 | OpenAPI копия `fb-pos-pms-bridge.yaml` с semver tag |
| 5 | Integration test против staging PMS URL |

Минус: drift спеки и OpenAPI — нужен общий `packages/contracts` или bot sync.

---

## Shared contracts (оба варианта)

| Контракт | Владелец | Потребитель |
|----------|----------|-------------|
| Room charge API | **hotel-pms** | fb-pos |
| In-house guests API | **hotel-pms** (Stage 17) | fb-pos |
| Event envelope E3/E7/E8 | **shared doc** + openapi | fb-pos, ERP |
| Revenue codes | PMS master + E5 | fb-pos read |

---

## Документы (канон в monorepo)

```
doc/fb-pos/README.md
doc/fb-pos/00 … 07
doc/fb-pos/08-extraction-to-satellite-repo.md   (этот файл)
doc/fb-pos/09-wireflow-ticket-to-folio.md
doc/fb-pos/10-wireflow-cash-fiscal.md
doc/fb-pos/DELIVERY-FB.md
doc/openapi/fb-pos-pms-bridge.yaml
doc/DOCUMENTATION-INDEX.md
```

Полный реестр: [DOCUMENTATION-INDEX.md](../DOCUMENTATION-INDEX.md).

---

## Gate перед первым prod

- [ ] FB-1 user stories FB-01…FB-07 ([07-phases](07-phases-delivery-user-stories.md))
- [ ] Wireflow [09](09-wireflow-ticket-to-folio.md) E2E
- [ ] Wireflow [10](10-wireflow-cash-fiscal.md) E2E (cash + E3/E7)
- [ ] Z-close + PMS night audit block (Stage 17)
- [ ] KKM на стенде AZ (или waiver)
- [ ] Nafta подтверждает outlet codes FOOD/BAR

---

## Версионирование спеки

| Semver | Когда bump |
|--------|------------|
| 0.x | До первого prod fb-pos |
| 1.0 | FB-1 MVP Nafta |
| 1.x | Обратно совместимые API |
| 2.0 | Breaking room-charge / event schema |
