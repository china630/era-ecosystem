# Reference data (era-data-hub) — consumer audit matrix

Living baseline for FEAT-FC-DH-* vs code. Updated after integration gaps closure (2026-06-15 re-audit pass 2).

**SoR target:** `era-data-hub` `/registry/v1/*` with `ERA_DATA_HUB_DATA_SOURCE=hub`.  
**Rule:** industry satellites **must not** call hub; use Finance handoffs / deep links only.

## Catalog matrix

| Catalog | Hub API | Hub DELIVERY | Finance consumer | Bank | Industry | Doc status | Gap | Wave |
|---------|---------|--------------|------------------|------|----------|------------|-----|------|
| FX (DH-001) | `/fx/*` | SHIPPED | `CurrencyConverterService`, customs auto-rate | EOD FINAL | Finance `fx-preview` | PRD [x] | — | 1 |
| HS (DH-002) | `/hs/:code`, `/tariff` | SHIPPED | `CustomsTaxCalculatorService` | — | `hs-preview` handoff | PRD [x] | — | 2a |
| Calendar (DH-003) | `/calendar/az/*` | SHIPPED | `HrCalendarService` | EOD/settlement | `CalendarClient` wired all verticals | PRD [x] | — | 2b |
| Banks (DH-004) | `/banks`, `/branches/:code` | SHIPPED | `BankDirectoryService` | snapshot/API | — | PRD [x] | — | 2a |
| IBAN (DH-005) | `/iban/validate` | SHIPPED | `IbanValidationService` | API | — | PRD [x] | bank wire UI | 4 |
| VÖEN (DH-006) | `/companies/:voen` | SHIPPED | `voen-preview` handoff | — | `VoenLookupField` ×5 verticals | PRD [x] | live e-taxes **BLOCKED** | 2a |
| Geo (DH-007) | `/geo/*` | SHIPPED | `SystemCatalogController` | — | — | PRD [x] | — | 2a |
| UoM (DH-008) | `/uom` | SHIPPED | `SystemCatalogController` | — | — | PRD [x] | — | 2a |
| Tax (DH-009) | `/tax-rates` | SHIPPED | `SystemCatalogController` | — | — | PRD [x] | — | 2a |
| CoA template (DH-010) | `/chart-of-accounts` | SHIPPED | org onboarding | snapshot subset | — | PRD [x] | posting roles sync | 2b |

## Industry satellites (indirect only)

| App | Direct hub grep | FX | Calendar | VÖEN UI | Documented |
|-----|-----------------|-----|----------|---------|------------|
| era-logistics | **No** | fx-preview SHIPPED | sla/eta + trips UI | — | DELIVERY + PRD |
| era-wholesale | **No** | import PO fx-preview | payment-terms | VoenLookupField | DELIVERY |
| era-hotel-pms | **No** | folio display FX | auto-BAR | travel agencies | PRD |
| era-construction | **No** | — | timesheet norm | subcontractor claim | DELIVERY |
| era-auto-service | **No** | — | appointments snap | work orders | DELIVERY |
| era-crm | **No** | — | follow-up business days | leads VÖEN | DELIVERY |
| era-clinic | **No** | — | scheduling | N/A | — |
| era-fnb-pos | **No** | — | Finance HR | N/A | — |

## External BLOCKED

| Item | Status | ADR |
|------|--------|-----|
| Live e-taxes VÖEN | BLOCKED | [etaxes-voen-unblock-checklist.md](./adr/etaxes-voen-unblock-checklist.md) |
| Sanctions live ingest | BLOCKED | [reference-data-phase2-catalogs.md](./adr/reference-data-phase2-catalogs.md) |

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Initial matrix; PRD §4.18 reconciled with code |
| 2026-06-15 | Industry handoffs: fx-preview, hs-preview; audit script in CI |
| 2026-06-15 | Re-audit pass 2: all calendar libs wired; VoenLookupField verticals; HT-FX/WS-FX SHIPPED |
