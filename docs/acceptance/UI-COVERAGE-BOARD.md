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
| Clinic | 🟡 | 🟡 | **SCREEN** | CLI-47 TTK **SCREEN**/API (UAT open → not SHOW); CLI-49 physio **SCREEN** (S admin + chips + empty-catalog + rematch; UAT open); CLI-25/32/34 intake checklist + checkup print **SCREEN** (UAT open); CLI-25/48 Baku slots **SCREEN**; CLI-50 Nafta package Select + `?episode=` **SCREEN** (NONE→SCREEN Wave A); CLI-51 program quota knots `/admin/templates` **SCREEN** (Wave B); CLI-52 first-day confirm **SCREEN** (Wave C; no Confirm all); CLI-53 doctor bonus extras **SCREEN** (Wave D); CLI-54 multi-episode sanatorium list **SCREEN** (Wave E); CLI-55 episode-as-course card switcher + walk-in close **SCREEN** (UAT open → not SHOW); extra tickets `/reception/extra-tickets` **SHOW** (HOT-06 extension HEADLESS) | Fiscal / HL7 VENDOR; Demo 🟡 |
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
| CP-PLACE-01 | Platform | hop / freeze / slice | Y PlacementJob | `/super-admin/orgs/{id}/placement` | **SCREEN** | Wave 7 lab hop + Wave 11 hotel JSON slice; host restore still open; Scaffold still 🟡 | BIND/CFG HEADLESS; not SaaS pool |
| HOT-06 | Hotel | live bridge | Y ingest + MV3 outbox | extension **settings** HEADLESS; clinic `/reception/extra-tickets` **SHOW** (Wave 6 lab); Super-Admin org hub policy **SHOW** (Wave 6 lab) | **HEADLESS** (extension write) | Field UAT of SPA Insert before SHIPPED; do not claim SHIPPED/`ga` | HOT-05 import SuperAdmin SHIPPED |
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
| CP-WF-VAC/ORD/STAT/TS | Platform | vacation / orders / ştat / timesheets | Y | `/workspace/workforce/*` | **SCREEN** | UAT-SMOKE-PLATFORM | month grid CP master; Finance UI link-only; status gates; not SHOW |
| CP-SA-ORGS/REF/LAND | Platform | org catalog / referrals / landing | Y | `/super-admin/*` | **SCREEN** | UAT-SMOKE | |
| CP-BILL-OWNER-01 | Platform | invoices / orders | Y | `/settings/subscription\|invoices\|orders` | **SCREEN** | UAT-SMOKE | |
| HOT-FO-03 | Hotel | shared twin assign | Y | card Assignment + `/fo/room-plan` + rack badge | **SCREEN** | UAT §30 not signed; Status=API on COVERAGE | FO SHOW rollup unchanged |
| HOT-UE-01 | Hotel | unit economics | Y | `/executive/unit-economics` | **SCREEN** | deepen + UAT | Hotel SHOW rollup unchanged (core FO SHOW) |
| HOT-RPT-01/02 | Hotel | management PDF catalog + nightly ZIP | Y | `/reports/*` hubs + cubes | **SCREEN** | W1–W3 catalog + ZIP; email cron HEADLESS; out of Hotel SHOW rollup | HOT-NA-03 ops grids already SHIPPED |
| HOT-AGP-01/02/03 | Hotel | agency portal + FO inbox | Y | `/agency/*` + `/fo/agency-inbox` | **SCREEN** | P0–P1; AC-HOT-AGP 🟡; out of Hotel SHOW rollup | ADR hotel-agency-portal |
| CLI-50 | Clinic | Nafta package Select + deep-link chart | Y lifecycle + templates | `/sanatorium` Select + `?episode=` | **SCREEN** | UAT CLI-50 open; AC-CLI-SAN-PKG 🟡 | Wave A dual-run |
| CLI-51 | Clinic | PDF quota knots + template editor | Y `quotaFor` / recalc | `/admin/templates` program knots | **SCREEN** | UAT CLI-51 open; AC-CLI-SAN-QUOTA 🟡 | Wave B |
| CLI-52 | Clinic | Doctor first-day confirm 2–3; no Confirm all; AFTER_CHECKUP; 4th same-day paid | Y exam-prefix + daily-cap + POST guard | `/sanatorium` + card + `/admin/settings` | **SCREEN** | UAT CLI-52 open; AC-CLI-SAN-DAY1 🟡 | Wave C; FIFO unchanged |
| CLI-53 | Clinic | Doctor bonus extras-only + origin buckets | Y `bonusEligible` + % settings | `/reports/procedures` doctor-bonus | **SCREEN** | UAT CLI-53 open; AC-CLI-BONUS 🟡 | Wave D |
| CLI-54 | Clinic | One reservation → two episodes (per pax) | Y openEpisode + patient-scoped charge | `/sanatorium` one row per episode | **SCREEN** | UAT CLI-54 open; AC-CLI-SAN-PAX 🟡 | Wave E |
| CLI-55 | Clinic | Episode as care course (switcher, children, walk-in close) | Y | Y | **SCREEN** | Card CatalogField + Close + cron; UAT open → not SHOW | not CLI-54 list rows alone |
| CLI-WF-PWD-01 | Clinic | Local staff change own password | Y `PATCH /api/auth/password` | `/account/password` | **SHIPPED** | UAT first login 0000 then change; SSO 403 | not CP password UI |
| HOT-PKG-02 | Hotel | Medical SKU resolve + notes | Y resolve + notes import | import wizard / notes tab | **SCREEN** | UAT §38 open; AC-HOT-PKG-NAFTA 🟡 | Wave A |
| HOT-PKG-03 | Hotel | Composed nightly sell from per-pax SKUs | Y compose + dailyRates + night audit | `/folio/[id]` packageCompose | **SCREEN** | UAT §40 open; AC-HOT-PKG-COMPOSE 🟡 | Wave D; COVERAGE API until UAT signed |
| HOT-PKG-04 | Hotel | Per-pax check-in lifecycle events | Y fan-out + `paxKey` | FO Guests tab SKU Select | **SCREEN** | UAT §41 / punch open | Wave E + polish FO SKU |
| HOT-TOUR-01 | Hotel | Nafta weekend tours | Y | `/tours` `/tours/[id]/print` `/fleet` | **SCREEN** | Out of Hotel SHOW rollup (no Demo/TE); SHIPPED ops | ADR hotel-guest-tours |
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
| 2026-08-31 | Clinic CLI-WF-PWD-01 local password self-service SHIPPED (`/account/password`). Hotel/F&B STAFF_PROVISIONED User hash aligned to scrypt. |
| 2026-08-30 | Clinic Nafta card wave SCREEN: intake checklist (`PKG-NAFTA-INTAKE`), physio empty-catalog/Solyuks, Baku `#23` clock — UAT open; not SHOW / not GA. |
| 2026-08-23 | HOT-TOUR-01 guest tours SHIPPED as SCREEN (`/tours` + `/fleet`); still out of Hotel SHOW rollup. |
| 2026-08-27 | HOT-06 outbox drain + clinic `/reception/extra-tickets` SCREEN (dual-run). Hotel write remains HEADLESS (extension). Reverse folio ADR accepted. |
| 2026-08-28 | SaaS Wave 6: HOT-06 lab — SuperAdmin EW policy + clinic Issue-ticket **SHOW**; extension SPA Insert still HEADLESS; not SHIPPED. |
| 2026-08-28 | SaaS Wave 7: Placement lab hop CI (SHARED→DEDICATED advance); CP-PLACE SCREEN; AC-CP-TOPO still 🟡. |
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
