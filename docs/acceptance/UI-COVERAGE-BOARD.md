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
| Hotel | ✅ | ✅ | **SHOW** | HOT-RPT-01/02 **SCREEN** (out of Hotel SHOW rollup); HOT-REV-01 **SCREEN** (out of Hotel SHOW rollup) | HOT-06 **HEADLESS** (extension); KKM VENDOR; HOT-UE-01 SCREEN; HOT-CO-04 **SHIPPED** (unused-nights) |
| Bank | ✅ lab | ✅ | **SHOW** | — | BANK-REF-01 **HEADLESS** (file/env snapshot); rails VENDOR; ≠ full ABS |
| Bank DBO | ✅ lab | ✅ | **SHOW** | — | `/open-api` **SCREEN** (keys UI); AC-DBO-OPEN still Scaffold 🟡; ASAN VENDOR |
| Platform | 🟡 | 🟡 | **SCREEN** | — | Placement `/super-admin/orgs/{id}/placement` **SCREEN**; AC-CP-TOPO still Scaffold 🟡 |
| Clinic | 🟡 | 🟡 | **SCREEN** | CLI-10 visit CPOE + print **SHOW** (UAT punched; FHIR/whole-visit debt); CLI-47 TTK **SCREEN**/API (UAT open → not SHOW); CLI-49 physio **SCREEN** (S admin + chips + empty-catalog + rematch; UAT open); CLI-25/32/34 intake checklist + checkup print **SCREEN** (UAT open); CLI-25/48 Baku slots **SCREEN**; CLI-50 Nafta package Select + `?episode=` **SCREEN** (NONE→SCREEN Wave A); CLI-51 program quota knots `/admin/program-templates` **SCREEN** (Wave B); CLI-52 first-day confirm **SCREEN** (Wave C; no Confirm all); CLI-53 doctor bonus extras **SCREEN** (Wave D); CLI-54 multi-episode sanatorium list **SCREEN** (Wave E); CLI-55 episode-as-course card switcher + walk-in close **SCREEN** (UAT open → not SHOW); CLI-56 care team multi-doctor **SCREEN** (UAT open → not SHOW); CLI-57 package/extras assign modal **SCREEN** (UAT open → not SHOW); CLI-61 walk-in groups list+modal **SCREEN** (UAT §11a open → not SHOW); CLI-62 open attendance + SAME_DAY **SCREEN** (UAT §11b open → not SHOW); CLI-RBAC-01 `/admin/access` **SCREEN** (UAT open → not SHOW); extra tickets `/reception/extra-tickets` **SHOW** (HOT-06 extension HEADLESS; Pay path CLI-57) | Fiscal / HL7 VENDOR; Demo 🟡 |
| Finance | 🟡 | ❌ | **SCREEN** | — (ERP paths exist) | tax/stat/contracts/EQF = SCREEN; worker HEADLESS; e-qaimé VENDOR |
| F&B | 🟡 | 🟡 | **SCREEN** | — | Person card N/A (staff via HR); admin menu/tables/settings/daily-menu/buffet Done; KKM VENDOR |
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
| FIN-EMAS-01 | Finance | ƏMAS queue + convert-FIN + extension prefill | Y STUB | `/hr/emas-queue`, employee card convert-FIN | **SCREEN** | Live portal UAT open; Status=STUB | no auto-İmzala; S2S 503 |
| FIN-BOOK-MGMT-01 | Finance | MGMT labor delta | Y API | `/hr/mgmt-labor-delta` | **SCREEN** | Rebuild UI; not SHIPPED / not ga | OWNER/ADMIN/DIRECTOR |
| FIN-GL-02 | Finance | manual journal voucher | Y | `/accounting/adjustments` | **SCREEN** | Lab RT: preview, PDF, reverse, copy, basis links | wave 3 UX |
| FIN-BOOK-01 | Finance | accounting books + comparison | Y | `/accounting/books`, `/reporting/compare-books` | **SCREEN** | UAT-SMOKE § Accounting books + compare | slot upsell; arbitrary-pair mirror remains |
| FIN-AR-CRADJ-01 | Finance | invoice credit adjustment | Y | `ViewInvoiceModal` | **SCREEN** | UAT-SMOKE § Invoice credit adjustment | not PDF credit note |
| FIN-FA-DON-01 | Finance | FA in-kind donation | Y | `/fixed-assets` lifecycle | **SCREEN** | UAT-SMOKE § FA donation | GL template hint only |
| FIN-TCC-01 | Finance | trade credit lock + buyer cabinet | Y | `/crm/trade-credit`, counterparty facility (А–Г staff), `/buyer`, Orch `/buyer/login` | **SCREEN** | UAT-SMOKE § FIN-TCC; COVERAGE API until Lab RT | Phase 1 policy eng; А–Г finance-only; no Pilot |
| FIN-TCC-02 | Finance | trade credit mobile / PWA buyer | Y | `/buyer` responsive + grant QR + `/buyer/grants/:id`, notify opt-in | **SCREEN** | COVERAGE API; same SKU `trade_credit_control` | Phase 2a eng; no Pilot |
| FIN-TCC-03 | Finance | trade credit enrichment deep check | Y | facility **Deep check** panel (finance-only) | **SCREEN** | meter `TRADE_CREDIT_ENRICH`; no buyer/wholesale leak | Phase 2b eng; no Pilot |
| FIN-TCC-04 | Finance | trade credit pay-in-cabinet + factor lead | Y | `/buyer` open invoices Pay + Get paid today | **SCREEN** | SKU `trade_credit_factor_lead` referral; no GL | Phase 2c eng; no Pilot |
| FIN-TCC-05 | Finance | trade credit WC suggested limit | Y | facility suggested/proposed + kind; `/crm/trade-credit` decisions + org knobs | **SCREEN** | COVERAGE **API**; UAT-SMOKE § FIN-TCC Phase 3; no buyer leak | Phase 3 eng; no Pilot |
| FIN-EXT-01 | Finance | invoice extra fields | Y API | `/settings/extra-fields`, invoice create/view modal | **SCREEN** | COVERAGE API; not GL | W1; no Pilot |
| FIN-VIEW-01 | Finance | invoice saved views | Y API | `/sales/invoices` EraListWorkspace + EraSavedViewsBar | **SCREEN** | COVERAGE API; whitelist only | W2; no Pilot |
| FIN-PRINT-01 | Finance | commercial invoice print snapshot | Y API | `/print/invoice/:id`, ViewInvoiceModal Print, `/settings/print-placeholders` | **SCREEN** | COVERAGE API; vendor HTML; not fiscal | W3; no Pilot |
| FIN-RBAC-01 | Finance | CP JWT grant doors (no local matrix) | Y `PermissionsGuard` + `can()` | Finance ERP via `can()`; matrix = Orch `/settings/access` | **SCREEN** | AC-FIN-RBAC 🟡 out of BE rollup; UAT open → not SHOW | Wave 5 Variant A consumer |
| FIN-STAT-01 | Finance | Goskomstat | Y | `/reporting/statforms` | **SCREEN** | UAT-SMOKE UI | duplicate SHIPPED row in later COVERAGE block = engine+path, still Demo ❌ |
| FIN-CTR-01 | Finance | contract limits | Y | `/contracts` | **SCREEN** | UAT-SMOKE UI | |
| FIN-PRC-01 / FIN-AP-01 | Finance | procurement / AP aging | Y | `/procurement/protocols`, `/reporting/ap-aging` | **SCREEN** | UAT-SMOKE UI | |
| FIN-EQAIME-02 / IN-01 | Finance | EQF + incoming | Y | registry / inbox | **SCREEN** | UAT-SMOKE UI | submit S2S = VENDOR/STUB |
| FIN-TAX-SCHEME-01 | Finance | simplified-tax watcher | Y | `/reporting/tax-export`, `/admin/data/tax-schemes`, org settings regime | **SCREEN** | COVERAGE **API**; no UAT | Package apply has no screen. Guest-card tag has no new hotel screen. Does not post; not SHOW / not SHIPPED |
| FIN-EQAIME-DAY-01 | Finance | e-qaimə day-close rule | Y | org settings checkbox, `/sales/invoices` list and invoice card, hotel `/night-audit` gap list and check-day stop | **SCREEN** | COVERAGE **API**; no UAT | Does not enable S2S; not SHOW / not SHIPPED |
| FIN-FACT-QUEUE-01 | Finance | fact queue before month close | Y | `/reporting/fact-queue`, close count, period-lock date | **SCREEN** | COVERAGE **API**; no UAT | Manual journal does not clear it; not SHOW / not SHIPPED |
| FIN-PROVISIONAL-VAT-01 | Finance | provisional VAT and filed amendment | Y | `/purchases`, purchase form document number, `/sales/invoices` create, `/reporting/tax-export`, period-lock date | **SCREEN** | COVERAGE **API**; no UAT | Create lists the scheme percent. An exempt line sent to the API is refused. No cash refund; not SHOW / not SHIPPED |
| FIN-HR-PAY / FA / IA | Finance | payroll / FA / IA | Y | `/payroll`, `/fixed-assets`, `/intangible-assets` | **SCREEN** | UAT-SMOKE UI | |
| FIN-HR-MIN-01 | Finance | CP minutes → payroll premiums | Y | `/payroll` slip lines (existing) | **SCREEN** | UAT open; Status=API | Wave 11; not SHOW / not SHIPPED |
| CP-WF-SELF-01 | Platform | Employee phone cabinet | Y | `/workspace/me` + `/workspace/workforce/requests` | **SCREEN** | UAT open; Status=API | Wave 12; not SHOW / not SHIPPED |
| CP-WF-FIT-01 | Platform | Employment fitness files | Y | employments card + floor `FITNESS_ISSUE` | **SCREEN** | UAT open; Status=API | Wave 13; not SHOW / not SHIPPED |
| CP-WF-JOB-01 | Platform | Job architecture (grades/jobs, org chart, reporting, route kinds) | Y | `/workspace/workforce/job-architecture`, `/org-chart`, positions, employments (hire+card), hr-settings, org-structure | **SCREEN** | UAT open; COVERAGE **API**; AC-CP-WF-JOB 🟡; nav package `org` | no tree-depth rank; grade bands not edited; not SHOW / not SHIPPED |
| CP-WF-VAC/ORD/STAT/TS | Platform | vacation / orders / ştat / timesheets | Y | `/workspace/workforce/*` | **SCREEN** | UAT-SMOKE-PLATFORM | kit list chrome; timesheet = payroll fact vs roster plan; month grid CP master; Finance sidebar hides timesheet when CP master, direct `/hr/timesheet` is banner only; not SHOW |
| CP-WF-ATT-01 | Platform | FaceID / attendance → DRAFT | Y | `/workspace/workforce/attendance` | **SCREEN** | UAT field tablet open; Status=API | device token + rebuild; not SHOW |
| CP-WF-FLOOR-01 | Platform | Live floor + suspicious queue | Y | `/workspace/workforce/floor` | **SCREEN** | UAT open; Status=API | geofence accept; not SHOW / not SHIPPED |
| CP-WF-MIN-01 | Platform | Minute buckets on timesheet | Y | `/workspace/workforce/timesheets` read-only line | **SCREEN** | UAT open; Status=API | hours=normal only; not SHOW |
| CP-WF-EMP-01 / CP-WF-SEC-01 | Platform | employments hire/card + Login & access + security matrix/bindings | Y | `/workspace/workforce/employments`, `/security`, `/security/bindings`, `/security/audit` | **SCREEN** | UAT-SMOKE-PLATFORM | zoned hire/card `max-w-5xl` + MDM FIN search; grant-access; post-hire order bridge; per-person satellite checkboxes; uncheck/disconnect revokes linked + orphan grants for that key; matrix = position defaults; not SHOW |
| CP-ORG-PROFILE-01 | Platform | Org legal/branding profile (multi-contact, logo) | Y | `/workspace/organization` | **SCREEN** | UAT open; COVERAGE **API** | Sync `orgProfile`; Finance RO + bankLine; hotel/clinic locks; F&B/Retail `printChrome` + Outlet contacts; backfill ops; not SHOW / not SHIPPED |
| CP-WF-MIG-01 | Platform | Evrostar workforce migration wizard | Y | `/workspace/workforce/migration` | **SCREEN** | UAT open; COVERAGE **API** | nine steps + skip; not SHOW / not SHIPPED |
| CP-SA-ORGS/REF/LAND | Platform | org catalog / referrals / landing | Y | `/super-admin/*` | **SCREEN** | UAT-SMOKE | |
| CP-BILL-OWNER-01 | Platform | invoices / orders + workspace module toggles | Y | `/settings/subscription\|invoices\|orders`; `/workspace` modules modal | **SCREEN** | UAT-SMOKE-PLATFORM § E-C.7 open; Status=API | TIER_3; auto-Sync; `synced:false` on modal/workforce/connect; F&B CP-first (array required); not SHOW / not SHIPPED |
| HOT-FO-03 | Hotel | shared twin assign | Y | card Assignment + `/fo/room-plan` + rack badge | **SCREEN** | UAT §30 not signed; Status=API on COVERAGE | In-house suggestions use today (Asia/Baku) through checkout. FO SHOW rollup unchanged |
| HOT-FO-04 | Hotel | stay amendment / in-house door move | Y | card, chessboard, `/fo/room-plan` | **SCREEN** | UAT §35 not signed; Status=API on COVERAGE | Clash is today through checkout. A finished slice does not block; a confirmed tail does. Card save, Elektra, and an OTA modify move the slice plan from the first open night. No new screen. AC-HOT-AMEND stays 🟡. FO SHOW rollup unchanged |
| HOT-BOOK-04 | Hotel | reservation card IA | Y | header snapshot + Stay Details regroup | **SCREEN** | UAT open; Status=API | ADR hotel-reservation-card-and-party-ops |
| HOT-BOOK-06…09 | Hotel | card right-pane density | Y | Guests/Pricing/Folio/Notes tabs | **SCREEN** | UAT §45–§48 open | no Opera windows |
| HOT-FO-05 | Hotel | Depart guest | Y | Guests ⋮ + DepartGuestModal | **SCREEN** | UAT §43 open | stay IN_HOUSE; a closed folio on a departed guest is not recreated; stay save keeps the departure |
| HOT-FO-06/07 | Hotel | Move guest / Swap rooms | Y | move/swap APIs + StaysBar | **SCREEN** | UAT §44 open | sibling group only; move dialog copy az/ru/en |
| HOT-FO-08 | Hotel | reissue key task | Y tasks create | FO task after Depart/Move/Swap | **STUB** | no encoder hardware | — |
| HOT-HK-02 | Hotel | Roster / rotation / maids | Y | `/hk/roster` `/hk/rotation` `/hk/maids` | **SCREEN** | UAT §34 open; Status=API | Filter bar; kit table shell; Propose PRIMARY; Accrue/Swap/unlink secondary. Out of Hotel SHOW rollup |
| HOT-HK-03 | Hotel | Floor sheet + hotel cleanliness board | Y | `/hk` `/hk/rooms` `/hk/mobile` `/hk/laundry` `/fo/laundry` | **SCREEN** | UAT §34 open; Status=API | Soft sort + room#; laundry shell modal; mobile CARD_CONTAINER; money coerce; void IN_PLANT. Out of Hotel SHOW rollup |
| HOT-HK-04 | Hotel | Skip/Sleep + forecast | Y | `/hk/discrepancy` `/hk/forecast` | **SCREEN** | UAT §34 open; Status=API | Create modal + date filter; kit table shell; forecast 1/7/14/30. Out of Hotel SHOW rollup |
| HOT-HK-05 | Hotel | Linen/deep policy + stay override | Y | `/settings/policies#hk` + card Additional (edit) | **SCREEN** | UAT §34 open; Status=API | Hotel N + stay override on edit. Out of Hotel SHOW rollup |
| HOT-HK-06 | Hotel | HK consumption day document | Y | `/hk/consumption` | **SCREEN** | UAT §34.12 open; Status=API | Open/closed filter + add modal; kit table shell; not folio (vs minibar). Out of Hotel SHOW rollup |
| HOT-UE-01 | Hotel | unit economics | Y | `/executive/unit-economics` | **SCREEN** | deepen + UAT | Hotel SHOW rollup unchanged (core FO SHOW) |
| HOT-NA-01/02 | Hotel | Night audit EOD + polish checklist | Y preview `refs` + run | `/night-audit` stop-step Open reservation | **SHOW** | UAT §6 / §27.8; COVERAGE SHIPPED | Folio/price/due/arrival blockers list stay id + card; does not move Gate/Pilot/edition |
| HOT-RPT-01/02 | Hotel | management PDF catalog + nightly ZIP | Y | `/reports/*` hubs + cubes | **SCREEN** | W1–W3 catalog + ZIP; email cron HEADLESS; out of Hotel SHOW rollup | HOT-NA-03 ops grids already SHIPPED |
| HOT-AGP-01/02/03 | Hotel | agency portal + FO inbox | Y | `/agency/*` + `/fo/agency-inbox` | **SCREEN** | P0–P1; AC-HOT-AGP 🟡; out of Hotel SHOW rollup | ADR hotel-agency-portal |
| HOT-AGP-04 | Hotel | portal own CL statement | Y session ledger | `/agency/ledger` | **SHOW** | HOT-AGP-04 SHIPPED; UAT §27.12 | ADR §7 read-only |
| CLI-50 | Clinic | Nafta package Select + deep-link chart | Y lifecycle + templates | `/sanatorium` Select + `?episode=` | **SCREEN** | UAT CLI-50 open; AC-CLI-SAN-PKG 🟡 | Wave A dual-run |
| CLI-51 | Clinic | PDF quota knots + versioned entitlement editor | Y `quotaFor` / version bump + snapshot | `/admin/program-templates` blocks+vN; member picker cascaded by kind | **SCREEN** | UAT CLI-51 open; AC-CLI-SAN-QUOTA 🟡 | Wave B; open stays pinned |
| CLI-52 | Clinic | Doctor first-day confirm 2–3; no Confirm all; AFTER_CHECKUP; 4th same-day paid | Y exam-prefix + daily-cap + POST guard | `/sanatorium` + card + `/admin/settings` | **SCREEN** | UAT CLI-52 open; AC-CLI-SAN-DAY1 🟡 | Wave C; FIFO unchanged |
| CLI-53 | Clinic | Doctor bonus extras-only + origin buckets | Y `bonusEligible` + % settings; fulfillment assigned/completed | `/reports/procedures` fulfillment + doctor-bonus | **SCREEN** | UAT CLI-53 open; AC-CLI-BONUS 🟡 | Wave D |
| CLI-63 | Clinic | Paid-fact revenue by resolved code | Y `GET /api/reports/revenue` | `/reports/revenue` | **SCREEN** | UAT open; AC-CLI-REV 🟡 | No fixed article list |
| CLI-54 | Clinic | One reservation → two episodes (per pax) | Y openEpisode + patient-scoped charge; exact-name legacy reuse; depart/move by stay id | `/sanatorium` one row per episode; nationality is the 2-letter code; first care doctor; hotel checkout next to arrival | **SCREEN** | UAT CLI-54 open; AC-CLI-SAN-PAX 🟡 | Wave E; shared surname does not merge |
| CLI-55 | Clinic | Episode as care course (switcher, children, walk-in close) | Y | Y | **SCREEN** | Card CatalogField + Close + cron; UAT open → not SHOW | not CLI-54 list rows alone |
| CLI-56 | Clinic | Episode care team (multi-doctor) | Y | Y | **SCREEN** | Card identity+package+`+ Doctor`; clinical gated; UAT open → not SHOW | extends CLI-55 / assigned scope |
| CLI-57 | Clinic | Package balance assign + extras seated before pay | Y package-assign / extras-prescribe / Pay keeps cabin / OPEN unpaid day-bucket + Pay keeps pin / Saxla same-block unfinished redispatch / unpaid cancel / storno / day-end cron `UNPAID_MISSED` (today seated + overdue + unseated before today); leftover `*_POOL` off the list is not `burnPoolCode` on Save or replace | Y Plan tab, guest print, package modal № 1…N + close/cancel asks to save (blue saves and closes, gray discards and closes, question X returns); daily cap from the package cell (empty = 1), paid extras do not spend it; guest procedure print sorts by calendar date; `/reception/extra-tickets` room or name required, today-forward (no earliest-200), `DD.MM.YYYY HH:mm` + cancel; `/nurse` red block only when seated; SKU on a menu block burns that block (plus on an assigned row too), otherwise a paid extra; massage line can name one masseur; lab checkbox shows the block; over-quota lab is a cheque row only when it has a catalog price | **SCREEN** | UAT open → not SHOW; check-in stays closed until pay | ADR clinic-extra-procedure-route + clinic-episode-procedure-assign-modal |
| CLI-61 | Clinic | Walk-in groups → one hotel cashier basket | Y party/guest/line+physio/send (+`revenueCode`) + settlement notify | Y `/sanatorium/walk-in-parties` list + ModalShell; physio chips; line grid + Eye; no journal in ops modal | **SCREEN** | UAT §11a open → not SHOW; AC-CLI-WALKIN-PARTY 🟡 | ADR clinic-walk-in-party; not hotel group booking |
| CLI-62 | Clinic | Open attendance + SAME_DAY check-in + foresight | Y day-bucket pin (Saxla + `prescribeExtras` OPEN; Pay keeps pin); nurse seat; entitlement/NO_SHOW branches; foresight on calendar | Y type checkbox; plan/print label; `/nurse`; matrix foresight; settings SAME_DAY+until | **SCREEN** | UAT §11b open → not SHOW; AC-CLI-OPEN-ATTEND 🟡 | ADR clinic-open-attendance; 0 new registration doors |
| CLI-RBAC-01 | Clinic | Role×screen/API matrix + custom roles | Y ops+admin permission catalog; system seed; clone | `/admin/access` | **SCREEN** | AC-CLI-RBAC 🟡; UAT open → not SHOW | Phase A + custom roles |
| HOT-RBAC-01 | Hotel | Role×permission matrix + custom roles | Y FO/folio/HK/admin catalog; system seed; clone | `/settings/access` | **SCREEN** | AC-HOT-RBAC 🟡; UAT open → not SHOW | Variant A |
| FNB-RBAC-01 | F&B | Role×permission matrix + custom roles | Y till/KDS/admin catalog; system seed; clone; PIN bind | `/admin/access` | **SCREEN** | AC-FNB-RBAC 🟡; UAT open → not SHOW | Variant A |
| FNB-09 | F&B | Edition/presets + outlet caps + Elektra gate | Y outlets CRUD/caps/DELETE; `/select-outlet`; PIN outlet→PIN; nav `when` caps | `/select-outlet` · `/admin/settings` | **SCREEN** | UAT FB-OUTLET-01 open → not SHOW; `RESTAURANT` retired | ADR fnb-outlet-capabilities-and-gate |
| FNB-BUFFET-01 | F&B | Buffet Planner (per-outlet plans) | Y plans/lines/materials/publish/copy/templates list+modal/spawn; BuffetPageChrome; section PageHeader | `/admin/buffet/*` submenu + ModalShell | **SCREEN** | WP0–WP8 + second-pass; UAT FB-5 unsigned → not SHOW; module `fnb_buffet_planner` | Copy plan; second café via Settings outlets, not this screen |
| FNB-BUFFET-COST-01 | F&B / Finance | Buffet cost attribution (HYBRID/residual) | F&B `/admin/settings` + `/admin/buffet/*` chrome · Finance `/inventory/buffet-food-cost` | — | **SCREEN** | Waves 1–6 + Phase A–D + chef-ready + WP0–WP8 + second-pass (locale sync toasts); punchlist open/unsigned → not SHOW | [fnb-buffet-cost-attribution](../adr/fnb-buffet-cost-attribution.md) · [chef-ready backlog](../adr/fnb-buffet-chef-ready-backlog.md) |
| BANK-RBAC-01 | Bank | Role×permission matrix + custom roles | Y ops catalog; system seed; clone; BFF grant doors | `/admin/access` | **SCREEN** | AC-BNK-RBAC 🟡; UAT open → not SHOW | Variant A |
| RET-RBAC-01 | Retail | Role×permission matrix + custom roles | Y POS/shift/stock/import catalog; system seed; clone; assign | `/admin/access` | **SCREEN** | AC-RET-RBAC 🟡; UAT open → not SHOW | Variant A |
| CRM-RBAC-01 | CRM | Role×permission matrix + custom roles | Y leads/assign/import/pipeline catalog; system seed; clone; assign | `/admin/access` | **SCREEN** | AC-CRM-RBAC 🟡; UAT open → not SHOW | Variant A |
| WS-RBAC-01 | Wholesale | Role×permission matrix + custom roles | Y orders/pick/import-orders catalog; system seed; clone; assign | `/admin/access` | **SCREEN** | AC-WHS-RBAC 🟡; UAT open → not SHOW | Variant A |
| AS-RBAC-01 | Auto | Role×permission matrix + custom roles | Y work-order/appointment/vehicle/tools catalog; system seed; clone; assign | `/admin/access` | **SCREEN** | AC-AUT-RBAC 🟡; UAT open → not SHOW | Variant A |
| CN-RBAC-01 | Construction | Role×permission matrix + custom roles | Y project/BOQ/site/acts catalog; system seed; clone; assign | `/admin/access` | **SCREEN** | AC-CON-RBAC 🟡; UAT open → not SHOW | Variant A |
| LOG-RBAC-01 | Logistics | Role×permission matrix + custom roles | Y trip/fleet/hub/customs catalog; system seed; clone; assign | `/admin/access` | **SCREEN** | AC-LOG-RBAC 🟡; UAT open → not SHOW | Variant A |
| CLI-WF-PWD-01 | Clinic | Local staff change own password | Y `PATCH /api/auth/password` | `/account/password` | **SHIPPED** | UAT first login 0000 then change; SSO 403 | not CP password UI |
| HOT-PKG-02 | Hotel | Medical SKU resolve + notes | Y resolve + notes import | import wizard / notes tab | **SCREEN** | UAT §38 open; AC-HOT-PKG-NAFTA 🟡 | Wave A |
| HOT-PKG-03 | Hotel | Composed nightly sell from per-pax SKUs | Y compose + dailyRates + night audit | `/folio/[id]` packageCompose | **SCREEN** | UAT §40 open; AC-HOT-PKG-COMPOSE 🟡 | Wave D; COVERAGE API until UAT signed |
| HOT-PKG-04 | Hotel | Per-pax check-in lifecycle events | Y fan-out + `paxKey`; companion MDM id is not the primary's | FO Guests tab SKU Select | **SCREEN** | UAT §41 / punch open | Wave E + polish FO SKU |
| HOT-TOUR-01 | Hotel | Nafta weekend tours | Y | `/tours` (modals) bare `/tours/[id]/print` `/fleet` `/settings/policies#tours` | **SCREEN** | Boarding-first; grids+modals; out of SHOW | ADR hotel-guest-tours |
| HOT-XFER-01 | Hotel | Stay-linked transfers | Y | `/transfers` | **SCREEN** | Airport menu removed (`?hasFlight=1`); SHIPPED ops | HOT-XFER-01 |
| HOT-CASH-07/08 | Hotel | folio balances + folio journal | Y | `/front-cash/folio-balances` `/front-cash/folio-journal` | **SCREEN** | Balances are uncovered debt plus unused payments, not one net. UAT §42 open; Status=API | out of Hotel SHOW rollup |
| HOT-CL-06 | Hotel | Company profile + company CL statement | Y Company + ledger+lines | `/distribution/companies` + `/front-cash/company-ledger` | **SHOW** | UAT §27.11 / §42; Status=SHIPPED (COVERAGE row 2026-10-28) | Opera split; folio-only statement; Push via HOT-CL-04 |
| HOT-CL-01 | Hotel | Folio routing + room payer / gross-net | Y `roomPayer` + stay overrides | reservation card strip + Folio routing modal | **SHOW** | Status=SHIPPED; UAT §29 1a deepen open for signed artifact | ADR hotel-room-payer-and-commission-basis; Hotel SHOW rollup unchanged |
| HOT-AG-01 | Hotel | B2B sales contracts + commission % | Y `commissionBasis`; Cancel/Expire; list `companyId`; terminal allotment 400 | `/distribution/contracts` | **SHOW** | Status=SHIPPED; UAT §18 + §29 1b; icon actions; no silent party default; terminal read-only allotments | SatAdmin; Open debts SC-REST/DEP/REL |
| HOT-AG-COMM-01…04 | Hotel | Agency commission payable (AP) | Y accrue/forecast/submit/hold/release | `/distribution/agency-commission` | **SCREEN** | COVERAGE SHIPPED; Finance CP snapshots + pay batch field; UAT §27c open; AC-HOT-AG-COMM 🟡; out of SHOW until Demo/TE | ADR hotel-agency-commission-payable; not City Ledger |
| HOT-CO-05 | Hotel | Unsettled CL departures | Y list + retry invoice | `/front-cash/unsettled-departures` | **SCREEN** | UAT §27 1b; shell Front Cash + debts link; open stay → Folio card; Demo/TE not refreshed → out of Hotel SHOW rollup | ADR deferred corporate; does not move Gate/Pilot/edition |
| HOT-CL-07 | Hotel / Finance | Finance payment → hotel CL settle | Y allocate + bank match + outbox | — (Finance screens; hotel unsettled side-effect) | **HEADLESS** | COVERAGE API; UAT Finance pay → hotel SETTLED | ADR satellite-peer-url-resolution; not SHOW |
| CP-PEER-01 | Platform | S2S peer satellite base URL | Y `peer-endpoint` + kit | — | **HEADLESS** | API; no ops card | same ADR |
| HOT-AUD-01 | Hotel | Mutation audit Layer A/B | Y Layer A fail-closed CI + Layer B stay/folio + CashShift + DAY_CLOSE; Wave E compound index | `/admin/audit` + `GET /api/admin/audit` + stay journal | **SCREEN** | AC-HOT-AUD 🟡; UAT open — not SHOW / not SHIPPED; hash-chain deferred | Out of Hotel SHOW rollup; Gate/Pilot/edition unchanged |
| FNB-AUD-01 | F&B | Mutation audit Layer A/B | Y Layer A fail-closed CI + Layer B PAY/DISCOUNT/ROOM_CHARGE/DEFER_HUB/VOID + PosShift; Wave E compound index | `/admin/audit` + `GET /api/admin/audit` | **SCREEN** | AC-FNB-AUD 🟡; UAT open — not SHOW / not SHIPPED; hash-chain deferred | Does not move F&B Gate/Pilot/edition |
| CLI-19 | Clinic | Admin mutation audit journal | Y Layer A fail-closed CI + Layer B ClinicReceipt/ClinicShift; Wave E compound index | `/admin/audit` + `GET /api/admin/audit` | **SHIPPED** | Viewer SHIPPED; HTTP_MUTATION UAT open; hash-chain deferred | Does not move Clinic Demo/Pilot/Sell |
| FIN-AUD-01 | Finance | Mutation audit Layer A (Nest interceptor) | Y `AuditMutationInterceptor` + hash-chain; Wave C kit deny-list/`isAuditPiiKey` | `/admin/audit` + OWNER `/admin/security-audit` (both CatalogField + EraListFilterBar + kit DatePicker) (+ matching APIs) | **SHIPPED** | COVERAGE SHIPPED; Wave D UI parity + security-audit sibling 2026-10-29; AC-FIN-AUD 🟡 AuthZ-negatives residual | Reference Layer A; does not move Finance Demo/Pilot/Sell |
| BANK-GL / PAY-APPR / LOAN-* / ECL / CAP | Bank | ops lab | Y | paths Y | **SHOW** lab | field / cert is VENDOR or Pilot — not a missing screen | Inventory OUT |
| CLI-* admin/ops | Clinic | catalogs / appts / cash | Y | `/admin/*`, `/appointments`, `/cashier` | **SCREEN** | Demo/TE sign-off | Nafta 2026-06 API-only master-data is closed |
| FNB/RET/CRM/AUTO/CON/WS/LOG surfaces | Industry | POS / orders / trips | Y | routes in PRM UI (short) | **SCREEN** | thin-industry modal CRUD wave closed: all listed products now have modal CRUD/admin surfaces; do not claim SHIPPED from route alone | do not claim SHIPPED from route alone |
| CP-BIND-01 / CP-CFG-01 | Platform | no ops card | Y | SuperAdmin plumbing | **HEADLESS** | — | not a cashier screen |
| CP-TENANT-01 | All | schema | Y | — | **HEADLESS** | — | out of BE rollup |
| ORCH-MDM-HR-01 | Platform | PII in MDM | Y internal | — | **HEADLESS** | — | |
| DH-* / era-bank-core | Data Hub / Bank | no hub web app | Y | n/a on the hub process | **HEADLESS** | Settings screen is orchestrator, not this row | |
| DH-POL-01 | Platform | hub fetch + FX codes | Y policy API | `/super-admin/reference` | **SCREEN** | After MDM; UAT open → not SHOW / not SHIPPED | AC-DH-POL 🟡 |
| FC-REF-01 | Finance | org Excel copy | Y reference-manual | `/settings/reference-data` | **SCREEN** | Does not write the hub; UAT open → not SHOW | AC-FIN-REF out of BE rollup |
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
| 2026-10-29 | Mutation-audit Wave E second-pass: CLI-19 capability row on board (SHIPPED viewer); Evidence Wave E ≠ Scaffold; thin-sat compound deferred. Gate/Pilot/edition unchanged. |
| 2026-10-29 | Mutation-audit depth Wave E closeout: HOT-AUD-01 / FNB-AUD-01 stay **SCREEN**; CLI-19 SHIPPED; compound `(organizationId, createdAt)`; hash-chain deferred — not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-29 | Mutation-audit Wave D second-pass closeout: FIN-AUD-01 stays **SHIPPED**; OWNER `/admin/security-audit` same filter kit sibling; AC-FIN-AUD 🟡 — not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-29 | Mutation-audit depth Wave D closeout: FIN-AUD-01 stays **SHIPPED** (`/admin/audit` CatalogField + EraListFilterBar + kit DatePicker); AC-FIN-AUD 🟡 — not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-29 | Mutation-audit depth Wave B closeout: HOT-AUD-01 / FNB-AUD-01 stay **SCREEN**; CLI-19 SHIPPED; Layer B money/shift writers — not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-29 | Mutation-audit depth Wave A closeout: HOT-AUD-01 / FNB-AUD-01 stay **SCREEN**; CLI-19 SHIPPED; fail-closed CI note only. Gate/Pilot/edition unchanged. |
| 2026-10-27 | Second-pass closeout: Finance EN audit i18n + entityId filter; Clinic mutation-audit nav; classes unchanged (HOT/FNB SCREEN, FIN SHIPPED). Gate/Pilot/edition unchanged. |
| 2026-10-27 | Mutation-audit UI/API parity: Hotel/Finance paths → `/admin/audit` (+ Finance `/admin/security-audit`); classes unchanged. Gate/Pilot/edition unchanged. |
| 2026-10-27 | Mutation-audit second-pass: Clinic CLI-19 `/admin/audit` HTTP_MUTATION filter (still SHIPPED viewer / SCREEN family); HOT-AUD-01 / FNB-AUD-01 stay **SCREEN**. Gate/Pilot/edition unchanged. |
| 2026-10-28 | CP-ORG-PROFILE-01 Track C F&B/Retail receipt chrome + Outlet contact fields; UI class unchanged **SCREEN**. COVERAGE API; AC 🟡. Gate/Pilot/edition unchanged. |
| 2026-10-28 | CP-ORG-PROFILE-01 Track A dual-edit cutover (Finance RO + bankLine; hotel/clinic locks); UI class unchanged **SCREEN**. COVERAGE API; AC 🟡. Gate/Pilot/edition unchanged. |
| 2026-10-28 | CP-ORG-PROFILE-01 Track B backfill ops script (Finance→orch); UI class unchanged **SCREEN**. COVERAGE API; AC 🟡. Gate/Pilot/edition unchanged. |
| 2026-10-27 | CP-ORG-PROFILE-01 **SCREEN** second-pass: Finance Nest `orgProfile` cache; hotel CP contacts; CatalogField kinds. COVERAGE API; AC 🟡. Gate/Pilot/edition unchanged. |
| 2026-10-27 | CP-ORG-PROFILE-01 **SCREEN** `/workspace/organization`; COVERAGE API; AC 🟡 out of BE rollup. Gate/Pilot/edition unchanged. |
| 2026-10-27 | CP-ORG-PROFILE-01 **NONE** → SCREEN same day (OrgOwner card landed). Gate/Pilot/edition unchanged. |
| 2026-10-27 | Belt closeout: HOT-AUD-01 API note on board (`jsonOk` Layer A); FNB-AUD-01 **SCREEN**; FIN-AUD-01 **SHIPPED**. Gate/Pilot/edition unchanged. |
| 2026-10-27 | Layer A belt: FNB-AUD-01 **NONE→SCREEN** (`/admin/audit`); HOT-AUD-01 / FIN-AUD-01 unchanged classes. Gate/Pilot/edition unchanged. |
| 2026-10-27 | Closeout sync: FNB-AUD-01 **NONE**; FIN-AUD-01 **SHIPPED**; HOT-AUD-01 **SCREEN**. Gate/Pilot/edition unchanged. |
| 2026-10-27 | HOT-AUD-01 / FNB-AUD-01 audit tracking; FIN-AUD-01 Finance belt **SHIPPED** as Layer A reference. Hotel `/settings/audit` stays **SCREEN** until belt + UAT. |
| 2026-10-27 | HOT-AUD-01 mutation audit **SCREEN** (`/settings/audit` + stay journal). Ecosystem ADR Accepted; Layer A belt not landed — not SHOW / not SHIPPED. |
| 2026-10-30 | FNB-BUFFET-COST-01 Hotel/HR S2S — Settings Finance URL only; guest-nights peer + hub org; stays **SCREEN**; not SHOW. |
| 2026-10-29 | FNB-BUFFET-01 / COST-01 UI playbook pass — stays **SCREEN** (PageHeader.actions, nav collapse, composition modal, Settings integration URLs); UAT/punchlist unsigned; not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-BUFFET-01 / COST-01 / FNB-09 WP0–WP8 tail — UI stays **SCREEN** (modal kind, Spawn-free, Nöqtə); staging NAFTANI rename (data); not SHOW. Gate/sell unchanged. Droplet image deploy still open. |
| 2026-10-29 | FNB-BUFFET-01 / COST-01 WP0–WP8 second-pass — UI stays **SCREEN** (locale sync toasts, section titles, chef copy); UAT/punchlist unsigned; not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-BUFFET-01 / COST-01 WP0–WP8 chef product — UI stays **SCREEN** (chrome/i18n/templates/accordion/sync honesty); UAT/punchlist unsigned; not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-09 second-pass — Floor till-only switcher + Buffet cap filter; UAT FB-OUTLET-01; UI stays **SCREEN**; Gate/sell unchanged. |
| 2026-10-29 | FNB-09 outlet caps + Elektra `/select-outlet` — UI **SCREEN** (caps/DELETE Settings; PIN outlet→PIN; nav by caps); `RESTAURANT` retired; not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-BUFFET-01 / COST-01 chef UX wave — UI stays **SCREEN** (submenu, spawn/kind, hotel pax, eaters grid, Proqnoz/Normalar/Cost-run); not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-BUFFET-COST-01 chef-ready polish — UI stays **SCREEN** (B3/B5/B6 + C honesty/GT/OFF/NAFTANI/recipeSku/FOOD filter); not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-BUFFET-COST-01 chef-ready WO1–10 — UI stays **SCREEN** (Forecast/outlet CatalogField, staff auto, Print, variance CTAs); punchlist blocked; not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-BUFFET-COST-01 Phase D second-pass — UI stays **SCREEN**; seed honesty (Non-FOOD fact / ISSUES_ONLY); not SHOW. Gate/sell unchanged. |
| 2026-10-29 | FNB-BUFFET-COST-01 Phase D lab seed — UI stays **SCREEN**; unsigned lab signoff only; not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Phase C second-pass — UI stays **SCREEN**; Finance PRM + handoff field labels; not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Phase C Finance polish — UI stays **SCREEN** (kit Field, bucket cards, Non-FOOD, WH CatalogField); not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Phase B second-pass — UI stays **SCREEN**; chefWarning i18n + model label; not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Phase B chef UX — UI stays **SCREEN** (Forecast form, Staff honesty, rollup card, Cost run console); not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Phase A second-pass — UI stays **SCREEN**; Wave 5 UAT prefers handoff; not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Phase A handoff — UI stays **SCREEN** (Cost run Open Finance HYBRID + Finance autofill); not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Wave 6 closeout — UI stays **SCREEN** (Forecast + Non-FOOD budget); not SHOW. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Wave 6 Forecast pack + non-FOOD budget → UI **SCREEN** F&B Forecast tab + Finance Non-FOOD budget tab. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Wave 5 Finance HYBRID FOOD cost run → UI **SCREEN** `/inventory/buffet-food-cost` + F&B deep-link. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Wave 4 COMP/zero-price → UI **SCREEN** Cost run tab (`pos.compAttributedAzn`); Finance HYBRID report still NONE. Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Wave 3 staff meals + overlap → UI **SCREEN** Staff tab (cost run still NONE). Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Wave 2 template + management meals → UI **SCREEN** on `/admin/buffet` tabs (cost run still NONE). Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 Wave 1 settings → UI **SCREEN** on `/admin/settings` (cost run still NONE). Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-COST-01 ADR decision → UI **NONE** (cost run not built). Gate/sell unchanged. |
| 2026-10-28 | FNB-BUFFET-01 UX: master Plans + composition/copy; FNB-09 Settings outlet create (menu/halls/tables copy). SCREEN; UAT FB-5 / FB-OUTLET-01 open — not SHOW. |
| 2026-10-27 | FNB-BUFFET-01 Buffet Planner `/admin/buffet` **SCREEN** (module `fnb_buffet_planner`); UAT FB-5 open — not SHOW. |
| 2026-10-27 | HOT-TOUR-01 UX: list+roster/edit modals, bare print+letterhead, icon toolbar — still **SCREEN**. HOT-XFER-01 Airport fold. Out of SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-27 | HOT-TOUR-01 boarding-first + policy settings **SCREEN**; HOT-XFER-01 Airport folded to `?hasFlight=1` **SCREEN**. Out of Hotel SHOW rollup. Gate/Pilot/edition unchanged. |
| 2026-10-27 | HOT-CL-07 / CP-PEER-01 **HEADLESS** — Finance→Hotel payment-applied + peer URL SoR. No hotel screen; Gate/Pilot/edition unchanged. |
| 2026-10-27 | HOT-CO-05 unsettled CL **SCREEN** — HotelOpsShell + debts link + Folio-tab card. Out of Hotel SHOW rollup. COVERAGE SHIPPED OpsUI. Gate/Pilot/edition unchanged. |
| 2026-10-31 | Clinic list nationality code, first doctor, hotel checkout (CLI-54 still **SCREEN**). Paid lab over quota is a cheque row only with a catalog price; in-quota lab stays a lab order (CLI-57 still **SCREEN**). Gate/Pilot/edition unchanged. |
| 2026-10-31 | Clinic CLI-57 massage line can name one masseur — still **SCREEN**; not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-30 | Clinic #378/#379: package-assign save-ask (blue/gray) + extra-tickets room/name + today-forward + print/card `дд.мм.гггг` — CLI-57 still **SCREEN**; not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-30 | Clinic second-pass closeout: Pay keeps OPEN day-bucket; arrival sort; home range i18n — CLI-57/62 still **SCREEN**; not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-30 | Clinic package/OPEN/home/reports deepen: CLI-57/62 stay **SCREEN** (Saxla redispatch + OPEN extras day-bucket + modal №); `/sanatorium` arrival + home range + diagnoses Fəsil CatalogField under SHIPPED/SCREEN deepen — not SHOW. Gate/Pilot/edition unchanged. |
| 2026-10-29 | CLI-26 deepen closeout: `/sanatorium/resources` modal Check-in + nurse unpaid→Late; still under SHIPPED day-ops (not a new SHOW claim). Gate/Pilot/edition unchanged. |
| 2026-10-29 | CLI-62 closeout second-pass: still **SCREEN** (DnD/plan/SAME_DAY cabin refuses documented); UAT §11b open → not SHOW; Gate/Pilot/edition unchanged. |
| 2026-10-28 | CLI-62 open attendance + SAME_DAY + foresight **SCREEN**; UAT §11b open → not SHOW; AC-CLI-OPEN-ATTEND 🟡. Gate/Pilot/edition unchanged. |
| 2026-10-28 | CLI-61 / HOT-CASH-02 / HOT-NA-01: pending `revenueCode` Zod+heal; NA blank-pending fail (no `UNKNOWN`). CLI-61 **SCREEN**; HOT-CASH-02/NA SHIPPED deepen. Gate/Pilot/edition unchanged. |
| 2026-10-28 | CLI-61 / HOT-CASH-02: clinic walk-in+extras pending stamp `revenueCode`; hub refuses blank. CLI-61 stays **SCREEN**; HOT-CASH-02 SHIPPED deepen. Gate/Pilot/edition unchanged. |
| 2026-10-28 | HOT-NA-01/02 stop-step reservation refs + Open card on `/night-audit`. Stays **SHOW** / SHIPPED. Gate/Pilot/edition unchanged. |
| 2026-10-28 | HOT-CASH-02 pending receipt modal + shared `ensureOpenCashShift` (folio/pending). Cash/CL stays **SHOW** / SHIPPED. Gate/Pilot/edition unchanged. |
| 2026-10-28 | HK kit table/card shell tokens (`DATA_TABLE_SHELL` / `CARD_CONTAINER`) on secondary HK screens (+ consumption). HOT-HK-01…04/06 stay **SCREEN**/API. Not SHOW / not SHIPPED. Gate/Pilot/edition unchanged. |
| 2026-10-27 | HK playbook/i18n: filter+grid+modal across discrepancy/closed/forecast/roster/rotation/minibar/consumption/stock; laundry money coerce. HOT-HK-01…06 stay **SCREEN**/API. Not SHOW / not SHIPPED. Gate/Pilot/edition unchanged. |
| 2026-10-27 | HK second-pass: void IN_PLANT on laundry grids; express % on amount; stay linen edit-only. HOT-HK-03/05 stay **SCREEN**. Not SHOW / not SHIPPED. |
| 2026-10-27 | HK audit wave: soft sort+room#, checkout laundry void+retry, FO amount, stay linen, maids edit/unlink, discrepancy create. HOT-HK-* stay **SCREEN**. Not SHOW / not SHIPPED. |
| 2026-10-27 | HK sheet/rooms polish + laundry intake preview + checkout `LAUNDRY_OPEN` keeps dialog. HOT-HK-03 stays **SCREEN**. Not SHOW / not SHIPPED. |
| 2026-10-27 | HK sidebar groups (staff / minibar / guest services), secondary HK empty-state chrome, maids picker org-unit + position. HOT-HK-* stay **SCREEN**. Not SHOW / not SHIPPED. |
| 2026-10-27 | HOT-HK-03 stays **SCREEN**. Archive dates are read-only; PDF is the open date and floor. Not SHOW / not SHIPPED. Hotel SHOW rollup unchanged. |
| 2026-10-27 | HOT-FO-04 stays **SCREEN**. Card save, Elektra, and an OTA modify move the slice plan from the first open night. No new screen. AC-HOT-AMEND stays 🟡. Hotel SHOW rollup unchanged. |
| 2026-10-27 | HOT-AG-01 second-pass terminal allotments read-only — stays **SHOW** / SHIPPED. Gate/Pilot/edition unchanged. |
| 2026-10-27 | HOT-AG-01 contracts UI honesty (icon actions, explicit party type, Cancel/Expire) — stays **SHOW** / SHIPPED. Open debts SC-REST/DEP/REL. Hotel SHOW rollup / Gate / Pilot / edition unchanged. |
| 2026-10-29 | HOT-CASH-01 folio polish shipped #368/#369 + staging Otaq/Tibbi paket + PKG desc cleanup — Cash/CL stays **SHOW**; HOT-FOLIO-DESK API/SCREEN until UAT. Gate / Pilot / edition unchanged. |
| 2026-10-29 | HOT-CASH-01 folio polish second-pass (Bu sətri ödə GUEST-only; PKG Təsvir i18n) — Cash/CL stays **SHOW**; HOT-FOLIO-DESK API/SCREEN until UAT. Gate / Pilot / edition unchanged. |
| 2026-10-29 | HOT-CASH-01 folio UI polish (drop Sətir; Debit\|Credit wash; Bu sətri ödə; EraMenu portal; short labels) — Cash/CL stays **SHOW**; HOT-FOLIO-DESK API/SCREEN until UAT. Gate / Pilot / edition unchanged. |
| 2026-10-29 | HOT-REV-01 SatAdmin master-data `allowManualCharge`/`allowManualPayment` toggles (second-pass); HOT-CASH-01 Extra charge/pay flag gates — Cash/CL **SHOW**; HOT-FOLIO-DESK / HOT-REV-01 API/SCREEN. Gate / Pilot / edition unchanged. |
| 2026-10-29 | HOT-CASH-01 Debit\|Credit ledger + stay-wide lodging Accept payment; HOT-REV-01 Nafta v2 catalog/remap scripts — Cash/CL stays **SHOW**; HOT-FOLIO-DESK / HOT-REV-01 remain API/SCREEN until UAT. Gate / Pilot / edition unchanged. |
| 2026-10-27 | HOT-CASH-01/04 ledger signs + open-debt payment gate (card folio) — Cash/CL stays **SHOW**; HOT-FOLIO-DESK remains API/SCREEN until UAT. Gate / Pilot / edition unchanged. |
| 2026-10-27 | HOT-CL-01 room payer / gross-net **SHOW** (card strip); HOT-AG-01 contracts at `/distribution/contracts` **SHOW**. Hotel SHOW rollup / Gate / Pilot / edition unchanged. |
| 2026-10-26 | HOT-FO-04 stays **SCREEN**. Saving dates clamps the room-plan bar to the header checkout. No new screen. AC-HOT-AMEND stays 🟡. Hotel SHOW rollup unchanged. |
| 2026-10-26 | HOT-HK-03 floor sheet + `/hk/rooms` **SCREEN** (shared cleanliness pill). UAT §34 open. Not SHOW / not SHIPPED. Hotel SHOW rollup unchanged. |
| 2026-10-25 | HOT-FO-04 stay amendment **SCREEN** (card, chessboard, room plan). In-house door clash is today (Asia/Baku) through checkout. HOT-FO-03 suggestions use that window. Both stay API. AC-HOT-AMEND stays 🟡. Gate, Pilot, and edition unchanged. |
| 2026-10-30 | CP-WF-JOB-01 job architecture **SCREEN** (`/job-architecture`, `/org-chart` + positions/employments/hr-settings/org-structure deepen); COVERAGE Status=API; AC-CP-WF-JOB 🟡 out of BE rollup. Not SHOW / not SHIPPED. Gate / Pilot / edition unchanged. |
| 2026-09-30 | CP-WF-FIT-01 fitness files **SCREEN** (employments + floor); COVERAGE Status=API. Not SHOW / not SHIPPED. |
| 2026-09-30 | CP-WF-SELF-01 employee cabinet **SCREEN** (`/workspace/me` + requests); COVERAGE Status=API. Not SHOW / not SHIPPED. |
| 2026-09-30 | FIN-HR-MIN-01 CP minutes → payroll premiums **SCREEN** (existing `/payroll` slip); COVERAGE Status=API. Not SHOW / not SHIPPED. |
| 2026-09-30 | CP-WF-MIN-01 minute buckets **SCREEN** (read-only timesheet line); COVERAGE Status=API. Not SHOW / not SHIPPED. |
| 2026-09-30 | CP-WF-FLOOR-01 live floor **SCREEN** (`/workspace/workforce/floor`); COVERAGE Status=API. Not SHOW / not SHIPPED. |
| 2026-09-24 | CP-WF-MIG-01 migration wizard **SCREEN** (`/workspace/workforce/migration`); COVERAGE Status=API. Class stays **SCREEN** (not SHOW / not SHIPPED). |
| 2026-09-24 | CP-WF-ROSTER-01 brigades transfer + history **SCREEN** (`/workspace/workforce/shifts/brigades`); dated membership API landed. Class stays **SCREEN** (not SHOW / not SHIPPED). |
| 2026-10-23 | DH-POL-01 SuperAdmin `/super-admin/reference` and FC-REF-01 `/settings/reference-data` **SCREEN** (UAT open, not SHOW, not SHIPPED). Data Hub process stays HEADLESS. AC-DH-POL Scaffold 🟡. Edition `mvp`, `pilot_ready: false`. |
| 2026-09-23 | Platform Workforce lists: EraListWorkspace/EraDataGrid fill + empty row; ModalShell footer stripe removed; roster vs timesheet copy. Class stays **SCREEN** (not SHOW / not SHIPPED). |
| 2026-09-21 | Platform Workforce UI hygiene: nested shifts/attendance SCREENs; employments server q; modals for import/bulk/materialize; Status=API (not SHOW / not SHIPPED). |
| 2026-10-04 | RET-RBAC-01, CRM-RBAC-01, WS-RBAC-01, AS-RBAC-01, CN-RBAC-01, LOG-RBAC-01 Variant A access matrix `/admin/access` **SCREEN** (not SHOW); AC-*-RBAC out of BE rollup; UAT open. |
| 2026-09-20 | BANK-RBAC-01 Bank Variant A ops matrix **SCREEN** (not SHOW); AC-BNK-RBAC out of BE rollup. |
| 2026-09-18 | FIN-RBAC-01 Finance Wave 5 CP grant doors **SCREEN** (not SHOW); AC-FIN-RBAC out of BE rollup. |
| 2026-09-18 | P2 density: FIN-EMAS / roster / orders / group dual-VÖEN copy+preview stay **SCREEN** (not SHIPPED); Demo/Pilot unchanged. |
| 2026-09-18 | P1 operator gaps: FIN-EMAS-01 / CP-WF-ATT-01 / CP-WF-SEC audit stay **SCREEN** (not SHIPPED); queue/attendance/audit label polish; group→Finance handoff. Demo/Pilot unchanged. |
| 2026-09-17 | Platform CP-WF-ATT-01 attendance FaceID **SCREEN** (`/workspace/workforce/attendance`); COVERAGE Status=API until field tablet UAT. |
| 2026-09-07 | Platform public IA: guest `/` hub + `/satellites/[slug]` + `/pricing` catalog/meters (SCREEN marketing, not SHOW). |
| 2026-10-29 | HOT-AG-COMM-01…04 agency commission hub **SCREEN** (`/distribution/agency-commission`); out of Hotel SHOW until Demo/TE; Gate/Pilot unchanged. |
| 2026-10-28 | HOT-CL-06 restored on COVERAGE_MATRIX (folio-only honesty); UI class SHOW unchanged; no Gate/Pilot/edition move. |
| 2026-09-07 | HOT-CL-06 + HOT-AGP-04 statement SHOW; company CL SHIPPED with line statement. |
| 2026-09-07 | HOT-CL-06 company CL moved to own `/front-cash/company-ledger` (Opera IA split from agency-ledger tabs). |
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
