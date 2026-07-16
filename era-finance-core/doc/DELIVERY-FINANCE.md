# DELIVERY-FINANCE

PRD: [../PRD.md](../PRD.md) · TZ: [../TZ.md](../TZ.md)

Source of truth for scope is **`PRD.md`** — every completed item carries a `[x] COMPLETED` tag there. This tracker mirrors the PRD into the ecosystem delivery format so `docs/READINESS_MATRIX.md` and `node scripts/delivery-readiness.mjs` can aggregate Finance alongside the satellites.

**Counting note.** `scripts/delivery-readiness.mjs` counts only top-level `- [x]` (done) and `- [ ]` (open) lines. The **10 milestones below** are the shipped product cores (Modules 1–10 + Platform), all `[x]`. Nested detail uses the coverage taxonomy — `[x]` SHIPPED · `[~]` PARTIAL · `[s]` STUB · `[h]` HEADLESS · `[ ]` PLANNED — and is intentionally indented so it does not distort the milestone count. Roadmap / gaps tracked in PRD are in the final table, not as open milestones.

Taxonomy authority: [`.cursor/rules/era-coverage-definition.mdc`](../../.cursor/rules/era-coverage-definition.mdc) · actor matrix: [docs/COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md).

## Delivered milestones (10)

- [x] **M1 — IAM, Multi-tenancy & Onboarding** (PRD §4.1, §4.1.1–4.1.3, §3.2)
  - [x] Registration / org onboarding, SSO handoff, profile — `/login`, `/register-org`, `/auth/cp-handoff`, `/settings/profile`
  - [x] Control-plane RBAC proxy (`ERA_CONTROL_PLANE_RBAC_PROXY`), org membership + company switcher — `/companies`, `/settings/team`
  - [x] Migration Mode / Onboarding 2.0 + Opening Balances Wizard — `/settings/migration`
  - [~] Mandatory company-select modal on login (FEAT-FC-UX-002) — PLANNED in PRD §4.17

- [x] **M2 — Ledger & Chart of Accounts** (PRD §4.2, §4.2.1, §5.1)
  - [x] Double-entry GL, manual journals, transactional postings
  - [x] NAS chart commercial / budget / ngo (~99 accounts), seed catalog, import per org — `/accounting/chart`
  - [x] Posting roles + templates, period close checklist — `/accounting/posting-roles`, `/reporting` close-period
  - [x] IFRS parallel book + NAS→IFRS mirror + mapping rules — `/accounting/ifrs-mapping`, `/accounting/mapping`
  - [x] PostingRole de-hardcode of account literals (FEAT-FC-COA-001 / §4.18.3) — `PostingAccountResolver` + `lint-nas-literals.mjs` CI guard — `[x]` SHIPPED (Wave 3 A)
  - [x] NAS VAT posting roles (`VAT_INPUT→191`, `VAT_OUTPUT→545`, `VAT_DEPOSIT_ACCOUNT→223`) + output VAT on invoice SENT — `[x]` SHIPPED (Wave 4 A) — [ADR](../../docs/adr/vat-deposit-routing.md)
  - [x] Flexible subconto on journal lines (`SubcontoType`, `AccountSubcontoConfig`, `JournalEntryDimension`) behind `ERA_SUBCONTO_ENABLED` — `[x]` SHIPPED API; reports `[x]` SHIPPED UI when flag on — [ADR](../../docs/adr/subconto-analytical-dimensions.md)

- [x] **M3 — CRM & Counterparties** (PRD §4.3)
  - [x] Counterparty registry, VÖEN, AR legal forms, ƏDV ödəyicisi, bank accounts 1:N — `/crm/counterparties`
  - [x] MDM `globalPersonId` mirror (FIN → `era_mdm`), merge, VÖEN preview handoff (FEAT-FC-DH-006 / FEAT-FC-CIT-001)
  - [h] Auto-counterparty from CRM satellite events (CRM-CONV-01)

