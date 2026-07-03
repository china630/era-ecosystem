# Reference data (era-data-hub) — consumer audit matrix

Living baseline for FEAT-FC-DH-* vs code. Updated after integration gaps closure (2026-06-15 re-audit pass 2).

**Layer audit:** [DATA_MODEL_INTEGRATION_AUDIT.md](./DATA_MODEL_INTEGRATION_AUDIT.md) §5 — Wave 2 **COMPLIANT** for industry catalog reads via orchestrator gateway.

**SoR target:** `era-data-hub` `/registry/v1/*` with `ERA_DATA_HUB_DATA_SOURCE=hub`.  
**Industry rule (Wave 2 shipped):** sync catalog reads via **Orchestrator Platform Gateway** `GET /platform/v1/catalog/*` — [orchestrator-platform-integration-gateway.md](./adr/orchestrator-platform-integration-gateway.md). HS tariff preview remains Finance-only.

<!-- AUDIT:AUTO:reference-scan-summary -->
Reference/hub domain flags: **0** issue(s) as of 2026-06-16.
<!-- /AUDIT:AUTO:reference-scan-summary -->

## Catalog matrix

| Catalog | Hub API | Hub DELIVERY | Finance consumer | Bank | Industry | Doc status | Gap | Wave |
|---------|---------|--------------|------------------|------|----------|------------|-----|------|
| FX (DH-001) | `/fx/*` | SHIPPED | `CurrencyConverterService`, customs auto-rate | EOD FINAL | Platform gateway `fx/convert` | PRD [x] | — | 2 |
| HS (DH-002) | `/hs/:code`, `/tariff` | SHIPPED | `CustomsTaxCalculatorService` | — | `hs-preview` handoff | PRD [x] | — | 2a |
| Calendar (DH-003) | `/calendar/az/*` | SHIPPED | `HrCalendarService` | EOD/settlement | Platform gateway calendar | PRD [x] | — | 2b |
| Banks (DH-004) | `/banks`, `/branches/:code` | SHIPPED | `BankDirectoryService` | snapshot/API | — | PRD [x] | — | 2a |
| IBAN (DH-005) | `/iban/validate` | SHIPPED | `IbanValidationService` | API | — | PRD [x] | bank wire UI | 4 |
| VÖEN (DH-006) | `/companies/:voen` | SHIPPED | `voen-preview` handoff | — | Platform gateway companies | PRD [x] | live e-taxes **BLOCKED** | 2a |
| Geo (DH-007) | `/geo/*` | SHIPPED | `SystemCatalogController` | — | — | PRD [x] | — | 2a |
| UoM (DH-008) | `/uom` | SHIPPED | `SystemCatalogController` | — | — | PRD [x] | — | 2a |
| Tax (DH-009) | `/tax-rates` | SHIPPED | `SystemCatalogController` | — | — | PRD [x] | — | 2a |
| CoA template (DH-010) | `/chart-of-accounts` | SHIPPED | org onboarding | snapshot subset | — | PRD [x] | posting roles sync | 2b |

## Industry satellites (platform gateway — Wave 2)

| App | Direct hub | FX | Calendar | VÖEN UI | Documented |
|-----|------------|-----|----------|---------|------------|
| era-logistics | No | `/api/fx-preview` BFF → orch | sla/eta + trips UI | — | DELIVERY + PRD |
| era-wholesale | No | `/api/fx-preview` BFF → orch | payment-terms | VoenLookupField | DELIVERY |
| era-hotel-pms | No | `/api/fx-preview` BFF → orch | auto-BAR | travel agencies | PRD |
| era-construction | No | — | timesheet norm | subcontractor claim | DELIVERY |
| era-auto-service | No | — | appointments snap | work orders | DELIVERY |
| era-crm | No | — | follow-up business days | leads VÖEN | DELIVERY |
| era-clinic | No | — | scheduling | N/A | — |
| era-fnb-pos | No | — | Finance HR | N/A | — |

## External BLOCKED

| Item | Status | ADR |
|------|--------|-----|
| Live e-taxes VÖEN | BLOCKED | [etaxes-voen-unblock-checklist.md](./adr/etaxes-voen-unblock-checklist.md) |
| Sanctions live ingest | BLOCKED | [reference-data-phase2-catalogs.md](./adr/reference-data-phase2-catalogs.md) |

## Changelog

| Date | Change |
|------|--------|
| 2026-06-15 | Initial matrix; PRD §4.18 reconciled with code |
| 2026-06-16 | R1 re-audit — industry gateway + MDM tiers verified COMPLIANT |
| 2026-06-15 | Industry handoffs: fx-preview, hs-preview; audit script in CI |
| 2026-06-15 | Re-audit pass 2: all calendar libs wired; VoenLookupField verticals; HT-FX/WS-FX SHIPPED |
| 2026-06-16 | Calendar wired but ADR boundary conflict flagged — Wave 2 in DATA_MODEL_INTEGRATION_AUDIT |
| 2026-06-16 | Wave 2 shipped: industry via orchestrator catalog gateway; kit calendar + FX/VÖEN delegates |
