# UI Coverage Board (derived — not a fourth SSOT)

**As of:** 2026-08-18 (waves A–C snapshot)  
**Purpose:** one screen for «what is true about UI now» — join Product-Readiness UI, COVERAGE actors, and API-without-screen holes.

**Not this page:** sell / show / pilot / `ga` — still only [`*-Product-Readiness-Matrix.md`](./README.md).  
**Not this page:** Scaffold BE — still Implementation-Matrix. OPEN/TOPO BE return: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md).

**Fact sources:** [COVERAGE_MATRIX.md](../COVERAGE_MATRIX.md) (capability × actors) · Product-Readiness `## UI (short)` · LOCAL_UAT §5 modal CRUD (confirm before treating as current).

```
Ask «можно показывать / продавать?»     → Product-Readiness (UI column + Sell)
Ask «есть ли экран у API / какой класс?» → this board
Ask «SHIPPED для какого актёра?»        → COVERAGE_MATRIX
```

---

## Classes

| Class | Meaning | Paints product UI rollup? |
|-------|---------|---------------------------|
| **NONE** | Human must show/edit; API exists; no screen | **Yes** |
| **PARTIAL** | List/path exists; modal CRUD / density incomplete | **Yes** |
| **SCREEN** | Path exists; no UAT-SMOKE UI (Status often `API` + actor Y) | **Yes** |
| **SHIPPED** | Declared actor + UAT without curl | Fact on COVERAGE; not auto-SHOW |
| **SHOW** | Product-Readiness UI ✅ (lab or mvp-showable) | Product already green on UI |
| **HEADLESS** | No human show/edit by design | **No** |
| **VENDOR** | Stub / blocked vendor; screen will not close it | **No** (disclose in Sell) |

**Do not call Status=`API` «no UI»** when an actor column is Y — that is **SCREEN**.

**Close ladder:** NONE → SCREEN (page in nav + COVERAGE path) → SHIPPED (UAT-SMOKE UI) → SHOW (PRM UI ✅ + Demo/TE). SHOW ≠ Pilot ≠ `ga`.

---

## Residual register (same honesty as Green BE)

| Type | In UI rollup? | Examples |
|------|---------------|----------|
| NONE (our screen) | Yes | *(cleared 2026-08-18 — OPEN/PLACE now SCREEN)* |
| SCREEN (no UAT) | Yes | Finance tax/stat, Platform workforce |
| PARTIAL CRUD | Yes | Thin-industry admin (LOCAL_UAT §5) |
| VENDOR | No | KKM, HL7, WhatsApp, live e-taxes |
| HEADLESS | No | Workers, bank-core, Data Hub ops, bind/cfg/tenant schema |

---

## 1. Product rollup

Worst **in-scope** class (NONE < PARTIAL < SCREEN < SHIPPED < SHOW). HEADLESS / VENDOR excluded.

| Product | PRM UI | Demo / TE | UI class rollup | NONE (holes) | Notes |
|---------|--------|-----------|-----------------|--------------|-------|
| Hotel | ✅ | ✅ | **SHOW** | HOT-RPT-01/02 **SCREEN** (out of Hotel SHOW rollup) | HOT-06 **HEADLESS** (extension); KKM VENDOR; HOT-UE-01 SCREEN; HOT-CO-04 **SHIPPED** (unused-nights) |
| Bank | ✅ lab | ✅ | **SHOW** | — | BANK-REF-01 **HEADLESS** (file/env snapshot); rails VENDOR; ≠ full ABS |
| Bank DBO | ✅ lab | ✅ | **SHOW** | — | `/open-api` **SCREEN** (keys UI); AC-DBO-OPEN still Scaffold 🟡; ASAN VENDOR |
| Platform | 🟡 | 🟡 | **SCREEN** | — | Placement `/super-admin/orgs/{id}/placement` **SCREEN**; AC-CP-TOPO still Scaffold 🟡 |
| Clinic | 🟡 | 🟡 | **SCREEN** | CLI-47 TTK **SCREEN**/API (SatAdmin BOM; Finance write-off; UAT open → not SHOW) | Fiscal / HL7 VENDOR; Demo 🟡 |
| Finance | 🟡 | ❌ | **SCREEN** | — (ERP paths exist) | tax/stat/contracts/EQF = SCREEN; worker HEADLESS; e-qaimé VENDOR |
| F&B | 🟡 | 🟡 | **SCREEN** | — | Person card N/A (staff via HR); admin menu/tables/settings/daily-menu Done; KKM VENDOR |
| Retail | 🟡 | 🟡 | **SCREEN** | — | No customer `globalPersonId` SoR; admin replenishment + supplier-match/settings/stock-check done; fiscal VENDOR |
| CRM | 🟡 | 🟡 | **SCREEN** | — | Person card **Done** (Lead FIN); create-lead + import modal flows done; WA VENDOR |
| Auto | 🟡 | 🟡 | **SCREEN** | — | VÖEN legal only; no person card; admin settings + appointments + work-orders modal flows done |
| Construction | 🟡 | 🟡 | **SCREEN** | — | VÖEN legal only; project create + subcontractor claim modals done |
| Wholesale | 🟡 | 🟡 | **SCREEN** | — | VÖEN legal only; import-orders modal + pick-lists/settings done |
| Logistics | 🟡 | 🟡 | **SCREEN** | — | No person / VÖEN UI; trips create modal + detail/settings modals done |
| Data Hub | n/a | 🟡 | **HEADLESS** | — | API product; Swagger ≠ ops UI |