- [x] **M4 — Sales & Invoicing** (PRD §4.4, §4.4.1, §4.11)
  - [x] Invoices with line-level ƏDV (0/18/exempt), multi-currency, goods+services, PDF AZ/RU/EN — `/sales/invoices`
  - [x] Guest invoice portal — `/(public)/portal/invoice/[token]`
  - [x] Reconciliation act + netting — `/sales/reconciliation`, invoice modal
  - [~] **e-Qaimə S2S submit** (`EqaimeSubmissionService`, `Invoice.eqaime*`) behind `ERA_EQAIME_S2S_ENABLED` — `[s]` STUB/API when flag off; RPA prefill + status UI on `/sales/invoices` — Wave 4 E3 — [ADR](../../docs/adr/eqaime-s2s-submission.md)
  - [~] **International trade** (`TradeContext` DOMESTIC/EXPORT/IMPORT, Incoterms, Commercial Invoice PDF, import pipeline) — `[x]` SHIPPED API+UI (Wave 5 G9); export e-qaimé optional — `[~]` PARTIAL — `@RequiresModule(trade_pro)` — [ADR](../../docs/adr/trade-context-daxili-xarici.md)
  - [x] **Price lists + discount rules** — `/catalog/price-lists`; resolve in `InvoicesService.buildItems` — `[x]` SHIPPED (Wave 5 E7)

- [x] **M5 — Cash Management & Treasury** (PRD §4.5, §4.5.1, §4.5.2, §4.13, §4.14)
  - [x] Outgoing payments (BankPaymentDraft), statement import CSV/Excel + auto-match, transfers, conversion — `/banking`
  - [x] Direct Banking adapters (Pasha / ABB / Birbank-Kapital), IBAN deep-check
  - [x] Cash MKO/MXO + cash book + approval workflow — `/(app)/banking/cash`, `/inbox/approvals`
  - [x] **Advance reports registry** (typed expense lines, MXO link, multi-currency, print) — `/expenses/advance-reports`, `GET/POST banking/cash/advance-reports/*` — `[x]` SHIPPED (Wave 5 E7) — `@RequiresModule(kassa_pro)`
  - [x] Cash Flow (direct) + forecast/projection — `/treasury/cash-flow`, `/reports/cash-flow`
  - [x] Period lock / backdating protection (§4.5.2)

- [x] **M6 — HR & Payroll (AR localization)** (PRD §4.6, §4.6.1)
  - [x] Employees with FIN, timesheet, absences (CP mirror read), org structure mirror — `/employees`, `/hr/timesheet`, `/hr/structure`
  - [x] Payroll engine v16.1 (income 0/14% >8000, DSMF, İTS, unemployment), GPH 5%, postings to GL on PAID — `/payroll`
  - [~] **WS1 payroll depth** — work schedules + premium rates, tariff/supplement, slip lines/components, night/evening/OT hours, vacation seniority, per-diem norms + business trips, email payslips — `/hr/work-schedules`, `/hr/vacation-seniority-rules`, `/hr/per-diem-norms`, `/hr/business-trips`, `/payroll` — `[~]` API (UAT-SMOKE pending) — COVERAGE `FIN-HR-PAY-01`
  - [~] **Aktiv list** JSON + Excel — `GET /hr/reports/active-list`, `/employees` export — MDM ops-profile read-through — `[~]` API — COVERAGE `FIN-HR-AL-01`
  - [x] Production calendar (Baku) via Data Hub — `HrCalendarService`
  - [~] ƏMAS employee prefill + Excel import/export + RPA connector (MOD-V3-EMAS-001); **S2S lifecycle UI** (`/employees` edit modal) + server endpoints behind `ERA_EMAS_S2S_ENABLED` — `[~]` API/STUB when flag off
  - [~] DSMF / e-taxes **payroll withholding declaration** (`PAYROLL_WITHHOLDING`) — generate + per-employee preview UI — `/reporting/tax-export` — `[x]` SHIPPED (Wave 2)

