# Документация Nafta × Elektraweb

Единая точка входа для клона PMS и оптимизации лицензии Nafta Sanatorium (78 номеров).

## С чего начать

| Задача | Файл |
|--------|------|
| **Umbrella monorepo (hotel-pms + fb-pos)** | **[MONOREPO.md](MONOREPO.md)** · реестр: [DOCUMENTATION-INDEX.md](DOCUMENTATION-INDEX.md) |
| **Delivery hotel-pms** | [DELIVERY.md](DELIVERY.md) (Stage 17 = bridge для fb-pos) |
| **Спецификация era-fb-pos** | [FB_POS_SATELLITE.md](FB_POS_SATELLITE.md) → [../../era-fb-pos/doc/README.md](../../era-fb-pos/doc/README.md) |
| **OpenAPI контракты** | [openapi/README.md](openapi/README.md) |
| **Спецификация продукта (v0.4, ф.1 + ф.2)** | **[clone-spec/README.md](clone-spec/README.md)** ← основная работа |
| **ACC vs ERP — граница финансов** | [clone-spec/01-finance-boundary.md](clone-spec/01-finance-boundary.md) |
| **Реестр всех 292 экранов** | [nafta/screens-manifest.csv](nafta/screens-manifest.csv) |
| **Что отключить в лицензии** | [nafta/license-optimization.md](nafta/license-optimization.md) |
| **Бизнес-процессы отеля** | [nafta/business-processes.md](nafta/business-processes.md) |
| **Прайс по модулям** | [nafta/license-pricing.csv](nafta/license-pricing.csv) |
| **Пробелы для Азербайджана** | [reference/elektraweb-gap-analysis-az-global.md](reference/elektraweb-gap-analysis-az-global.md) |
| **Маркетинговый каталог модулей** | [reference/elektraweb-modules-catalog.md](reference/elektraweb-modules-catalog.md) |

## Структура папок

```
doc/
├── README.md                 ← вы здесь
├── DELIVERY.md               ← tracker hotel-pms (+ Stage 17 bridge)
├── MONOREPO.md               ← план umbrella repo
├── DOCUMENTATION-INDEX.md    ← реестр всех md/yaml (миграция без потерь)
├── openapi/                  ← fb-pos-pms-bridge, erp-*
├── fb-pos/                   ← спека era-fb-pos (09/10 wireflows)
├── clone-spec/               ← ТЗ hotel-pms
├── nafta/                    ← всё специфичное для Nafta (работайте отсюда)
│   ├── screens-manifest.csv  ← 292 строки, главный индекс
│   ├── screens-manifest.json
│   ├── license-optimization.md
│   ├── business-processes.md
│   ├── supplement-pos-spa.md
│   ├── supplement-stock-procurement.md
│   └── license-*.csv / .xlsx
├── screens/                  ← 292 скрина IMG-20260522-WA0056…WA0347.jpg
├── reference/                ← аналитика Elektraweb (сайт, API, AZ gap)
├── data/                     ← JSON: priceapi, scrape, coverage
├── screenshots/elektraweb/   ← ~100 маркетинговых скринов с сайта
└── archive/                  ← исходники NotebookLM, устаревшие дубликаты
    └── manifest-notebooklm/
```

## Скриншоты Nafta

- Путь: `doc/screens/IMG-20260522-WAxxxx.jpg`
- Связь с описанием: колонка `file` в `nafta/screens-manifest.csv`
- **190** экранов с контентом, **102** пустых (только пункт меню)

## Скрипты (`scripts/`)

| Команда | Назначение |
|---------|------------|
| `node scripts/build-nafta-docs.js` | Собрать CSV/JSON из архива NotebookLM + обновить optimization |
| `node scripts/analyze-manifest.js` | Отчёт покрытия → `data/coverage-report.json` |
| `node scripts/nafta-license-excel.js` | Пересчёт цен лицензии (нужен `data/price_product.json`) |
| `node scripts/generate-catalog.js` | Обновить маркетинговый каталог |
| `node scripts/scrape-modules.js` | Парсинг страниц elektraweb.com |

## Лицензия Nafta (активные модули)

PMS, ChannelManager&BookingEngine, POS, STOCK, F&B, ACC, Procurement, FixedAsset, SPA, DMENU, DoorLockIntegration

**Факт:** ~5000 EUR/год · **Прайс API:** ~5860 EUR/год

Краткая рекомендация по отключению: DMENU + Procurement + DoorLock + FixedAsset (~620 EUR/год) — см. [license-optimization.md](nafta/license-optimization.md).

## Спецификация клона

Папка **[clone-spec/](clone-spec/)** — функциональное ТЗ без технических деталей. Старт: отельные операции; финансы — во внешнем ERP.

## Архив

Исходные выгрузки NotebookLM (Части 1–4, Пункты 2–5) — `archive/manifest-notebooklm/`.  
Не удаляйте до финализации clone-spec; для работы достаточно `nafta/screens-manifest.csv`.