**Read:** most volume is SCREEN / PARTIAL, not missing pages. True curl-only holes are the NONE column.

---

## 2. Work queue (capability grain)

Only rows a human must show/edit, plus explicit by-design exclusions.

| ID | Product | Needs show/edit | API | Screen | Class | Next close | Do not confuse with |
|----|---------|-----------------|-----|--------|-------|------------|---------------------|
| AC-DBO-OPEN | Bank DBO | API keys + Open API | Y `/dbo/open/*` | `/open-api` | **SCREEN** | UAT-SMOKE UI + `dbo-open-negative.spec.ts`; Scaffold still 🟡 | DBO retail/corp already SHOW |
| CP-PLACE-01 | Platform | hop / freeze / slice | Y PlacementJob | `/super-admin/orgs/{id}/placement` | **SCREEN** | Lab hop UAT; slice dump still stub; Scaffold still 🟡 | BIND/CFG HEADLESS; not SaaS pool |
| HOT-06 | Hotel | live bridge | Y ingest + MV3 | extension options | **HEADLESS** | Owner: extension-only — no SatAdmin card | HOT-05 import SuperAdmin SHIPPED |
| BANK-REF-01 | Bank | hub catalog snapshot | Y | file/env loader | **HEADLESS** | Owner: not a cashier workflow | BK-FX teller SHIPPED |
| IND-MDM-PERSON | Thin industry | person card | CRM only | CRM Done; others N/A or legal VÖEN | **N/A** / **PARTIAL** | Re-audit 2026-08-18: do not invent person SoR | Hotel / Clinic / Finance person UI SHIPPED |
| FIN-GL-02 | Finance | manual journal voucher | Y | `/accounting/adjustments` | **SCREEN** | Lab RT: preview, PDF, reverse, copy, basis links | wave 3 UX |
| FIN-AR-CRADJ-01 | Finance | invoice credit adjustment | Y | `ViewInvoiceModal` | **SCREEN** | UAT-SMOKE § Invoice credit adjustment | not PDF credit note |
| FIN-FA-DON-01 | Finance | FA in-kind donation | Y | `/fixed-assets` lifecycle | **SCREEN** | UAT-SMOKE § FA donation | GL template hint only |
| FIN-STAT-01 | Finance | Goskomstat | Y | `/reporting/statforms` | **SCREEN** | UAT-SMOKE UI | duplicate SHIPPED row in later COVERAGE block = engine+path, still Demo ❌ |
| FIN-CTR-01 | Finance | contract limits | Y | `/contracts` | **SCREEN** | UAT-SMOKE UI | |
| FIN-PRC-01 / FIN-AP-01 | Finance | procurement / AP aging | Y | `/procurement/protocols`, `/reporting/ap-aging` | **SCREEN** | UAT-SMOKE UI | |
| FIN-EQAIME-02 / IN-01 | Finance | EQF + incoming | Y | registry / inbox | **SCREEN** | UAT-SMOKE UI | submit S2S = VENDOR/STUB |
| FIN-HR-PAY / FA / IA | Finance | payroll / FA / IA | Y | `/payroll`, `/fixed-assets`, `/intangible-assets` | **SCREEN** | UAT-SMOKE UI | |
| CP-WF-VAC/ORD/STAT/TS | Platform | vacation / orders / ştat / timesheets | Y | `/workspace/workforce/*` | **SCREEN** | UAT-SMOKE-PLATFORM | |
| CP-SA-ORGS/REF/LAND | Platform | org catalog / referrals / landing | Y | `/super-admin/*` | **SCREEN** | UAT-SMOKE | |
| CP-BILL-OWNER-01 | Platform | invoices / orders | Y | `/settings/subscription\|invoices\|orders` | **SCREEN** | UAT-SMOKE | |
| HOT-FO-03 | Hotel | shared twin assign | Y | card Assignment + `/fo/room-plan` + rack badge | **SCREEN** | UAT §30 not signed; Status=API on COVERAGE | FO SHOW rollup unchanged |
| HOT-UE-01 | Hotel | unit economics | Y | `/executive/unit-economics` | **SCREEN** | deepen + UAT | Hotel SHOW rollup unchanged (core FO SHOW) |
| HOT-RPT-01/02 | Hotel | management PDF catalog + nightly ZIP | Y | `/reports/*` hubs + cubes | **SCREEN** | W1–W3 catalog + ZIP; email cron HEADLESS; out of Hotel SHOW rollup | HOT-NA-03 ops grids already SHIPPED |
| HOT-AGP-01/02/03 | Hotel | agency portal + FO inbox | Y | `/agency/*` + `/fo/agency-inbox` | **SCREEN** | P0–P1; AC-HOT-AGP 🟡; out of Hotel SHOW rollup | ADR hotel-agency-portal |
| HOT-HK-01…05 | Hotel | Nafta HK deepen | Y | `/hk` roster rotation laundry forecast discrepancy policy | **SCREEN** | UAT-SMOKE §34 open; out of Hotel SHOW rollup | AC-HOT-HK remains Dirty/Clean/Inspected |
| BANK-GL / PAY-APPR / LOAN-* / ECL / CAP | Bank | ops lab | Y | paths Y | **SHOW** lab | field / cert is VENDOR or Pilot — not a missing screen | Inventory OUT |
| CLI-* admin/ops | Clinic | catalogs / appts / cash | Y | `/admin/*`, `/appointments`, `/cashier` | **SCREEN** | Demo/TE sign-off | Nafta 2026-06 API-only master-data is closed |
| FNB/RET/CRM/AUTO/CON/WS/LOG surfaces | Industry | POS / orders / trips | Y | routes in PRM UI (short) | **SCREEN** | thin-industry modal CRUD wave closed: all listed products now have modal CRUD/admin surfaces; do not claim SHIPPED from route alone | do not claim SHIPPED from route alone |
| CP-BIND-01 / CP-CFG-01 | Platform | no ops card | Y | SuperAdmin plumbing | **HEADLESS** | — | not a cashier screen |
| CP-TENANT-01 | All | schema | Y | — | **HEADLESS** | — | out of BE rollup |
| ORCH-MDM-HR-01 | Platform | PII in MDM | Y internal | — | **HEADLESS** | — | |
| DH-* / era-bank-core | Data Hub / Bank | no ops UI | Y | n/a | **HEADLESS** | — | |
| HOT-03/04, FNB-02, AC-RET-FISCAL, AC-CRM-WA, AC-DH-VOEN, Clinic HL7/KKM | various | field vendor | stub | stub badge | **VENDOR** | vendor program | out of that product BE rollup |

