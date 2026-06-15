# ERA Data Hub — PRD

## Vision

Горизонтальный **Reference Data / DaaS** для ERA и внешних B2B-клиентов: курсы ЦБА, календарь, ВЭД, реквизиты VÖEN, банки, гео, UoM, налоговые ставки, план счетов.

**Out of scope:** per-tenant транзакции (декларации БГД, выписки, проводки), платёжные адаптеры банков.

## Modules (§3)

| ID | Module | Status |
|----|--------|--------|
| DH-1 | FX rates + history + CBAR ingest | **DONE** (Pass 2) |
| DH-2 | Production calendar AZ | **DONE** (2025–2028 seed, full dayType, bulk API) |
| DH-3 | HS + customs tariffs | **MVP** |
| DH-6 | Company directory (VÖEN) | **MVP** (PII shelf C) |
| DH-7 | Banks + branches | **MVP** |
| DH-8 | IBAN validate | **MVP** |
| DH-9 | Geo (countries/cities) | **MVP** |
| DH-10 | Units of measure | **MVP** |
| DH-11 | Tax rates | **MVP** |
| DH-12 | Chart of accounts templates | **MVP** |
| DH-CP | Control plane product `platform_reference_data` | **Live** (validate-key Pass 2) |

## Integrations

- **Consumers:** `era-finance-core` (`ERA_DATA_HUB_ENABLED`), satellites via service token — see [doc/DATA-HUB-CONSUMER.md](doc/DATA-HUB-CONSUMER.md).
- **Billing:** `era-orchestrator` — `platform_reference_data`, API keys live + audit meter stub.

## Changelog (§7)

- **2026-06-02 (Pass 2):** CBAR ingest in hub, Redis cache headers, catalog vendored, orchestrator validate-key, finance tariff/calendar client, smoke script, full TZ/consumer docs.
- **2026-06-01:** Initial MVP — NestJS service, Phase 0 RO finance reads, hub DB for calendar, Docker/Traefik `data.era-365.online`.