- [x] **M7 — Reporting** (PRD §4.7, §4.13, §5.0)
  - [x] Trial balance, P&L (with cost centers), management balance sheet, cash flow — `/reporting`, `/reports/balance-sheet`, `/reports/cash-flow`
  - [x] AR aging / receivables, reconciliation act, holding rollup (AZN) — `/reporting/aging`, `/reporting/receivables`, `/reporting/holding`
  - [x] NAS / IFRS toggle via `ledgerType`; multi-GAAP
  - [~] VAT declaration package + dedicated UI — `[x]` SHIPPED (Wave 1) — `/reporting/vat`, `/reporting/tax-export`
  - [x] **Profit tax** (`PROFIT_TAX`) declaration + book-to-tax register — `/reporting/profit-tax`, `/reporting/tax-export` — `[x]` SHIPPED (Wave 2 G1)
  - [x] **Subconto reports** (OSV / card / analysis by journal-line dimension) — `/reporting/subconto-analysis`, filters on account-card & turnovers — `[x]` SHIPPED (Wave 3 E4 / Block D)
  - [x] **Fiscal year reformation** (6x/7x → 801 → 802, protocol) — `POST /reporting/close-fiscal-year`, `GET /reporting/fiscal-year-close/:year` — `[x]` SHIPPED (Wave 3 B)
  - [~] **Tax depreciation register** (parallel NK Art. 114) — auto on month close; UI columns on `/fixed-assets` when profile exists — `[~]` PARTIAL (Wave 2)
  - [x] **Statutory MHBS forms** (balance, P&L, cash flow, equity changes, notes + XLSX/PDF) — `/reports/statements/*` — `[x]` SHIPPED (Wave 4 G2) — [ADR](../../docs/adr/mhbs-statement-mapping.md); `@RequiresModule(tax_pro)`
  - [x] **ƏDV deposit account** (GL 223, route/remit/reconcile, bank link) — `/reporting/vat-deposit` — `[x]` SHIPPED (Wave 4 G6) — [ADR](../../docs/adr/vat-deposit-routing.md)
  - [~] **Statistical forms (Goskomstat engine)** — configurable `StatReportDefinition` + standard placeholder set — `/reporting/statforms` — `[x]` SHIPPED UI+API (Wave 5 G3); official blank verification pending — `@RequiresModule(compliance_pro|tax_pro)` — [ADR](../../docs/adr/statform-engine.md)

- [x] **M8 — Immutable Audit + Audit Hub add-on** (PRD §4.8, §4.8.1)
  - [x] Hash-chain AuditLog, `AuditMutationInterceptor`, retention — `/(dashboard)/admin/audit-log`, `/settings/audit`
  - [x] Audit Hub add-on (`audit_hub` / `compliance_pro`): timeline, sampling, bulk export, engagements — `/audit-hub/*`
  - [x] External auditor guest session (invite + token) — `/audit-invitations`

- [x] **M9 / M10 — Inventory (Anbar), Manufacturing, Fixed Assets** (PRD §4.10, §4.10A, §5.D)
  - [x] Inventory: balances, receipts, issues, transfers, physical count, reconciliation (FIFO/AVCO, COGS on shipment) — `/inventory/*`
  - [x] Manufacturing: BOM/recipes, releases, orders, overhead allocation, virtual stock — `/manufacturing/*`
  - [x] Fixed Assets: register, depreciation (straight-line / declining / usage), monthly BullMQ job — `/fixed-assets/*`
  - [x] **Fixed asset lifecycle** (acquisition, modernization, revaluation, full/partial disposal) — `/fixed-assets` actions panel — `[x]` SHIPPED (Wave 3 E5)
  - [x] **Intangible assets** (131/132 amortization, acquire/dispose) — `/intangible-assets` — `[x]` SHIPPED (Wave 3 G8)
  - [~] **Tax depreciation register** (NK Art. 114 parallel book) — `[~]` PARTIAL (Wave 2; see profit-tax adjustments)
  - [x] **Mobile WMS** (bin-level `BinBalance`, zones, scan receive/issue/transfer/adjust, pick lists) — `/inventory/wms-mobile`, `GET/POST inventory/wms/*` — `[x]` SHIPPED (Wave 5 E6) — `@RequiresModule(inventory)` — [ADR](../../docs/adr/bin-level-wms.md)
  - [x] WMS-light bins (topology + binId on movements) — `[x]` SHIPPED (v95+). ~~Intangible assets (НМА) — not a separate module~~ → shipped Wave 3