---

## How to manage (same key as Green BE)

1. **Weekly / owner:** table 1 only.  
2. **Sprint:** table 2 NONE first, then SCREEN (UAT), then PARTIAL.  
3. **Same PR** when a class changes: this board + COVERAGE row + Product-Readiness `## UI (short)` + Implementation-Matrix if AC color changes.  
4. **PRM UI column** copies sell/show honesty; it does **not** hide NONE (DBO: UI ✅ lab **and** OPEN NONE called out).  
5. **Gate:** `npm run check:acceptance` — this file must exist; each Product-Readiness must link here.  
6. **Later (optional):** route scanner (list/mutate minus `/internal`, cron, events) → page/modal in nav. Catches NONE, not SHOW.  
7. **Forbidden:** answering sell from this board; marking SCREEN as «no UI»; flipping SHOW/`ga` from SHIPPED alone; excluding NONE from rollup without an owner line here.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-22 | HOT-HK-01…05 Nafta HK deepen SCREEN (policy + needed-by); UAT §34 not signed. |
| 2026-08-20 | Clinic patient card: ICD-10 after contraindications (CLI-39 SCREEN); contraindications collapsed by default. |
| 2026-08-19 | D6 modal CRUD closeout: Logistics `/trips` create flow moved into `ModalShell`; all thin-industry PARTIAL CRUD rows cleared to SCREEN. |
| 2026-08-19 | D5 modal CRUD closeout: Wholesale import-orders create flow moved into `ModalShell`; UI class to SCREEN. |
| 2026-08-19 | D4 modal CRUD closeout: Construction `/projects` create and `/projects/[id]` subcontractor claim moved to modal flows; UI class to SCREEN. |
| 2026-08-19 | D3 modal CRUD closeout: CRM create-lead and admin import now run via `ModalShell`; UI class to SCREEN, WA vendor unchanged. |
| 2026-08-19 | D2 modal CRUD closeout: Retail admin replenishment table + supplier-match modal/i18n now SCREEN; Demo/Pilot unchanged. |
| 2026-08-19 | D1 modal CRUD closeout: F&B admin (`/admin/menu`, `/admin/tables`, `/admin/settings`, `/admin/daily-menu`) and Auto admin/ops (`/admin/settings`, `/appointments`, `/work-orders`) now SCREEN; Demo/Pilot unchanged. |
| 2026-08-19 | HOT-RPT-01/02 Management Reports W1–W3 SCREEN (out of Hotel SHOW rollup); email cron HEADLESS. |
| 2026-08-20 | HOT-AGP-01/02/03 Agency portal + FO inbox SCREEN (out of Hotel SHOW rollup); AC-HOT-AGP 🟡. |
| 2026-08-18 | Waves A–C: OPEN + Placement screens (NONE→SCREEN); HOT-06 + BANK-REF HEADLESS; MDM re-audit (CRM Done, others no person SoR); Finance/Platform UAT UI lists added — Demo unchanged. |
| 2026-08-18 | Board created. Snapshot from COVERAGE + Product-Readiness + OPEN/TOPO honesty. LOCAL_UAT MDM Missing on thin satellites marked confirm. |
