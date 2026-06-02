# ElectraWeb — куда переехали исходники

> **2026-06-04:** корневая папка `Electraweb/` в monorepo **удалена**. Ниже — канонические документы ERA для дальнейшей разработки.  
> Полный каталог модулей и SKU: [elektraweb-modules-catalog.md](./elektraweb-modules-catalog.md).  
> Скриншоты: `era-hotel-pms/doc/screens/` (при наличии) и Nafta [screens-manifest](../nafta/screens-manifest.csv).

## Реализовано в hotel-pms (не искать в `Electraweb/`)

| Бывший файл | Канон в ERA |
|-------------|-------------|
| `front office.md` | [FRONT-OFFICE-STATUS.md](../FRONT-OFFICE-STATUS.md) (traceability) · [FRONT-OFFICE-ELECTRAWEB.md](../FRONT-OFFICE-ELECTRAWEB.md) (routes/API) |
| `crm.md` (Guest Card CRM + Res. details) | [GUEST-CRM-ELECTRAWEB.md](../GUEST-CRM-ELECTRAWEB.md) · код: `src/lib/guest-crm-config.ts` |
| `Новая папка (2)/02 FRONT OFFICE.md` | Дублирует FO; см. STATUS + [ELEKTRAWEB-PARITY.md](../ELEKTRAWEB-PARITY.md) Waves A–G |

## Черновики модулей (backlog, не удалять логику)

Исходные markdown-черновики из `Новая папка (2)/` сведены к маршрутам ERA:

| Черновик | ERA сегодня | Углубление |
|----------|-------------|------------|
| `0 SETUP.md` | Admin/setup, Prisma MDM | [clone-spec/09-master-data.md](../clone-spec/09-master-data.md) |
| `03 FRONT CASH.md` | Cashier / folio (частично в FO) | Backlog post-FO |
| `03 NIGHT AUDIT.md` | `/operations`, EOD logs | Wave B; polish в DELIVERY |
| `04 CRM.md` | Платформенный `era-crm` + Guest CRM в PMS | [GUEST-CRM-ELECTRAWEB.md](../GUEST-CRM-ELECTRAWEB.md) |
| `05 CHANNEL MANAGER.md` | `/channel`, mappings | [ELEKTRAWEB-PARITY.md](../ELEKTRAWEB-PARITY.md) Distribution |
| `06 CONTRAC MANAGEMENT.md` | Agencies, contracts admin | Wave B admin |
| `08 HOUSEKEEPING.md` | `/housekeeping/*` | Wave B HK |
| `16 TRANSFER 17 SPA.MD` | `/transfers`, `/spa/*`, `/procedures` | SPA depth — backlog |

## Правило для разработчиков

1. **Front Office / Guest card** — только `FRONT-OFFICE-*`, `GUEST-CRM-*`, `UAT-SMOKE` §14–16.  
2. **Новый модуль** — дописать [ELEKTRAWEB-PARITY.md](../ELEKTRAWEB-PARITY.md) + DELIVERY; при необходимости строку в [FRONT-OFFICE-STATUS.md](../FRONT-OFFICE-STATUS.md).  
3. **Сравнение с ElektraWeb** — [elektraweb-gap-analysis-az-global.md](./elektraweb-gap-analysis-az-global.md), не восстанавливать папку `Electraweb/`.