- [x] **Platform — Subscription/Billing, Data Hub, Events, Customs, OCR, Extension RPA** (PRD §4.12, §4.15, §4.16, §4.18, §6.1.1, §7)
  - [x] Subscription/billing proxy to orchestrator (LEGO modules, spend tiers, quota) — `/settings/subscription`, `/pricing`, `/admin/billing`
  - [x] Data Hub consumer FEAT-FC-DH-001…010 (FX/CBAR, HS tariffs, calendar, banks, IBAN, VÖEN, geo, UoM, tax rates, chart) — `/admin/data/*`
  - [h] Satellite event worker (13 handlers: hotel/retail/logistics/construction/CRM/auto/clinic/wholesale) — FIN-02
  - [x] Customs / BGD (Trade Pro): declaration CRUD, tariff calculator + GATT, capture, cost postings — `/customs`, `/admin/data/customs-tariffs`
  - [x] **Landed cost allocation** (duty/fees/excise → SKU unit cost, `InventoryBatch`, stock movement price update) — `POST customs/declarations/:id/allocate-landed-cost` — `[x]` SHIPPED (Wave 5 E7) — `@RequiresModule(trade_pro)` — [ADR](../../docs/adr/landed-cost-allocation.md)
  - [x] OCR foreign invoice ingest → purchase prefill + quota — `/purchases`
  - [x] Contract Management (`/contracts`), Gov Budget B2G (`/gov-budget`), Prepaid/РБП (`/finance/prepaid-expenses`), PSA (`/psa/projects`)
  - [~] Browser extension RPA (MV3) connectors emas/etaxes/customs/migration (TZ §13.6, §20)
  - [~] **ASAN İmza / SİMA gov-payload signing** (`GovSignatureAdapter`, `ERA_ASAN_SIMA_LIVE`) — declarations + e-Qaimə + reconciliation; mock default — `[~]` API (Wave 4 G7) — [ADR](../../docs/adr/asan-sima-gov-signature.md)
  - [s] e-qaimé S2S production (FIN-EQAIME-01) — server submit behind `ERA_EQAIME_S2S_ENABLED`; RPA prefill + network-inbox when disabled — [ADR](../../docs/adr/eqaime-s2s-submission.md)

## Roadmap / gaps (tracked in PRD — not counted milestones)

These are open per PRD but deliberately excluded from the milestone count above (they are versioned scope, not regressions). Honest status vs a full AZ statutory suite:

| Area | Status | PRD / source |
|------|--------|--------------|
| Finance Core UI/UX wave (header, company modal, full-width, VÖEN workflow, de-hardcode 101/221) | `[ ] PLANNED` | §4.17 (FEAT-FC-UX-001…008) |
| International trade (Daxili/Xarici, Commercial Invoice, import pipeline) | `[x]` SHIPPED API+UI; export e-qaimé optional `[~]` | §4.4.2; Wave 5 G9; [ADR](../../docs/adr/trade-context-daxili-xarici.md) |
| Advance reports registry (full document) | `[x]` SHIPPED | Wave 5 E7; `/expenses/advance-reports`; `kassa_pro` |
| Price lists + discount rules | `[x]` SHIPPED | Wave 5 E7; `/catalog/price-lists` |
| Landed cost allocation on BGD | `[x]` SHIPPED | Wave 5 E7; [ADR](../../docs/adr/landed-cost-allocation.md) |
| Mobile WMS (bin scan, zones, pick/put-away) | `[x]` SHIPPED | Wave 5 E6; `/inventory/wms-mobile`; [ADR](../../docs/adr/bin-level-wms.md) |
| Intercompany network docs + mirror postings | `[ ] PLANNED` (partial code in `network/`) | §4.19 (FEAT-FC-NET-001…006) |
| Live e-taxes VÖEN as system-of-record | `BLOCKED` | COVERAGE FC-DH-006-ETAXES |
| e-qaimé S2S submit (DVX B2B cert) | `[s]` STUB/API behind `ERA_EQAIME_S2S_ENABLED` | COVERAGE FIN-EQAIME-01; [ADR](../../docs/adr/eqaime-s2s-submission.md) |
| e-qaimé RPA prefill + extension | `[x]` SHIPPED | COVERAGE FIN-EQAIME-02; Phase 2 |
| DVX incoming e-qaimə sync to purchase drafts | `[~]` PARTIAL | §6.1.1 Phase 3; network inbox prefill SHIPPED |
| ƏDV book + declaration UI (`/reporting/vat`) + `TaxDeclarationType.VAT` | `[x] SHIPPED` (Wave 1) | §4.7 / §6.1.1 |
| Standard GL reports (account card / turnovers / chessboard / journal) | `[x] SHIPPED` (Wave 1) | §4.7 |
| Subconto reports + flexible dimensions on journal lines | `[x] SHIPPED` (Wave 3 E4) — flag `ERA_SUBCONTO_ENABLED`; [ADR](../../docs/adr/subconto-analytical-dimensions.md) | §4.7 / FEAT-FC-COA-001 depth |
| Fiscal year balance reformation (801/802) | `[x] SHIPPED` (Wave 3 B) | §4.7 |
| Fixed asset lifecycle (modernization / revaluation / disposal) | `[x] SHIPPED` (Wave 3 E5) | §5.D |
| Intangible assets module (131/132) | `[x] SHIPPED` (Wave 3 G8) | §5.D |
| FEAT-FC-COA-001 de-hardcode + CI guard | `[x] SHIPPED` (Wave 3 A) | §4.18.3, TZ §28.3 |
| ASAN ID + HSM submission seam (`ERA_ETAXES_HSM_ENABLED`) | `[~] PARTIAL` (seam + ADR; live HSM client pending) | §6.1.1, [ADR](../../docs/adr/etaxes-hsm-asan-submission.md) |
| ƏMAS full bidirectional API | `PARTIAL` — S2S hire/transfer/terminate UI + API behind flag; Excel/RPA fallback | §13.0 Phase 3, MOD-V3-EMAS-001 |
| Profit tax (mənfəət vergisi) declaration | `[x] SHIPPED` — `/reporting/profit-tax`, `PROFIT_TAX` in tax-export | Wave 2 G1 |
| Payroll withholding declaration (PIT + DSMF) | `[x] SHIPPED` — `PAYROLL_WITHHOLDING` + preview in tax-export | Wave 2 G4/E8 |
| Tax depreciation register (fixed assets) | `[~] PARTIAL` — auto on close; UI when `taxProfile` present | Wave 2, [ADR](../../docs/adr/fixed-asset-tax-depreciation-register.md) |
| ASAN İmza / SİMA gov-payload signing | `[~]` API — mock default; live behind `ERA_ASAN_SIMA_LIVE` | Wave 4 G7; [ADR](../../docs/adr/asan-sima-gov-signature.md) |
| Statutory financial statements (MHBS forms) | `[x]` SHIPPED — `/reports/statements/*` | Wave 4 G2; [ADR](../../docs/adr/mhbs-statement-mapping.md) |
| Statistical reports | `[x]` SHIPPED engine + placeholder catalog; MoF blank verification pending | Wave 5 G3; `/reporting/statforms` |
| Payroll declarations to DSMF / e-taxes (portal export) | `[x]` file generate + HSM seam; live submit behind flags | §4.6 / Wave 2 |
| ƏDV deposit account (ƏDV depozit hesabı) | `[x]` SHIPPED — `/reporting/vat-deposit` | Wave 4 G6; [ADR](../../docs/adr/vat-deposit-routing.md) |
| NAS VAT roles 191 / 545 / 223 | `[x]` SHIPPED | Wave 4 A; COVERAGE FIN-VAT-ROLE |
| Manufacturing / IFRS tier 2+ UAT | product polish (non-blocking) | READINESS §4.3 |
| WhatsApp Business API | `[ ] PLANNED` | MOD-V4-WA-001, §6.8 |

## Verification

- Delivery count: `node scripts/delivery-readiness.mjs` → Finance **10 / 0 / 100%** (milestones only).
- i18n gate: `npm run i18n:audit` in `era-finance-core` (RU/AZ required).
- Coverage rows: [docs/COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md) — FIN-01…FIN-04, FC-FX-*, FC-DH-*, FIN-HR-*, FIN-CP-MDM-01.
- Pre-release: [docs/deploy/PRE-RELEASE-CHECKLIST.md](../docs/deploy/PRE-RELEASE-CHECKLIST.md).
