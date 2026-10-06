# ERA ecosystem — coverage matrix (Doc / API / UI / actors)

Living matrix for **honest readiness** of capabilities (Doc/API/UI × actors). Replaces optimistic DELIVERY-only summaries.

**Product sell/show / pilot:** [`docs/acceptance/`](./acceptance/README.md) Product-Readiness matrices + [`docs/editions/`](./editions/) — see [ERA-Acceptance-Standard](./products/ERA-Acceptance-Standard.md).  
**Engineering API/DELIVERY %:** [READINESS_MATRIX.md](./READINESS_MATRIX.md).

**Related:** [READINESS_MATRIX.md](./READINESS_MATRIX.md) · [NAFTA_DOC_API_UI_AUDIT.md](./NAFTA_DOC_API_UI_AUDIT.md) · [UI_PLAYBOOK_SATELLITES.md](./UI_PLAYBOOK_SATELLITES.md) · [LOCAL_UAT_GAP_CHECKLIST.md](./LOCAL_UAT_GAP_CHECKLIST.md)

**Last updated:** 2026-08-31

---

## Status taxonomy

| Status | Meaning | DELIVERY tag |
|--------|---------|--------------|
| **SHIPPED** | Doc + API + UI for declared actor(s) + UAT path without curl | `[x]` |
| **API** | Backend only; operator UI deferred | `[~]` |
| **STUB** | Mock / vendor pending | `[s]` |
| **HEADLESS** | By design (workers, webhooks) | `[h]` + ADR |
| **BLOCKED** | External dependency | `[ ]` + blocker ID |
| **N/A** | Architecture exclusion | omit from denominator |

**Rule:** DELIVERY `[x]` only when status = **SHIPPED** or documented **HEADLESS**. Stub/API rows use `[~]` / `[s]` / `[h]`.

---

## Actor columns

| Column | Who | Examples |
|--------|-----|----------|
| **OpsUI** | Local RBAC staff | `/login`, reception, floor, doctor queue |
| **SatAdmin** | Satellite admin | `/admin/*`, `CLINIC_ADMIN`, `Hotel_Admin` |
| **OrgOwner** | SSO owner | `/workspace`, Home `/` executive block, `BUSINESS_OWNER` |
| **SuperAdmin** | Platform super-admin | Orch `/super-admin/*`, hotel `/admin/import` |

Cell values: **Y** = screen/path exists · **—** = not applicable · **N** = gap

---

## era-clinic (`CLI-*`)

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | Status | Blocker |
|----|------------|-----|-----|-------|----------|----------|------------|--------|---------|
| CLI-01 | Practitioners ops catalog (specialty, slots) | PRD M2 | Y | — | Y `/admin/master-data` | — | — | SHIPPED | Ops edit only; hire via CP Workforce. Reception/admin (staffKind NONE) are not practitioner rows. Inactive staff hidden unless the list filter is on. |
| CLI-WF-01 | Practitioner hire (CP workforce → provision) | ADR cp-core-workforce-hub | Y CP hire + STAFF_PROVISIONED | — | — | Y (payroll mirror optional) | — | SHIPPED | UAT: Workspace hire → clinic DOCTOR login |
| CLI-WF-PWD-01 | Clinic local staff change own password | ADR workforce-identity | Y `PATCH /api/auth/password` | Y `/account/password` | — | — | — | SHIPPED | First login PIN `0000`; SSO accounts 403 |
| CLI-RBAC-01 | Configurable role×screen matrix (Variant A) | ADR clinic-domain-permissions-and-rbac | Y full staff+admin API catalog (`opsApiRoutePermission` + `adminApiRoutePermission`); refresh-permissions; gap-closeout orphans; `scope:episodes.all` / `scope:lab_orders.all` row filters | Y hide screen → API 403; doctor without scope → assigned rows only | Y `/admin/access`; CLINIC_ADMIN matrix binds screens + scope | — | — | SHIPPED | Phase A Waves 1–3 + gap closeout + data-scope layer; AC-CLI-RBAC 🟡 until field UAT; Reset defaults after upgrade if matrix customized |
| CP-WF-HUB-01 | CP Workforce hub end-to-end (hire, org, absence, security) | ADR | Y | — | — | Y `/workspace/workforce/*` | Y | SHIPPED | Plan E clean cutover |
| CP-WF-EXP-01 | Workforce CSV export (roster, absences, timesheet) | ADR F1 | Y | — | — | Y `/workspace/workforce/export` | — | SHIPPED | No FIN in default CSV |
| CP-WF-IMP-01 | Workforce CSV/xlsx import (roster, absences, org-structure) | ADR F1 | Y dry-run + apply | — | — | Y `/workspace/workforce/export` + `/workspace/workforce/org-structure` | — | SHIPPED | xlsx or CSV; empty satellites = no seat; org-structure before roster |
| CP-WF-SEAT-01 | Unified seat licensing + Security Admin widget | ADR F4 | Y | — | — | Y `/workspace/workforce/security` | — | SHIPPED | One seat per person; empty hire satellites = headcount, not a seat |
| CLI-02 | Rooms master | PRD M2 | Y | — | Y | — | — | SHIPPED | — |
| CLI-03 | Resources (equipment) | vNext | Y | — | Y | — | — | SHIPPED | — |
| CLI-04 | Procedure types | vNext | Y | — | Y Add+Edit reqs (resource + STAFF mode) | — | — | SHIPPED | Backfill missing requirements on SatAdmin list |
| CLI-05 | Appointment create + practitioner day matrix | PRD K-01 / Pattern B | Y calendar + create/reschedule/cancel/check-in | Y `/appointments` matrix (rows=doctors) | — | — | — | SHIPPED | Legacy `/scheduling` + `/api/scheduling/slots` removed |
| CLI-06 | Patient registry (M1) | PRD | Y paginated filters; clinic-native `P-######` refCode; Ad/Soyad/Ata adı; default ALL + `hasOpenEpisode` | Y `/patients` identity grid + Open badge; room/program on `/sanatorium`; reception hides MDM column/filter; sex K/Q | — | — | — | SHIPPED | Anamnesis on episode (CLI-55); WO keys only in CutoverImportKey |
| CLI-07 | Service catalog (M6) | PRD | Y | — | Y `/admin/catalog` grid + kind/paid/package filters + Nafta import; `/admin/departments` cards | — | — | SHIPPED | `ServiceCatalogKind`; department is a code on `ServiceDepartment`; procedure picker = PROCEDURE only; prices → `amountNet` by `code` |
| CLI-08 | Procedure compatibility rules | M11 | Y | — | Y modal | — | — | SHIPPED | — |
| CLI-09 | Procedure sequence rules (FIFO) | vNext | Y | — | Y modal | — | — | SHIPPED | — |
| CLI-10 | Clinical / program templates | vNext | Y | — | Y `/admin/templates` | — | — | SHIPPED | — |
| CLI-11 | LIS profiles | M11 | Y | — | Y | — | — | SHIPPED | — |
| CLI-12 | Lab order lifecycle | K2 | Y cancel ORDERED; duplicate open/completed gates + confirmRepeat | Y `/lab-orders` q→status→modality; Name (CODE); delete ORDERED | — | — | — | SHIPPED | — |
| CLI-13 | Sanatorium chart | K5 | Y paged open episodes; room/program filters; chart delete complaint/dx/ORDERED lab | Y `/sanatorium` pager (no API page echo) + room/program filters + Name (CODE) quotas; ICD single searchable picker | Y | — | — | SHIPPED | — |
| CLI-14 | Reception queue | W3 | Y | Y | — | — | — | SHIPPED | — |
| CLI-15 | Inpatient beds | M13 | Y census `?view=census` | Y ward tiles + `/inpatient/census` | Y ward board + admin modal CRUD | — | — | SHIPPED | `/admin/wards` edit/delete ward & bed |
| CLI-16 | Visit complete + billing | K4 | Y | Y | — | — | — | SHIPPED | — |
| CLI-17 | Executive summary | K-14 | Y | Y | Y filters via API | Y | — | SHIPPED | `ExecutiveDashboard` on Home `/` for owners (`canViewExecutive`) → `GET /api/executive/summary`; standalone `/executive` removed |
| CLI-18 | Clinic settings persist | ops | Y | — | Y | — | — | SHIPPED | — |
| CLI-19 | Admin audit log | ADR | Y | — | Y `/admin/audit` | — | — | SHIPPED | — |
| CLI-20 | Docker demo seed | ops | — | — | — | — | — | SHIPPED | `RUN_SEED` |
| CLI-21 | Discount K-13 | PRD | Y | Y visit modal | — | — | — | SHIPPED | — |
| CLI-22 | Insurance eligibility M12 | PRD | Y | Y visit panel | — | — | — | SHIPPED | Finance proxy |
| CLI-23 | HL7 LIS prod | PRD deferred | STUB | — | — | — | — | STUB | vendor |
| CLI-24 | Real NBC fiscal | ADR | STUB | Y cashier mock | — | — | — | STUB | external |
| CLI-25 | Patient card clinical sections (now/next, results, plan) | PRD M1/M5 | Y `/api/patients/:id/card-summary` (+ `intakeChecklist`, Baku `atLabel`), `…/card-feed`, `…/timeline` | Y `/patients/[id]` — intake checklist keeps the four Nafta slots plus program labs/exams; PLAN site titles; now/next + planPreview `scheduledAt >= now` (server Baku labels) | Y settings limits | — | — | SHIPPED | Visit collapse; Nafta intake + slot clock; droplet UAT after seed/re-Apply |
| CLI-26 | Procedure day-ops (reception matrix + nurse attendance) | ADR clinic-procedure-day-ops + clinic-scheduling-time-layers | Y check-in→CHECKED_IN; auto-complete by endsAt; no-show burns quota; MANUAL channel; cron sweeps; procedures?mine=1; per-type resourceGap on check-in grace | Y `/nurse` agenda+kanban; `/sanatorium/resources` + fullscreen; `/sanatorium` courses table | Y procedure type duration/resourceGap/patientRest | — | — | SHIPPED | Check-in atomic; COMPLETED at endsAt; bonus = checkedInAt + CHECKED_IN/COMPLETED |
| CLI-30 | Multi-resource scheduling (A sanatorium / B outpatient) | ADR clinic-multi-resource-scheduling + clinic-scheduling-time-layers | Y allocations/skills/requirements; planner+slots honor STAFF HARD/SOFT + occupying-tail resource gap; Appt.resourceId | Y `/admin/master-data` Add+Edit reqs + backfill + time-layer fields | — | — | — | SHIPPED | SOFT = shared nurse pool; physical capacity still scarce; SOFT does not inherit cabin resource gap |
| CLI-31 | Doctor-confirm FIFO planning (PROPOSED → place) | ADR clinic-doctor-confirmed-fifo-planning | Y confirm, bulk-cancel, PATCH procedure; rotation/substitution; labs 90d/fasting | Y doctor/reception: patient card confirm; sanatorium bulk cancel+replace | Y `/admin/procedure-rules` rotation+substitution; peak settings | — | — | SHIPPED | Package → PROPOSED; doctor confirm places; incremental context |
| CLI-32 | Diagnostic catalog DB + normalized lab orders | ADR clinic-diagnostic-catalog-db | Y LabOrderItem/LabResult; dual-write; package `PKG-NAFTA-INTAKE` | Y /lab-orders; card intake checklist (not WO `#33`) | Y /admin/diagnostic-catalog CRUD | — | — | SHIPPED | Seed `seed-diagnostic-catalog.cjs`; print CLI-34 |
| CLI-34 | Print forms (lab/USM/checkup/procedures) + branding | ADR clinic-print-forms | Y print loaders; ImagingPhrase; checkup ← Nafta intake 4 | Y /print/*; checkup default therapist/gyn/cardio/usm | Y print branding; phrase/analyte options | — | — | SHIPPED | Tenant `checkupSectionsJson` overlay OK |
| CLI-33 | Cashier ops (queue, shifts, multi-channel settle, over-quota) | ADR clinic-cashier-ops | Y queue/bills/shifts/receipts/over-quota; unified bill; split pay; ProcedureChargeLog | Y `/cashier` tabs + settle modal; X/Z shift | — | — | — | SHIPPED | Fiscal still STUB (CLI-24); folio/hub void at hotel |
| CLI-27 | Clinic→hotel capacity foresight | ADR clinic-hotel-capacity-foresight | Y `/api/capacity/summary` (+ remaining%) | — | — | Y executive banner | — | SHIPPED | Soft warn ≤15% remaining; critical blocks medical booking; bus CAPACITY_CHANGED |
| CLI-28 | Patient clinical demographics (sex, age, blood, emergency) | ADR clinic-patient-clinical-demographics | Y firstName/middleName/lastName + `ageYears`; nationality nullable | Y `/patients`, `/patients/[id]` Ad/Ata adı/Soyad; nationality SEARCHABLE no AZ default | — | — | — | SHIPPED | Ops cache; MDM link sends name parts + ISO; PatientSex no OTHER; phone not MDM id |
| CLI-29 | Ops home day dashboard (Ana səhifə) | PRD ops | Y `/api/ops/day-summary` | Y `/` KPI + by-type | — | — | — | SHIPPED | Asia/Baku day; appointments/procedures/queue/labs/overdue; preset inpatient beds |
| CLI-36 | Practitioner shift rotation | ADR clinic-practitioner-shifts | Y rule engine (weekly/week-parity/month-parity/cycle) + exceptions; matrix off-shift block; booking guard 409 | Y `/appointments` off-shift slots blocked | Y `/admin/master-data` **Shifts** modal + `GET/PUT …/[id]/schedule` | — | — | SHIPPED | Unrestricted when no rules (back-compat); outpatient appts only |
| CLI-37 | UI list/filter standard (3-tier) | DESIGN + UI_PLAYBOOK | — | Y instant `EraListFilterBar`; name-first; icon row actions; home full-width + shared date; `EraListWorkspace` + server COUNT/page on patients / lab-orders / sanatorium list | Y same on SatAdmin lists; catalog grid `pagination={false}` | — | — | SHIPPED | Global kit: no Apply; Reset inline; `useDebouncedValue` 300ms; fill-height list shell |
| CLI-38 | Staff kind + monthly nurse/lab duty roster | ADR clinic-staff-duty-roster | Y roster GET/PUT/approve; absences; planner uses APPROVED posting; calendar = DOCTOR only; roster excludes leftover `WO-TR-*` | Y `/sanatorium/nurse-roster` month matrix + absence modal + pager | Y master-data `staffKind`; roster and wards stay in the side nav | Y | — | SHIPPED | Skill ≠ duty; CLI-36 = hours; Finance HR vacation sync later |
| CLI-39 | Sanatorium ICD-10 search/picker | ADR clinic-icd10-catalog | Y `GET /api/icd`; episode diagnosis; `GET/POST/DELETE /api/patients/[id]/diagnoses` | Y `/sanatorium` IcdPicker single SEARCHABLE (API `onQueryChange`); patient card after contraindications | — | — | — | SHIPPED | UAT-SMOKE ICD; selectable CATEGORY/LEAF only; card write needs OPEN episode |
| CLI-40 | Visit + inpatient + print + ICD favorites | ADR clinic-icd10-catalog | Y VisitDiagnosis / AdmissionDiagnosis | Y `/visits/[id]`; `/inpatient` dx modal; print checkup | Y `/admin/icd-favorites` | — | — | SHIPPED | UAT-SMOKE ICD; SatAdmin no title CRUD |
| CLI-41 | Platform ICD-10 catalog gateway | ADR clinic-icd10-catalog + orch gateway | Y `GET /platform/v1/catalog/icd10` in-process generator | — | — | — | — | HEADLESS | Not data-hub; clinic optional sync |
| CLI-42 | Diagnosis report | ADR clinic-icd10-catalog | Y `GET /api/reports/diagnoses` | Y `/reports/diagnoses` in Hesabatlar | — | — | — | SHIPPED | UAT-SMOKE ICD; DOCTOR + admin `seesAll` |
| CLI-56 | Patients by country | — | Y `GET /api/reports/patients-by-country` | Y `/reports/patients-by-country` | — | — | — | SCREEN | Count of `PatientRef.nationality`; same grant as CLI-42; field UAT open |
| CLI-48 | Nafta Hour X Excel wizard + lab Word/PDF on patient card | NAFTA-CUTOVER-IMPORT | Y `/api/import/*`; `#23` `parseBakuDateTime(+04:00)` + always `replaceSites`; lab file; hotel stay bridge | Y patient card download | Y `/admin/import` | — | — | SHIPPED | Re-Apply `#23` rewrites clock + rematches S; `#31` closes intake USM; `#27` LabOrderItem top-level create; Word Dimer/CRP/PRL/Insulin/Hormon |
| CLI-49 | Physio S + program/substance catalogs + order sites | ADR clinic-physio-site-catalog + physio-site-canon | Y physio admin/catalog/nahiye-queue APIs; `physioFields` incl. `NAFTALAN_FILL`; `#23` nahiye | Y card chips (Solyuks gate); empty-catalog banner; PLAN site titles; note = residue | Y `/admin/physio-sites` + Unmatched | — | — | SHIPPED | Seed S **before** `#23`; UAT open until droplet proof |
| CLI-50 | In-house episode without hotel program + staff assign 4 SKUs + `?episode=` chart | [ADR dual-run](./adr/nafta-medical-sku-dual-run.md) | Y lifecycle always open episode; templates PKG-* | Y `/sanatorium` Select 4 SKUs; deep link opens chart | — | — | — | SCREEN | Not SHIPPED — UAT open; Wave A |
| CLI-51 | PDF quota knots + nights interpolate + stay recalc (no cancel SCHEDULED) | [ADR knots](./adr/nafta-program-quota-knots.md) | Y `quotaFor` + `recalcProgramQuotas` + charge by quota | Y `/admin/templates` procedures+knots JSON | — | — | — | SCREEN | Not SHIPPED — UAT open; Wave B (SatAdmin templates SCREEN; OpsUI quota bars) |
| CLI-52 | Doctor first-day confirm 2–3; no Confirm all; AFTER_CHECKUP admin; 4th same-day paid | [ADR FIFO](./adr/clinic-doctor-confirmed-fifo-planning.md) | Y exam-prefix sort; daily-cap charge; manual POST guard | Y `/sanatorium` + card; `/admin/settings` mode | — | — | — | SCREEN | Not SHIPPED — UAT open; Wave C |
| CLI-53 | Doctor bonus extras-only + IN_HOUSE/WALK_IN buckets | [ADR compose/bonus](./adr/nafta-compose-sell-and-doctor-bonus.md) | Y `bonusEligible` + doctor-bonus split | Y `/reports/procedures` doctor-bonus | — | — | — | SCREEN | Not SHIPPED — UAT open; Wave D |
| CLI-54 | One reservation → two episodes (per pax PatientRef + program) | [ADR episode-per-pax](./adr/nafta-episode-per-pax.md) | Y openEpisode per patient; charge by episode | Y `/sanatorium` one row per episode | — | — | — | SCREEN | Not SHIPPED — UAT open; Wave E |
| CLI-55 | Episode as care course: children + card switcher + walk-in close | [ADR course](./adr/clinic-episode-as-clinical-course.md) | Y stamp+gates+list/PATCH/close/cron | Y card CatalogField switcher + Close on /sanatorium | — | — | — | SCREEN | W1–W4 landed; keep SCREEN until field punch; AC-CLI-EPISODE stays 🟡 out of BE rollup |

### MDM natural-person identity

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | Status | Blocker |
|----|------------|-----|-----|-------|----------|----------|------------|--------|---------|
| CLI-MDM-01 | Practitioner MDM link | ADR | Y | — | Y `/admin/master-data` | — | — | SHIPPED | — |
| CLI-MDM-02 | Patient intake resolve | PRD M1 | Y | Y `/patients` | Y | — | — | SHIPPED | Cutover `#21` reuses hotel guest person; walk-in surrogate if no stay |
| HOT-MDM-01 | Guest create/edit MDM link + masked ops-profile | ADR | Y | Y GuestCardModal | Y | — | — | SHIPPED | UAT-SMOKE §2; link sends first/middle/last + ISO nationality (not OTHER collapse) |
| FIN-CIT-01 | Natural person via MDM (HR/CP) | TZ §28.2 | Y | — | Y | Y | — | SHIPPED | — |
| FIN-HR-MDM-01 | Employee payroll mirror + MDM person read-through | ADR | Y | — | Y | Y | — | SHIPPED | Plan D — no local FIN/name |
| ORCH-MDM-HR-01 | PersonHrProfile + PersonAddress (blood/stats/addr/edu) grant-gated | ADR | Y | — | — | — | HEADLESS | API | internal `/hr-profile`; ops-profile batch expands |
| FIN-HR-AL-01 | Aktiv list report (JSON + Excel) MDM ops-profile read-through | TZ | Y | Y `/employees` export | Y | Y | — | API | WS1 restore; full PersonHrProfile batch deferred |
| FIN-HR-PAY-01 | Payroll depth: slip lines, tariff/supplement, night/OT, seniority leave, email payslips, per-diem trips | TZ tender | Y | Y `/payroll` | Y | Y | — | API | WS1 restore; UAT-SMOKE pending |
| FIN-HR-MIN-01 | CP minute buckets → payroll premiums / unpaid | ADR cp-workforce-floor-attendance | Y | Y `/payroll` slip lines | — | — | — | API | Wave 11; OT/holiday/rest floor ×2; MGMT hours unchanged; no UAT-SMOKE |
| FIN-FA-LC-01 | Fixed asset lifecycle events + card history | TZ | Y | Y `/fixed-assets` | Y | Y | — | API | WS3 |
| FIN-IA-01 | Intangible assets + amortization | TZ | Y | Y `/intangible-assets` | Y | Y | — | API | WS3 |
| FIN-STAT-01 | Goskomstat statforms engine (1-müəssisə, 1/4-əmək, 1-İKT) | TZ | Y | Y `/reporting/statforms` | — | Y | — | API | compliance_pro\|tax_pro |
| FIN-CONTRACT-01 | Contract ACTIVE/expiry/amount hard-block + cron EXPIRED | TZ | Y | — | Y | Y | — | API | WS6 |
| FIN-WH-FORM-01 | Forma-5 / Forma-2 statutory warehouse prints | TZ | Y | Y inventory | Y | — | — | API | WS6 |
| FIN-PROC-01 | ProcurementProtocol + Bid + AP aging + creditor plan | TZ | Y | Y `/procurement/protocols`, `/reporting/ap-aging` | Y | Y | — | API | WS6 |
| FIN-SUBCONTO-01 | Subconto + BRANCH multi-branch valueRef | ADR | Y | — | Y | Y | — | API | `ERA_SUBCONTO_ENABLED`; [ADR](./adr/subconto-branch-dimension.md) |
| CP-WF-ORD-01 | Personnel orders PDF (hire/transfer/terminate) | ADR | Y | — | — | Y `/workspace/workforce/personnel-orders` | — | API | table + modal CatalogField; no UAT-SMOKE |
| CP-WF-STAT-01 | Staff schedule revision (ştat) approve + PDF | ADR | Y | — | — | Y `/workspace/workforce/staff-schedule` | — | API | table + modal + live snapshot; no UAT-SMOKE |
| CP-WF-VAC-01 | Vacation plan submit/approve + event | TZ | Y | — | — | Y `/workspace/workforce/vacation-plans` | — | API | table + modal; list `{ items, persons }`; Finance mirror HEADLESS |
| CP-WF-TS-01 | Timesheet month grid (CP attendance SoR) | ADR | Y | — | — | Y `/workspace/workforce/timesheets` | — | API | month approve only; APPROVED cells immutable; Finance sidebar hides structure/positions/timesheet when CP master; `/hr/timesheet` direct URL = banner only; no UAT-SMOKE |
| CP-WF-FLOOR-01 | Live floor board + suspicious punch queue | ADR cp-workforce-floor-attendance | Y | — | — | Y `/workspace/workforce/floor` | — | API | geofence/window/MULTI_PLACE → SUSPICIOUS; ACCEPT journal; rebuild skips until accept; no UAT-SMOKE |
| CP-WF-MIN-01 | Timesheet minute buckets from punches | ADR cp-workforce-floor-attendance | Y | — | — | Y `/workspace/workforce/timesheets` read-only | — | API | BREAK pairs; hours=normal only; Finance prices via FIN-HR-MIN-01; no UAT-SMOKE |
| CP-WF-SELF-01 | Employee phone cabinet (own employment) | ADR cp-workforce-floor-attendance | Y | — | — | Y `/workspace/me` | — | API | Wave 12; requests queue; advance no payment; payslip POSTED only; no UAT-SMOKE |
| CP-WF-FIT-01 | Employment fitness files (health / narcology / criminal record) | ADR cp-workforce-floor-attendance §10 | Y | — | — | Y employments card + floor | — | API | Wave 13; org requiredKinds; assignment gate; no UAT-SMOKE |
| CP-WF-PII-01 | Workforce employments/absences MDM batch display + hire resolve | ADR | Y | — | — | Y `/workspace/workforce/*` | Y | SHIPPED | masked FIN default |
| FIN-CP-MDM-01 | Counterparty ИП FIN → globalPersonId | ADR | Y | — | Y modal | Y | — | SHIPPED | — |
| BANK-MDM-01 | CIF natural + UBO resolve | ADR D4 | Y | Y CIF modal | Y API | — | — | SHIPPED | — |
| BANK-GL-01 | GL trial balance ops `/gl` | TZ | Y | Y `/gl` | — | Y exec | — | API | playbook 🟡 |
| BANK-PAY-APPR-01 | Payment staff approve SoD | TZ | Y | Y queue + list SoD + reject reason | — | — | — | API | PENDING_APPROVAL; live rails STUB |
| BANK-PAY-RAIL-01 | Outbound payment rails AZIPS/XÖHKS/AÖS/SWIFT | TZ | Y stub adapter | Y payments | — | — | — | STUB | Live sandbox = YC-E1 |
| BANK-LOAN-RISK-01 | Bureau stub + collateral + IFRS9/NPL | TZ §12 | Y | Y loans+risk | — | — | — | API | live AKB flag; cert YC-E4 |
| BANK-DEP-ACCR-01 | Deposit EOD interest accrual ACT/day-count | TZ | Y EOD | Y deposits/EOD steps | — | — | — | API | UAT 7/9 |
| BANK-LOAN-REPAY-01 | Loan repay-by-schedule allocate | TZ | Y | Y loans schedule | — | — | — | API | overpay remainingUnallocated |
| BANK-PRICING-SOD-01 | Exception pricing maker-checker | TZ | Y | Y dep/loan pending queue | — | — | — | API | PENDING_PRICING_APPROVAL |
| BANK-ECL-LAB-01 | ECL STAGE_FLAT/PD_LGD + provision SoD | TZ §12 | Y | Y `/risk/ecl` | — | — | — | API | methodology=lab |
| BANK-CAP-01 | RWA/CAR/LCR/NSFR risk capital UI | TZ §12 | Y | Y `/risk/capital` | — | — | — | API | lab; not certified |
| BANK-FLOAT-01 | FLOATING rate + EOD reset | TZ | Y | Y Product Factory + EOD step | — | — | — | API | RateIndexQuote |
| BANK-FEE-01 | Fee tariff assess post | BE roadmap | Y | Y `/fees` | — | — | — | SHIPPED | tariffs/SDB lab |
| BANK-CASH-01 | Vault/till cash movements | BE roadmap | Y | Y `/cash` | — | — | — | SHIPPED | banking_cash |
| BANK-COLL-01 | Collections recovery SoD | BE roadmap | Y | Y `/collections` | — | — | — | SHIPPED | banking_collections |
| BANK-TRADE-01 | Trade LC/BG contingent | BE roadmap | Y | Y `/trade` | — | — | — | SHIPPED | SWIFT stub |
| BANK-SO-01 | Standing orders EOD run | BE roadmap | Y | Y `/payments/extras` | — | — | — | SHIPPED | + DBO SO |
| BANK-ISL-01 | Islamic contract activate | BE roadmap | Y | Y `/islamic` | — | — | — | SHIPPED | DBO read-only |
| BANK-WEALTH-01 | Safekeeping FOP | BE roadmap | Y | Y `/wealth` | — | — | — | SHIPPED | thin custody |
| BANK-AML-RTF-01 | Fraud score lab | BE roadmap | Y | Y `/aml/cases` | — | — | — | API | score engine; cases UI |
| ORCH-MDM-01 | Org register → GlobalLegalEntity | ADR | Y | — | — | Y | Y | SHIPPED | — |
| ORCH-MDM-02 | internal resolve/merge API | ADR | Y | — | — | — | HEADLESS | HEADLESS | service token; resolve writes name parts + sex/DOB |
| ORCH-MDM-03 | Person core name parts + sex + birthDate | ADR era-mdm-natural-person-identity | Y resolve + ops-profile | — | — | — | HEADLESS | API | first/middle/last + fullName denorm; ISO nationality; fill-not-clear; hotel/clinic cache |
| ORCH-MDM-04 | Super-admin persons directory | ADR | Y `GET /v1/admin/mdm/persons` | — | — | — | Y `/super-admin/mdm/persons` | API | list shows first/middle/last; resolve modal parts; FIN/name/DOB/phone filters |

### Presets (product lines)

See [ADR clinic-product-lines-and-presets](./adr/clinic-product-lines-and-presets.md) · Plan [CLINIC-FULL-IMPLEMENTATION-PLAN.md](../era-clinic/doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md).

| ID | Preset / line | Status | Notes |
|----|---------------|--------|-------|
| CLI-PRESET-01 | `outpatient` config + nav gate | SHIPPED | Admin settings + middleware cookie |
| CLI-PRESET-02 | `sanatorium_clinical` pack | SHIPPED | Bus lifecycle; ICD picklist; preset gate |
| CLI-PRESET-03 | `inpatient_day` ADT-light | SHIPPED | ADT + daily ward charge event |
| CLI-PRESET-04 | `wellness` (SV8) | PLANNED | Phase 5 |

---

## era-hotel-pms (highlights)

| ID | Capability | API | SatAdmin | Status | Blocker |
|----|------------|-----|----------|--------|---------|
| HOT-01 | Master data CRUD | Y | Y `/admin/master-data` | SHIPPED | 2026-10: tabs reordered (room types first), optional `nameAz/nameRu/nameEn` on six catalogs shown via `catalogLabel`; concierge category + banquet line kind are lookup-backed `CatalogField`s. |
| HOT-02 | BAR rates Excel import | partial | wizard | BLOCKED | Nafta Excel export; scoped out of AC-HOT-RATE (dynamic plans only) |
| HOT-03 | Guest notify H-BL-06 | Y | send pages | STUB | Twilio/SendGrid |
| HOT-04 | e-qaimé H-BL-24 | stub | folio read-only | STUB | prod cert |
| HOT-05 | Elektraweb import | Y | — | SHIPPED | SuperAdmin `/settings/import`. Wizard pack `#03`–`#15` (no FnB/retail cards, no BAR). Nafta: `#14` extra bed 96/48; `#15` Agency Statement → AGENCY folio (not 1C). `#11` `Guest Name` `A / B` → `ReservationGuest` party (name-match Guest Cards). 2026-10: one revenue adapter + one sell-path adapter, both reused by the live bridge row below (channel rate code → BAR + OTA source + channel agency); reclass script for older DBs. |
| HOT-07 | Operational wipe for re-import (variant A) | Y `/api/admin/ops-wipe` | SuperAdmin `/settings/ops-wipe` | API | Session org only, counts → checkboxes (child uncheck clears referencing parents; server reapplies) → `WIPE` confirm, keeps master data. Shared service with CLI (CLI wipes the whole bucket). Browser UAT evidence pending → not SHIPPED. [ADR §9](./adr/hotel-elektraweb-import.md) |
| HOT-06 | Elektraweb live bridge (browser extension dual-run) | Y | — | HEADLESS | Extension settings + ingest/health + outbox. Overlay v0.3.10: notes grid (`NOTES` → reservation) + overlay login. FOCP guest: EW Guest Id then Excel name matcher; never first-guest fallback; backfill stub `import-guest-*` / `ew-fo-name:*`. Clinic Issue-ticket **SHOW** (Wave 6 lab). Super-Admin **per-org** policy **SHOW** (Wave 6 lab) + Sync → `ElektrawebBridgePolicy`. Hotel request tenant from JWT/session. Wave 8: ingest stamps ALS-first (`bridgeRequestOrganizationId`). Wave 9: field runbook [`reports/hot06-field-runbook.md`](../reports/hot06-field-runbook.md). **Not SHIPPED** (field SPA Insert open). Lab: [`reports/hot06-lab-signoff.md`](../reports/hot06-lab-signoff.md). [ADR saas](./adr/saas-request-tenant-and-vendor-bridges.md) · [inbound](./adr/hotel-elektraweb-live-bridge.md) · [reverse](./adr/hotel-elektraweb-reverse-folio-post.md) · [guide](../era-hotel-pms/doc/ELEKTRAWEB-LIVE-BRIDGE.md) |
| HOT-MDM-01 | Guest MDM link (create/edit/merge) | Y | Y GuestCardModal | SHIPPED | name parts + ISO nationality on link |
| HOT-MDM-02 | Guest MDM ops-profile masked display | Y `/api/mdm/person-ops-profile` | Y GuestCardModal | SHIPPED | — |
| HOT-BOOK-01 | Booking hierarchy (Block→Booking→RoomStay) | Y | Y card + `/admin/allotment-blocks` | SHIPPED | [ADR](./adr/hotel-booking-hierarchy.md); pickup UI; MASTER folio routing |
| HOT-BOOK-02 | Reservation card Phase 0 agency-first layout | Y | Y ReservationCardEditor | SHIPPED | Assignment by stage; Additional collapsed; companion pax names from linked Guest (not booker-only) |
| HOT-FO-01 | Room type availability (Avl/Occ) | Y | Y /availability | SHIPPED | FO chain ADR; Occ includes unassigned |
| HOT-FO-02 | Sellable preview on reservation create | Y | Y ReservationCardLeftPanel | SHIPPED | GET /api/fo/sellable; block save when Avl=0 |
| HOT-FO-03 | Shared twin assignment (union share pool) | Y | Y Assignment + room plan + rack | API | `shareEligible` + M/F only; door+overlap auto-pair (assign/import); N lanes without overlay; per-night `nextFreeShareBedIndex`; seed room 105 / backfill 307; UAT-SMOKE §30 not signed — not SHIPPED |
| HOT-FO-04 | Stay amendment + Manual Price / stay % | Y ADR | Y relocate/amendments/pricing/spread | API | UI on card; UAT-SMOKE §35 not signed — not SHIPPED |
| HOT-BOOK-03 | Allotment cutoff soft-release cron | Y | — | HEADLESS | `POST /api/cron/allotment-block-cutoff` Bearer `HOTEL_CRON_SECRET` |
| HOT-HK-01 | Room HK/inventory axes (no OCCUPIED write) | Y | Y rack/FO | API | UAT-SMOKE §34 open — not SHIPPED |
| HOT-HK-02 | Roster / rotation / ƏG | Y | Y `/hk/roster` `/hk/rotation` | API | SCREEN; DnD; not SHIPPED |
| HOT-HK-03 | Floor sheet + visit outcomes + laundry folio | Y | Y `/hk` `/hk/laundry` `/hk/mobile` | API | SCREEN; millət + duty + needed-by; UAT §34 |
| HOT-HK-04 | Skip/Sleep discrepancy + HK forecast | Y | Y `/hk/discrepancy` `/hk/forecast` | API | SCREEN; Sleep ≠ SO; heads/linen/deep counts |
| HOT-HK-05 | Linen/deep hotel policy | Y | Y `/settings/hk-policy` | API | SCREEN; no per-stay override; not SHIPPED |

### Hotel FO money / City Ledger / adjacent (2026-08-03 audit)

Doc: [ADR hotel-city-ledger-and-fo-money](./adr/hotel-city-ledger-and-fo-money.md) · boundary [HOSPITALITY_FINANCE_BOUNDARY.md](./HOSPITALITY_FINANCE_BOUNDARY.md) · backlog P5 in hotel `BACKLOG-PRODUCTION.md`.

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | Status | Blocker / gap |
|----|------------|-----|-----|-------|----------|----------|------------|--------|---------------|
| HOT-CASH-01 | Folio settle multi-method (CASH/CARD/COMPANY/LOYALTY/DEPOSIT/BANK_TRANSFER) | KKM policy | Y settle | Y `/folio/[id]` | — | — | — | SHIPPED | UAT-SMOKE §3/§27; BANK_TRANSFER ops tender + bankReference; match in Finance |
| HOT-CASH-02 | Unified front-cash pending hub (F&B/clinic walk-in) | ADR settlement hub | Y | Y `/front-cash/pending` | — | — | — | SHIPPED | UAT-SMOKE §6b; not clinic cashier |
| HOT-CASH-06 | Front cash journal + shift Z packet + close shift | MENU-IA | Y `/api/front-cash/transactions` | Y `/front-cash/transactions` | — | — | — | SHIPPED | UAT-SMOKE §28; ops Z print (not fiscal KKM Z) |
| HOT-CASH-03 | Folio deposit hold / apply / refund HELD | H-BL-10/41 | Y deposits | Y folio settle DEPOSIT | — | — | — | SHIPPED | UAT-SMOKE §27; apply@check-in + settle/CO |
| HOT-CASH-04 | Folio payment refunds to guest | ADR CL | Y refund API | Y folio Refund | — | — | — | SHIPPED | UAT-SMOKE §27; mock fiscal; TRANSFERRED_AR blocked |
| HOT-CASH-05 | Checkout discounts (manual + automatic) | ADR CL | Y DISCOUNT | Y settle/checkout | promo CRUD | — | — | SHIPPED | UAT-SMOKE §27; H-BL-43 |
| HOT-CO-01 | Checkout close guest folios (zero balance) | clone-spec 05 | Y checkout | Y card / folio | — | — | — | SHIPPED | UAT-SMOKE §5/§27; guest must settle |
| HOT-CO-02 | Transfer balance to City Ledger at checkout | ADR CL | Y gate+PENDING_AR | Y folio+chessboard confirm | — | — | — | SHIPPED | UAT-SMOKE §27; H-BL-40 |
| HOT-CO-03 | Selective / per-guest folio close | ADR CL | Y closeFolio | Y folio Close | — | — | — | SHIPPED | UAT-SMOKE §27; H-BL-45 |
| HOT-CO-04 | Early checkout unused-nights refund (net of 18% VAT, default CASH) | ADR hotel-early-checkout-unused-nights | Y preview + apply on check-out | Y folio + chessboard checkout modal | — | — | — | SHIPPED | UAT-SMOKE §33; all folios reverse; guest cash net VAT; H-BL-49 |
| HOT-CL-01 | Folio routing rules + stay overrides (revenue → GUEST/COMPANY/AGENCY) | ADR CL | Y stay PUT | Y card routing table | Y master data | — | — | SHIPPED | Stay overrides > property FolioRoutingRule on postCharge |
| HOT-CL-02 | Credit limit on stay / room charge | H-BL-03 | Y | Y Billing field | — | — | — | SHIPPED | UAT-SMOKE card billing; CL gate uses limit |
| HOT-CL-03 | Agency City Ledger ops snapshot | Stage 23 | Y ledger+settle | Y `/front-cash/agency-ledger` | — | — | — | SHIPPED | UAT-SMOKE §27 agency settle; legacy `/reports/agency-ledger` redirects |
| HOT-CL-04 | City Ledger → Finance snapshot + ops re-push | boundary | Y event + `/api/agencies/[id]/city-ledger-snapshot` | Y agency-ledger push + Finance deep link | — | Y AR | — | SHIPPED | Aging/match stays Finance |
| HOT-CL-05 | Payment terms + aging + invoice matching | ADR CL D2 | — | — | terms on CP | Y aging+allocate | — | SHIPPED | Finance UAT aging+allocate; hotel handoff only |
| HOT-NA-01 | Night Audit EOD (post room/package, roll day, E1) | clone-spec 07 | Y `/api/night-audit/*` | Y `/night-audit` | — | — | — | SHIPPED | UAT-SMOKE §6; legacy `/operations` redirects |
| HOT-NA-02 | Night Audit polish (exceptions, auto no-show, trial) | ADR CL | Y polish steps | Y `/night-audit` preview | — | — | — | SHIPPED | UAT-SMOKE §27; H-BL-44 |
| HOT-NA-03 | EOD reports hub + P1 grids (+ no-show / room-move / VIP + CSV) | MENU-IA + ADR | Y `/api/night-audit/eod-reports` | Y `/night-audit/reports*` | — | — | — | SHIPPED | UAT-SMOKE §28; Management PDF catalog is HOT-RPT-01/02 (API, not SHIPPED) |
| HOT-NA-04 | Reservation updates (action filter + CSV) | MENU-IA | Y `…/reservation-updates` | Y UI filter+CSV | — | — | — | SHIPPED | UAT-SMOKE §28; classify heuristics on audit text |
| HOT-NA-05 | End of year close / open | ADR year-end | Y preview API | Y `/night-audit/year-end` | — | — | — | STUB | ADR `hotel-year-end-calendar`; POST `YEAR_END_NOT_ENABLED` |
| HOT-RPT-01 | Management reports catalog + `/reports` workspace (EW WA0058/59) | [catalog](../era-hotel-pms/doc/MANAGEMENT-REPORTS-CATALOG.md) | Y `/api/reports/{slug}/layout` + `/pdf` + `/xlsx` | Y `/reports` (category and slug URLs redirect) | Y `/settings/policies#letterhead` (print letterhead + logo) | — | — | API | W1–W3 one workspace + PDF/Excel; one `ReportLayout` per slug for screen/PDF/Excel (Elektra family sections); letterhead on every export; Start/End + radios; em dash when room/bed capacity is 0; email cron HEADLESS; no UAT evidence → not SHIPPED |
| HOT-RPT-02 | Configurable nightly management pack + ZIP | catalog §6 | Y `/api/reports/pack/download` | Y `/reports/nightly-pack` + NA deep link | Y `/settings/report-pack` | — | — | API | ZIP + SatAdmin; cron sends ZIP link (HEADLESS); not SHIPPED |
| HOT-XFER-01 | Transfers (airport / fleet → folio + cancel + routing) | module map | Y | Y `/transfers` | — | — | — | SHIPPED | Charge via postCharge routing; cancel/void; UAT transfers |
| HOT-TOUR-01 | Guest group tours (Nafta weekend roster + TOUR folio) | [ADR hotel-guest-tours](./adr/hotel-guest-tours.md) | Y `/api/tours/*` `/api/fleet/*` `/api/folios/charges/[chargeId]/pay` | Y `/tours` `/tours/[id]` `/tours/[id]/print` | Y `/fleet` | — | — | SHIPPED | SKU `hotel_transfers`. UAT-SMOKE §14b. City ledger ≠ Paid. DispatchVehicle not merged. |
| HOT-BEO-01 | Banquets / BEO MVP + day sheet print | H-BL-31 | Y day-sheet | Y `/banquets*` | — | — | — | SHIPPED | UAT-SMOKE §15; not full Opera S&C |
| HOT-AG-01 | Tour agency contracts + commission % | H-BL-30 | Y | Y `/admin/contracts` | Y | — | — | SHIPPED | UAT-SMOKE §18 |
| HOT-AG-02 | Agency prepaid/postpaid settlement + refunds | ADR CL | Y settlement API | Y agency-ledger | — | Finance match | — | SHIPPED | UAT-SMOKE §27; bank match Finance |
| HOT-AGP-01 | Agency portal book (contract allotment + isolation) | [ADR agency portal](./adr/hotel-agency-portal.md) | Y `/api/agency/*` | Y `/agency/*` (extranet) | Y invite | — | — | API | P0–P1; multi-hotel grant on CP; AUTO default OFF → OPTION |
| HOT-AGP-02 | FO agency inbox confirm / decline | ADR agency portal | Y `/api/fo/agency-inbox` | Y `/fo/agency-inbox` | — | — | — | API | Confirm → CONFIRMED; decline → CANCELLED |
| HOT-AGP-03 | Optional passport scan on agency booking | ADR agency portal | Y attachment upload | Y card + agency UI | — | — | — | API | Not KBS; storage key org-scoped |
| HOT-UI-01 | List/filter enrichment (EraListFilterBar parity) | CLI-37 pattern | — | Y FO lists; guests + reservations server page+COUNT via `EraListWorkspace`; FO `rowClassName` status tint; `?guestId=` → status ALL | allotment | — | — | SHIPPED | UAT list filters; H-BL-47; Live default on reservations (guest deep-link = All) |
| HOT-PC-01 | Pricing components (service fee / meals / COGS versions + history) | [ADR bar vs package](./adr/hotel-bar-accounting-vs-package-sell.md) | Y `/api/admin/pricing-components` | Y `/settings/pricing-components` | Y | — | — | SHIPPED | Seeds Nafta defaults; audit on version create |
| HOT-OCC-01 | Occupancy / load / child pricing feature flags + 2nd/3rd adult + extra bed + child matrix CRUD | [ADR occupancy flags](./adr/hotel-occupancy-and-load-pricing-flags.md) | Y `/api/admin/pricing-policy`, child-matrix, yield | Y `/settings/pricing-policy`, master-data rate plans, `/distribution/child-matrix` | Y | — | — | SHIPPED | Flags default OFF; yield only when load flag ON |
| HOT-PKG-01 | Package sell + costFloor versions (1/2 adult occupancy) | [ADR bar vs package](./adr/hotel-bar-accounting-vs-package-sell.md) | Y `/api/admin/rate-plans/[id]/sell-versions` | Y `/settings/package-prices` | Y | — | — | SHIPPED | Syncs `pricePerNight` for occupancy=1 |
| HOT-PKG-02 | Medical SKU resolve (Extra Req / agency) + notes import | [ADR dual-run](./adr/nafta-medical-sku-dual-run.md) | Y resolve + notes adapter + bridge upsert | Y notes on card / import wizard | — | — | — | API | Not SHIPPED — UAT open; no EW rate as SKU |
| HOT-PKG-03 | Composed nightly sell from per-pax SKUs (193+96 / half-double) | [ADR compose](./adr/nafta-compose-sell-and-doctor-bonus.md) | Y `composeNaftaPackageNightlySell` + dailyRates + night audit | — | — | — | — | API | Not SHIPPED — UAT open; Wave D |
| HOT-PKG-04 | Per-pax lifecycle events for multi-program stay | [ADR episode-per-pax](./adr/nafta-episode-per-pax.md) | Y check-in fan-out per pax | Y pax medicalPackageCode | — | — | — | API | Not SHIPPED — UAT open; Wave E |
| HOT-UE-01 | Unit economics dashboard (CPOR/BEP/article COGS trends/below-floor risk) | [ADR bar vs package](./adr/hotel-bar-accounting-vs-package-sell.md) | Y `/api/executive/unit-economics` | Y `/executive/unit-economics` | — | Y OrgOwner/manager | — | API | Phase A proxy CPOR + below-floor; Finance CPOR later |
| HOT-CH-01 | Local channel manager (mappings, stop-sell, sync journal, OTA cancel by ref, health) | ADR OTA + clone CH-01/02/03 | Y `/api/channel/*` | Y `/distribution/channel` | — | — | — | SHIPPED | UAT-SMOKE §19; cancel requires externalRef/reservationId (no latest-OTA fallback) |
| HOT-CH-02 | Live OTA ARI sync (Booking.com / Expedia / Exely) | ADR hotel-ota-adapter-strategy | Y adapters + push/pull | Y health dry-run/live | — | — | — | STUB | Env-gated dry-run without vendor creds; H-BL-25 not live-done |

---

## era-fnb-pos (highlights)

| ID | Capability | OpsUI | Status | Blocker |
|----|------------|-------|--------|---------|
| FNB-01 | CARD pay + shift | Y `/orders` | SHIPPED | — |
| FNB-02 | Real KKM NBC | mock | STUB | external |
| FNB-03 | Admin modal CRUD (menu categories/items, tables) | Y `/admin/menu`, `/admin/tables` | SHIPPED | — |
| FNB-04 | Menu price history | Y `/admin/menu` history modal | SHIPPED | — |
| FNB-05 | Standalone sale/shift → Finance GL | Y pay + Z-close events | SHIPPED | LOCAL_CASHIER only; hotel paths via NA |
| FNB-06 | Recipe SKU + Finance deep-link | Y menu admin | SHIPPED | BOM SoT Finance |
| FNB-07 | Dish image URL | Y `/admin/menu` + floor strip | SHIPPED | URL only, no upload |
| FNB-08 | Nafta cutover Excel wizard | Y `/admin/import` | API | READY #30-#32; UAT-SMOKE UI open — not SHIPPED |
| FNB-09 | Edition (`kafe` / `fnb`), hall presets (`cafe` / `restaurant`; `banquet` stored, no screens), and `hotelMode` as three fields; SatAdmin Halls modal on `/admin/settings` (`GET/PATCH /api/settings/presets`); menu rows by preset + kitchen module from one `/api/auth/me` read | Y `/admin/settings` | API | ADR era-kafe-edition §1a; UAT-SMOKE UI step and browser run open — not SHIPPED |
| FNB-10 | OrgOwner upgrade ERA Kafe → full F&B (no new price line, `hotelMode` untouched, Sync re-run) | OrgOwner `/settings/subscription` card (`GET /v1/fnb/edition`, `POST /v1/fnb/edition/upgrade`) | API | ADR era-kafe-edition §1b; UAT-SMOKE UI step open — not SHIPPED |

---

## era-retail-pos (highlights)

| ID | Capability | OpsUI | Status | Blocker |
|----|------------|-------|--------|---------|
| RET-01 | Nafta cutover stock-cards import | Y `/admin/import` | API | READY #33; UAT-SMOKE UI open — not SHIPPED |
| RET-RBAC-01 | Role×permission matrix + custom roles (Variant A): system packages, clone, Reset, assign; page + API grant doors (void, import) | OpsUI nav by grant; SatAdmin `/admin/access` (`OUTLET_ADMIN`) | API | UI class SCREEN; ADR retail-domain-permissions-and-rbac; AC-RET-RBAC 🟡; UAT-SMOKE RET-RBAC-01 open — not SHIPPED |
| RET-STAFF-01 | CP `STAFF_PROVISIONED` → retail cashier login (`cpEmploymentId`); uncheck or module disconnect → `STAFF_DEACTIVATED` | SatAdmin Hesablar `/settings/users`, `/admin/access`, `/settings/logins` | API | OrgOwner card Giriş hüquqları checkbox; UAT-SMOKE not run — not SHIPPED |
| RET-ACCT-01 | Hesablar: users, access matrix, login journal | SatAdmin those three screens | API | Nav group; login journal writes on `/api/auth/login`; not SHIPPED |

---

## era-finance-core (highlights)

| ID | Capability | SatAdmin | Status | Blocker |
|----|------------|----------|--------|---------|
| FIN-01 | GL / documents ERP | Y web | SHIPPED | — |
| FIN-GL-02 | Manual adjusting journal (əl ilə tənzimləmə) | Y `/accounting/adjustments` | SHIPPED | ADR wave 3: preview/PDF/reverse/copy; reason required; USER 403; UAT-SMOKE § Manual adjusting journal |
| FIN-AR-CRADJ-01 | Invoice credit adjustment (internal remaining) | Y `ViewInvoiceModal` | SHIPPED | VAT split REVENUE 601/545/211; `CREDIT_ADJUSTMENT` + reversal; overpayment CTA; UAT-SMOKE § Invoice credit adjustment |
| FIN-FA-DON-01 | FA in-kind donation (capitalization) | Y `/fixed-assets` lifecycle | SHIPPED | `creditSource=DONATION`; note ≥10; UAT-SMOKE § FA donation |
| FIN-02 | Satellite event worker | — | HEADLESS | by design |
| FIN-03 | e-qaimé | stub modal | STUB | prod cert |
| FIN-EQAIME-01 | e-Qaimə S2S submit + invoice eqaime status | Y `/sales/invoices` | STUB/API | `ERA_EQAIME_S2S_ENABLED`; 503 `RPA_FALLBACK` — [ADR](./adr/eqaime-s2s-submission.md) |
| FIN-EQAIME-02 | EQF registry by debtor | Y `/reporting/eqf-registry` | API | tax/reporting |
| FIN-ASAN-01 | ASAN İmza / SİMA gov-payload signing | Y org settings | API/STUB | `ERA_ASAN_SIMA_LIVE`; mock default — [ADR](./adr/asan-sima-gov-signature.md) |
| FIN-EQAIME-IN-01 | Incoming e-qaimə compare + ingest | Y network-inbox | API | amount/VÖEN MATCH/MISMATCH |
| FIN-04 | NAS / reference hub | Y `/admin/data` | SHIPPED | Q-01 commercial kassa **221** / bank **223**; NAS-GOV **101/103**; İ-05 **221/223** |
| FIN-TAX-01 | Tax declarations (simplified / profit / payroll); property = aggregate/preview | Y `/reporting/tax-export`, `/reporting/property-tax/preview` | API | tax_pro; property declaration-file export pending; UAT-SMOKE pending |
| FIN-TAX-02 | Profit tax adjustments + preview | Y API + tax-export | API | tax_pro |
| FIN-STAT-01 | Goskomstat engine (1-müəssisə, 1/4-əmək, 1-İKT) | Y `/reporting/statforms` | API | compliance_pro or tax_pro |
| FIN-CTR-01 | Contract hard-block limit + expire cron | Y `/contracts` check-limit | API | contract_management_pro |
| FIN-INV-F5 | Forma-5 / Forma-2 statutory PDF | Y inventory shipments/adjustments | API | pdfkit |
| FIN-PRC-01 | Procurement protocols + Bid | Y `/procurement/protocols` | API | — |
| FIN-AP-01 | AP aging + creditor payment plan | Y `/reporting/ap-aging` | API | — |
| FC-FX-01 | Converter + revaluation on hub CBAR | Y | SHIPPED | `ERA_DATA_HUB_ENABLED` |
| FC-FX-02 | Customs auto CBAR on bgdDate | Y | SHIPPED | Finance Trade Pro |
| FIN-ADV-01 | Advance reports registry (list/detail/post/print) | Y `/expenses/advance-reports` | SHIPPED | Wave 5 E7; `@RequiresModule(kassa_pro)` |
| FIN-ADV-02 | Advance report expense lines (cost account, VAT, receipt) + MXO link | Y advance report modal | SHIPPED | Wave 5 E7 |
| FIN-PRICE-01 | Price list CRUD + lines | Y `/catalog/price-lists` | SHIPPED | Wave 5 E7 |
| FIN-PRICE-02 | Discount rules + invoice price resolution | Y invoice create modal | SHIPPED | `PriceListsService.resolvePrice` |
| FIN-LANDED-01 | BGD landed cost allocation to SKU | Y `/customs/[id]` | SHIPPED | Wave 5 E7; `@RequiresModule(trade_pro)` — [ADR](./adr/landed-cost-allocation.md) |
| FIN-LANDED-02 | Product link on BGD line + batch cost update | Y customs detail | SHIPPED | `STAT_VALUE|WEIGHT|QUANTITY` methods |
| FIN-TRADE-01 | TradeContext DOMESTIC/EXPORT/IMPORT on invoices | Y `/sales/invoices` | SHIPPED | Wave 5 G9 — [ADR](./adr/trade-context-daxili-xarici.md) |
| FIN-TRADE-02 | Incoterms + export decl ref + Commercial Invoice PDF | Y invoice PDF | SHIPPED | Multilingual blocks |
| FIN-TRADE-03 | Import pipeline OCR→purchase→BGD→landed cost | Y `/customs`, `/purchases` | SHIPPED | `POST customs/import-pipeline` |
| FIN-WMS-01 | Bin-level balances (`BinBalance`) | Y `/inventory/wms-mobile` | SHIPPED | Wave 5 E6 — [ADR](./adr/bin-level-wms.md) |
| FIN-WMS-02 | Mobile scan receive/issue/transfer/adjust | Y `/inventory/wms-mobile` | SHIPPED | `@RequiresModule(inventory)` |
| FIN-WMS-03 | Warehouse zones + pick lists | Y WMS mobile + API | SHIPPED | put-away/picking |
| FIN-STAT-01 | Stat form definition catalog + generator | Y `/reporting/statforms` | SHIPPED | Wave 5 G3 — [ADR](./adr/statform-engine.md) |
| FIN-STAT-02 | Standard placeholder set (1-müəssisə, labor, production, prices) | Y statforms generate | SHIPPED | Verify official Goskomstat blanks before filing |
| FIN-STAT-03 | Stat form XLSX export + download history | Y `/reporting/statforms` | SHIPPED | `compliance_pro` or `tax_pro` |

---

## era-data-hub · FX (reference data)

| ID | Capability | Doc | API | Status | Blocker |
|----|------------|-----|-----|--------|---------|
| DH-REGISTRY | Hub `/registry/v1` health + auth | ADR | Y | HEADLESS | service token |
| DH-FX-01 | Hub FX ingest + `/fx/*` API | TZ §FX | Y | SHIPPED | `ERA_DATA_HUB_DATA_SOURCE=hub` prod |
| DH-CUR-01 | Hub ISO currency catalog `/currencies` | ADR | Y | SHIPPED | sync-from-finance; ≠ FX |
| FC-DH-001 | Finance FX consumer | PRD §4.18 | Y | SHIPPED | — |
| FC-DH-002 | Finance HS/customs tariffs | PRD §4.18 | Y | SHIPPED | — |
| FC-DH-003 | Finance calendar consumer | PRD §4.18 | Y | SHIPPED | — |
| FC-DH-004…010 | Banks/IBAN/VÖEN/geo/UoM/tax/CoA | PRD §4.18 | Y | SHIPPED | hub + fallback |
| FC-DH-011 | ISO currency catalog (hub SoR) | ADR hub | Y `/system/currencies` | SHIPPED | FK cache; admin read-only |
| FC-DH-COA | PostingRole de-hardcode CI | TZ §28.3 | — | HEADLESS | `lint-nas-literals.mjs` |
| LOG-REF-01 | Logistics HS/FX preview via Finance | Y `/customs` | Y | SHIPPED | — |
| BANK-REF-01 | Bank multi-catalog hub + snapshot | — | Y | HEADLESS | on-prem `ref-data-snapshot` + DataHubClient; not a teller screen (owner 2026-08-18) |
| ORCH-RD-01 | B2B reference-data API keys | — | Y | SHIPPED | orchestrator |

---

## era-bank-core · FX

| ID | Capability | OpsUI | SatAdmin | Status | Blocker |
|----|------------|-------|----------|--------|---------|
| BK-FX-01 | EOD/treasury dated FINAL FX | Y teller | Y | SHIPPED | on-prem snapshot |

---

## Industry satellites · FX (indirect)

| ID | Capability | OpsUI | SatAdmin | Status | Blocker |
|----|------------|-------|----------|--------|---------|
| LG-FX-01 | Logistics FX preview + Finance customs link | Y `/customs` | Y | SHIPPED | accounting in Finance |
| WS-FX-01 | Wholesale import PO foreign currency | Y `/admin/import-orders` | Y | SHIPPED | — |
| HT-FX-01 | Hotel folio multi-ccy display | Y folio/pricing | Y | SHIPPED | display-only |

---

## Production calendar (reference data)

| ID | Capability | OpsUI | SatAdmin | OrgOwner | Status | Blocker |
|----|------------|-------|----------|----------|--------|---------|
| FC-CAL-01 | Finance HR on hub calendar | — | Y | Y | SHIPPED | `ERA_DATA_HUB_ENABLED` |
| BK-CAL-01 | Bank EOD skip non-working | Y | Y | — | SHIPPED | on-prem snapshot |
| HT-CAL-01 | Hotel auto-BAR from hub | — | Y | Y | SHIPPED | MANUAL lock |
| CL-CAL-01 | Clinic scheduling skip non-working/mourning | Y | Y | — | SHIPPED | — |
| LG-CAL-01 | Logistics SLA business-day ETA | Y `/trips/[id]` | Y | — | SHIPPED | `/api/sla/eta` |
| CN-CAL-01 | Construction timesheet calendar norm | Y field-ops | Y | — | SHIPPED | calendar warn on import |
| CN-CAL-02 | Construction timesheet → CP → Finance | ADR F2 | Y event | — | — | — | — | HEADLESS | Import upserts CP month grid; approve emits `type`; Finance mirror |
| WS-CAL-01 | Wholesale payment terms business days | — | Y | — | SHIPPED | `/admin/import-orders` |
| FB-CAL-01 | FNB labor → finance HR | Y | Y | — | HEADLESS | no local calendar |
| AS-CAL-01 | Auto appointment working days | Y `/appointments` | Y | — | SHIPPED | calendar snap + cron |
| CRM-CAL-01 | CRM lead follow-up business days | Y `/leads` | Y | — | SHIPPED | +N business days picker |

---

## Industry VÖEN preview (platform gateway target; legacy Finance BFF pre-W2)

| ID | Capability | OpsUI | SatAdmin | Status | Blocker |
|----|------------|-------|----------|--------|---------|
| IND-VOEN-01 | VoenLookupField + `/api/counterparties/voen-preview` | Y | Y | SHIPPED | DH-006 hub; live e-taxes BLOCKED |
| WS-VOEN-01 | Wholesale import PO supplier VÖEN | Y | Y | SHIPPED | — |
| AS-VOEN-01 | Auto work-order corporate VÖEN | Y | Y | SHIPPED | — |
| HT-VOEN-01 | Hotel travel agency VÖEN | — | Y | SHIPPED | — |
| CN-VOEN-01 | Construction subcontractor VÖEN | Y | Y | SHIPPED | — |
| CRM-VOEN-01 | CRM lead company VÖEN | Y | Y | SHIPPED | Persisted on lead (v3.0 M11) |

### era-crm v3.0

| ID | Capability | OpsUI | SatAdmin | Status | Notes |
|----|------------|-------|----------|--------|-------|
| CRM-PARTY-01 | Lead party profile (individual + legal) | Y `/leads`, `/leads/[id]` | Y | SHIPPED | `partyKind`, stage gates, FIN/MDM |
| CRM-PARTY-02 | Partner prospect tag + filter | Y | Y | SHIPPED | `prospectType=PARTNER` |
| CRM-IMPORT-01 | CSV/XLSX prospect import | — | Y `/admin/import` | SHIPPED | e-taxes enriched columns + dedup |
| CRM-IMPORT-02 | Activity sector on lead | Y | Y | SHIPPED | `donor_sectors` → `activitySector` |
| CRM-CONV-01 | Finance auto-counterparty on convert | — | HEADLESS | SHIPPED | extended `SATELLITE_CRM_LEAD_CONVERTED` |
| CRM-RBAC-01 | Role×permission matrix + custom roles (Variant A): system packages, clone, Reset, assign; page + API grant doors (lead assign, import, pipeline rules) | OpsUI nav and assign control by grant | SatAdmin `/admin/access` (`SALES_LEAD`) | API | UI class SCREEN; ADR crm-domain-permissions-and-rbac; AC-CRM-RBAC 🟡; UAT-SMOKE CRM-RBAC-01 open — not SHIPPED |

ADR: [crm-lead-party-model-and-prospect-import](./adr/crm-lead-party-model-and-prospect-import.md)

---

## Bank sanctions (external)

| ID | Capability | OpsUI | Status | Blocker |
|----|------------|-------|--------|---------|
| BANK-SANC-01 | Sanction screening seed UI | Y `/aml/screen` | STUB | seed JSON |
| BANK-SANC-LIVE | Daily OFAC/EU/UN ingest via hub | — | BLOCKED | [reference-data-phase2](./adr/reference-data-phase2-catalogs.md) |
| FC-DH-006-ETAXES | Live e-taxes VÖEN fallback | — | BLOCKED | [etaxes-voen-unblock-checklist](./adr/etaxes-voen-unblock-checklist.md) |

---

## era-orchestrator (highlights)

| ID | Capability | OrgOwner | SuperAdmin | Status |
|----|------------|----------|------------|--------|
| ORCH-01 | Workspace launcher + SSO | Y | — | SHIPPED |
| ORCH-02 | Module toggle modal (per-satellite Modules + ⚙ Settings on active cards) | Y | — | SHIPPED |
| ORCH-03 | MDM persons write | — | Y | SHIPPED |
| ORCH-MDM-01 | Org register → GlobalLegalEntity | Y | Y | SHIPPED |
| ORCH-MDM-02 | internal resolve/merge API | — | HEADLESS | `[h]` |
| ORCH-MDM-03 | Person core name parts + sex + birthDate | — | HEADLESS | `[h]` |
| ORCH-MDM-04 | Super-admin persons directory | — | Y `/super-admin/mdm/persons` | API |
| ORCH-04 | Vendor SMS/email prod | — | — | STUB |
| ORCH-05 | Login onboarding 0/1/N + company-less gate | Y | — | SHIPPED |
| ORCH-06 | Pending invites accept (invited accountant) | Y | — | SHIPPED |

### Deployment topology (declared — not a live SaaS pool)

Canon: [deployment-topology.md](./adr/deployment-topology.md). **Do not mark SHIPPED.** Axis A (`STANDALONE` / `DEPARTMENT` / `Outlet`) is separate.

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | Status |
|----|------------|-----|-----|-------|----------|----------|------------|--------|
| CP-TOPO-01 | Vocabulary SHARED / DEDICATED / ONPREM + mixed endpoints | ADR deployment-topology | — | — | — | — | — | Doc |
| CP-LIC-01 | License defaults by topology + super-admin perpetual / ± term | ADR platform-trial-hierarchy §1 | `PATCH …/subscription/trial`, `PATCH …/deployment-topology`; provision reads `Organization.deploymentTopology` | — | — | — | Y `/super-admin/orgs/{id}/subscription` (+ sat/module trial, quotas, block/tier) | API |
| CP-SA-ORGS-01 | Super-admin org catalog + hub | — | `GET /v1/admin/organizations` | — | — | — | Y `/super-admin/orgs` | API |
| CP-SA-REF-01 | Referral partners admin | — | `/v1/admin/referrals/partners` | — | — | — | Y `/super-admin/referrals` | API |
| CP-SA-LAND-01 | Landing marketing admin | — | `/v1/admin/landing-modules` | — | — | — | Y `/super-admin/landing` | API |
| CP-BILL-OWNER-01 | Owner billing constructor + invoices/orders | CP-BILLING | `/v1/billing/*`, `select-plan` | — | — | Y `/settings/subscription|invoices|orders` | — | API |
| CP-BIND-01 | Satellite org UUID bind + Super-admin sync | ADR satellite-organization-bind | `POST/GET …/organization/bind`, Sync; kit boot on hotel/clinic/fnb + bank/dbo/bank-core; `industry_banking` in Sync keys | — | — | — | Y | API |
| CP-CFG-01 | Desired-state runtime config (SSO, event token, edition, topology) | ADR satellite-organization-bind §8 + deployment-topology §4 | `POST/GET …/runtime-config` + Sync fan-out — hotel/clinic/fnb/finance + thin industry + bank/dbo/bank-core; payload may include `deploymentTopology` + `edition` (informational; never skip tenant filter). Finance orch URL = kit memory after Sync (`CONTROL_PLANE_URL` bootstrap only) | — | — | — | Y | API |
| CP-LAUNCH-01 | Owner launcher base URL from SatelliteEndpoint (env fallback) | INTEGRATION_SSO_EVENTS; ECOSYSTEM_URLS | `GET /v1/satellites/launch-url`; workspace + `/industry/[vertical]` prefer registry | — | — | Y | — | API |
| CP-PLACE-01 | PlacementJob: freeze, org slice, endpoint cutover, hop SHARED⇄DEDICATED⇄ONPREM | ADR deployment-topology §4–§5 | `POST/GET /v1/admin/orgs/:orgId/placement-jobs`, `POST …/placement-jobs/:id/advance`, `GET /v1/placement-agent/jobs`; host agent `scripts/era-placement-agent.mjs`; kit hotel curated JSON slice v1 (Wave 11); SHARED↔ONPREM → REJECTED; Wave 7 lab full SHARED→DEDICATED advance | — | — | — | Y `/super-admin/orgs/{id}/placement` | API |
| CP-TENANT-01 | `organizationId` on industry satellite ops rows + composite uniques | ADR deployment-topology §2 | Clinic/hotel/fnb/retail/crm/auto/construction/wholesale/logistics/bank/dbo/bank-core + **fail-closed** kit Prisma tenant extension (no `unbound` default; stamp+mismatch reject); staff `User.phone` unique per org; `runCronForEachTenant` + Wave 10 User DISTINCT discover; CI mergeWhere + Wave 9 live pool smoke; clinic/hotel UAT-SMOKE two-org (field pending) | — | — | — | — | API |

Nafta hotel, clinic, and retail run SHARED (one process, one DB, many `organizationId`). DEDICATED/ONPREM remains a placement for other customers, not the Nafta fact. SHARED pool and automated migrate are **not** sellable. Hotel child/line tables carry `organizationId` (backfill from the parent row); AC-*-TENANT stay 🟡 and out of BE rollup until field two-org UAT. **Bank:** same ladder as other satellites (CAP-NFR-TOPO DECLARED = pool not built, not a special ban). Nafta entitlement gate: fail-closed `requireSatelliteModule` / cron skip (hotel/clinic/fnb/finance + thin industry module-gates). **SHARED:** request org argument + CP subscription snapshot (`SATELLITE_EVENT_SERVICE_TOKEN`); Sync `activeModules` cache is fallback when CP is down, not required after every container restart. DEDICATED still uses process bind. Kit `ERA_DEV_UNLOCK_ALL_MODULES` refused when `NODE_ENV=production`.

---

## era-orchestrator CP workforce (Plan A)

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | UAT-SMOKE |
|----|------------|-----|-----|-------|----------|----------|------------|-----------|
| CP-WF-EMP-01 | Minimal employment (MDM hire) | ADR cp-workforce-absence-split + provision-sync | `POST /platform/v1/workforce/employments/hire` | — | — | Y | — | Hire + Login & access binding guard; unique login; Sync failed badge / Reprovision retry; paginated list |
| CP-WF-ABS-01 | Absence workflow (7 TK AZ kinds, modal CRUD) | ADR cp-workforce-absence-split | `/platform/v1/workforce/absences/*` | — | — | Y | — | table+CatalogField; cancel unlocks timesheet cells; not a timesheet grid |
| CP-WF-VAC-01 | Vacation plan (dept submit → HR approve) | ADR | `/platform/v1/workforce/vacation-plans/*` | — | — | Y `/workspace/workforce/vacation-plans` | — | multi-line modal + status gates; list `{ items, persons }`; API until UAT-SMOKE |
| CP-WF-ORD-01 | Personnel orders PDF (hire/transfer/terminate) | ADR | `/platform/v1/workforce/personnel-orders/*` | — | — | Y `/workspace/workforce/personnel-orders` | — | status gates; list `{ items, persons }`; API until UAT-SMOKE |
| CP-WF-STAT-01 | Staff schedule revision (ştat) approve + PDF | ADR | `/platform/v1/workforce/staff-schedule/*` | — | — | Y `/workspace/workforce/staff-schedule` | — | status gates + snapshot expand; API until UAT-SMOKE |
| CP-WF-TS-01 | Timesheet month grid (CP attendance SoR) | ADR | `GET ?year=&month=` + autofill/sync/batch/approve | — | — | Y `/workspace/workforce/timesheets` | — | empty→WORK; APPROVED immutable; 410 cherry-pick; Finance nav hides structure/positions/timesheet when CP master; API until UAT-SMOKE |
| CP-WF-FLOOR-01 | Live floor board + geofence review queue | ADR cp-workforce-floor-attendance | `GET …/attendance/floor`, `GET/POST …/punches/:id[/accept]`; place radius/grace | — | — | Y `/workspace/workforce/floor` | — | SUSPICIOUS skipped by rebuild; ACCEPT overlay; Status=API until UAT-SMOKE |
| CP-WF-MIN-01 | Punch → minute buckets on DRAFT cell | ADR cp-workforce-floor-attendance | rebuild classifies; approve `minutes` optional; Finance new columns | — | — | Y timesheet read-only line | — | hours=normal only; priced in Finance FIN-HR-MIN-01; Status=API |
| CP-WF-SELF-01 | Employee phone cabinet | ADR cp-workforce-floor-attendance | `/platform/v1/workforce/me/*` + requests queue | — | — | Y `/workspace/me` + `/requests` | — | Wave 12 API; Status=API until UAT-SMOKE |
| CP-WF-FIT-01 | Employment fitness files | ADR cp-workforce-floor-attendance §10 | `/platform/v1/workforce/employments/:id/fitness*` + policy | — | — | Y employments + floor `FITNESS_ISSUE` | — | Wave 13 API; Status=API until UAT-SMOKE |
| CP-WF-ORG-01 | Org structure (OrgUnit tree) | ADR cp-workforce-org-units | `/platform/v1/workforce/org-units/*`, `POST …/import/org-structure` | — | — | Y | — | bootstrap + xlsx/csv import on `/workspace/workforce/org-structure`; upsert by name, no deletes |
| CP-WF-POS-01 | Cadre positions (slots) | ADR cp-workforce-org-units | `/platform/v1/workforce/positions/*` (+ archive) | — | — | Y | — | create/edit/archive on `/workspace/workforce/positions`; drill-down from org-structure; link to employments |
| CP-WF-SEC-01 | Security Admin (matrix, grants, bindings, seats, audit) | ADR cp-workforce-role-templates-and-security-admin + provision-sync | `/platform/v1/workforce/security/*`, `/role-templates`, `/manual-grants` | — | — | Y | — | Matrix columns and grant/binding filters are purchased PIN satellites only; a hidden template row stays stored. A matrix save replaces other roles for that position and satellite so the cell shows the role just chosen |
| CP-WF-HIRE-01 | CP hire + STAFF_PROVISIONED | ADR cp-workforce-role-templates-and-security-admin | `POST /platform/v1/workforce/employments/hire` | — | — | Y | — | hire wizard: satellite checkboxes optional; empty = employment without satellite login; hotel+clinic staff-provision **ensure** Role row when missing |

## era-finance-core HR mirror (Plan A + B + C)

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | UAT-SMOKE |
|----|------------|-----|-----|-------|----------|----------|------------|-----------|
| FIN-HR-ABS-01 | Absence payroll mirror + calculators | TZ §7.0.2 | `GET /hr/absences`, vacation/sick calc | Y (read) | — | — | — | CP approve → Finance payroll list + syncAbsences |
| FIN-HR-MIN-01 | CP minutes → DRAFT payroll premiums | ADR cp-workforce-floor-attendance | `payroll.service` + `payroll-minute-premiums` | Y slip lines | — | — | — | Wave 11 API; OT/holiday/rest floor ×2; UNPAID_TIME; not SHIPPED |
| FIN-HR-CC-01 | CostCenter mirror (Department/JobPosition) | ADR cp-workforce-org-units | `GET /hr/departments`, `GET /hr/job-positions` | Y (read) | — | — | — | HEADLESS — CP org event → mirror row; UI banner → Workspace |

---

## Other industry satellites

Modal CRUD audit (LOCAL_UAT §5): **Partial** for FB, Ret, Log, Con, CRM, Auto, Cli (pre-this-PR), Who. See per-app DELIVERY `[~]` rows.

**era-bank-core:** L1 kernel = **HEADLESS** (no UI). **era-bank** ops satellite UI = **API / playbook 🟡** (teller back-office, BFF-only — no local ledger; not product GA). **era-bank-dbo** = customer channel (separate UX standard).

### Variant A access matrix (industry satellites)

| ID | Capability | OpsUI | SatAdmin | Status | Notes |
|----|------------|-------|----------|--------|-------|
| WS-RBAC-01 | Wholesale role×permission matrix + custom roles (Variant A): system packages, clone, Reset, assign; page + API grant doors (import orders, settings, access) | OpsUI nav by grant | SatAdmin `/admin/access` (`WHOLESALE_MANAGER`) | API | UI class SCREEN; ADR wholesale-domain-permissions-and-rbac; AC-WHS-RBAC 🟡; UAT-SMOKE WS-RBAC-01 open — not SHIPPED |
| AS-RBAC-01 | Auto role×permission matrix + custom roles (Variant A): system packages, clone, Reset, assign; page + API grant doors (settings, access; cron stays on its secret) | OpsUI nav by grant | SatAdmin `/admin/access` (`STO_MANAGER`) | API | UI class SCREEN; ADR auto-domain-permissions-and-rbac; AC-AUT-RBAC 🟡; UAT-SMOKE AS-RBAC-01 open — not SHIPPED |
| CN-RBAC-01 | Construction role×permission matrix + custom roles (Variant A): system packages, clone, Reset, assign; page + API grant doors (act approve as a grant, settings, access) | OpsUI nav by grant | SatAdmin `/admin/access` (`PROJECT_MANAGER`) | API | UI class SCREEN; ADR construction-domain-permissions-and-rbac; AC-CON-RBAC 🟡; UAT-SMOKE CN-RBAC-01 open — not SHIPPED |
| LOG-RBAC-01 | Logistics role×permission matrix + custom roles (Variant A): system packages, clone, Reset, assign; page + API grant doors (driver trip list as a grant on both roles, trip complete, settings, access; tracking is session-only; the path token selects the trip) | OpsUI nav by grant | SatAdmin `/admin/access` (`DISPATCHER`) | API | UI class SCREEN; ADR logistics-domain-permissions-and-rbac; AC-LOG-RBAC 🟡; UAT-SMOKE LOG-RBAC-01 open — not SHIPPED |

---

## Regeneration

```bash
node scripts/delivery-readiness.mjs          # engineering checkbox %
node scripts/readiness-strict-delivery.mjs   # SHIPPED-only % (excludes [~][s][h])
node scripts/readiness-coverage.mjs          # platform hooks §4
npm run report:ecosystem-readiness           # HTML dashboard (all apps, filters)
```

Interactive report: [ecosystem-readiness-report.html](./ecosystem-readiness-report.html) (open in browser after regen).

Manual rows in this file are authoritative for **actor UI** until `readiness-ui-coverage.mjs` exists.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-10-06 | Security matrix, grants, and bindings show clinic/hotel/F&B/retail only when that module is purchased. Saved role templates stay when the column is hidden. |
| 2026-10-06 | Retail staff provision (`RET-STAFF-01`, `RET-ACCT-01`): `industry_retail` on the PIN bus (`RETAIL_API_URL`, `User.cpEmploymentId`, Hesablar users/access/logins). CP employee card chips (identity, contacts + kin, job dropdowns, access from `activeModules`, fitness preview). Disconnect of clinic/hotel/F&B/retail revokes bindings and emits `STAFF_DEACTIVATED`. MDM `person_kin_contacts`. All new rows API. No SHIPPED / Pilot / ga changes. |
| 2026-10-03 | F&B edition / preset / hotel mode split (`FNB-09`) and owner upgrade ERA Kafe → full F&B (`FNB-10`) — API, not SHIPPED. Kit menu row conditions (`permission`, `anyPermission`, `module`, `preset`, `edition`, `when`) with paint-once filters; F&B, hotel, clinic, bank shells read one `/api/auth/me`; finance and control-plane sidebars use the same predicate on the JWT session. Bank `/api/auth/me` carries `activeModules`. No SHIPPED flips. |
| 2026-10-04 | Request tenant filter no longer falls back to the process bind inside a Next request (dead sync `headers()` read removed; missing entered org throws). Staff handlers with a session pass `session.organizationId` (fiscal device lists, hotel cash shift and booking sources, clinic/hotel/F&B role and user admin). Clinic admin GETs that only the admin screen calls (rooms, resources, lookups, procedure types, ICD favorites, LIS profiles, practitioner skills and schedule) use `assertClinicAdminRoute`. Practitioner list GET stays open to ops. On retail, CRM, wholesale, construction, auto and logistics: missing `x-era-pathname` denies the API grant; `POST /api/auth/logout` clears the staff cookie. Logistics tracking reads the staff session, then the path token. No SHIPPED / Pilot / ga changes. |
| 2026-10-04 | Staff session standard, final: kit `readSatelliteStaffSession` takes the org from the token only and loads the staff row in that tenant (missing / inactive / other-org row → 401; bank inactive `OpsUser` and F&B inactive PIN roster included); each app `getSatelliteSession()` runs the module gate for that org and builds permissions from the loaded role (no second DB read in guards, data scope, BFF proxy, refresh-permissions, `/me`); `assert*Entitled` removed in all apps; one session read per route handler inside `try` (F&B handlers moved inside `try`, ungated staff routes in the six simple satellites and hotel now read the session); hotel / clinic gates take the org as an argument; kit `requireSatelliteModule` drops the process-bind fallback; kit middleware strips client identity headers on every path (`serviceApiPrefixes` for S2S, clinic capacity summary reachable from the hotel proxy with the session org), hotel freeze check via `authorizeApi` with the token org. Guard `check:satellite-session` in `run:quality-gates`. Data-layer process-bind fallback stays an open item (ADR saas-request-tenant §2). No SHIPPED / Pilot / ga changes. |
| 2026-10-04 | Variant A RBAC on the six remaining satellites: `RET-RBAC-01` (Retail), `CRM-RBAC-01`, `WS-RBAC-01` (Wholesale), `AS-RBAC-01` (Auto), `CN-RBAC-01` (Construction), `LOG-RBAC-01` (Logistics). Each app gets system packages per org (ops roles plus `BUSINESS_OWNER` / `PLATFORM_MEMBER` / `SATELLITE_OPERATOR`), `/admin/access` (matrix, clone, Reset, assign), `permissions[]` in the login / SSO token with refresh-permissions, page grants in middleware and API grants in `getSatelliteSession()` (unlisted staff route → 403). Pre-matrix role names map to templates once (catalog version 0 → 1); seed access is unchanged except the per-app manager-only admin splits listed as deliberate deltas in each ADR. Cron (Auto) and tracking token (Logistics) stay declared handler exceptions. All six rows API (UI class SCREEN), AC-*-RBAC 🟡 out of BE rollup; UAT-SMOKE steps open. No SHIPPED / SHOW / Pilot / ga changes. |
| 2026-10-05 | Workforce packages Essential/Professional/Premium (2/4/6 AZN per person) gate screens; existing hub orgs migrate to Premium. Referral commission sums all subscription invoice lines; `?ref=` on satellites and Finance redirects to orchestrator `/register`. CP-SA-REF-01 and workforce timesheet/floor rows stay API. No SHIPPED flips. |
| 2026-10-04 | Staff login without `orgNo` or a host binding returns 400 on every industry satellite (no process-bind lookup). `POST /api/events/dispatch` stamps the org from the request context only. No SHIPPED flips. |
| 2026-10-04 | One staff-session standard: module gates refuse without a session org (no process-bind fallback) in all industry satellites, hotel agency portal (`requireAgencyPortalSession`) and bank-dbo; SSO exchange (10 satellites + hotel agency SSO) takes the org from the signed ticket with no process-bind comparison (SEC-SSO-05 superseded); clinic and bank reload permissions from the DB in `getSatelliteSession` like hotel and F&B (F&B no longer keeps token grants when the DB list is empty or the read fails); bank DBO customer channel falls back to the deployment org on DEDICATED/ONPREM when no host or lab `orgNo` is present (SHARED refused); hotel session email comes from the token only; clinic session returns null outside a request. ADR saas-request-tenant §2. No SHIPPED / Pilot / ga changes. |
| 2026-10-03 | Shared staff session: clinic, F&B, bank, hotel, retail, CRM, logistics, wholesale, construction, auto read the session with kit `getSatelliteSession` (org from token, middleware header, or User row; never the process bind) behind kit `createSatelliteStaffMiddleware`. Hotel signs with kit `signSatelliteSession`; staff `/api/agencies/*` no longer falls into the agency-cookie branch; hotel `GET /api/platform/billing-snapshot` takes the org from the session. ADR saas-request-tenant §2. No SHIPPED flips. |
| 2026-10-01 | Bank core SHARED: process bind is not taken from `ERA_BANK_ORGANIZATION_ID` / Sync of one bank. Boot, desired-state pull, and organization bind clear that pin when topology is SHARED (DBO and era-bank boot included). Request tenant stays `X-Organization-Id`. DBO demo seed enters the lab bank and upserts `organizationId_keyHash`. AC-BANK-TENANT stays 🟡; no SHIPPED flip. |
| 2026-10-01 | Finance: org invites looked up by email/id (not session org); VÖEN join runs in the target org; system audit events append the org hash chain; unwired Pasha/Drakaris payment webhook methods removed (live pay path remains Drakaris `finalizePaidOrderPublic`). |
| 2026-10-01 | Tenant filter skip removed: kit drops `ERA_SKIP_TENANT_FILTER`; cron org list = kit `listCronOrganizationIds` (SHARED orch registry only, 503 on empty/drop; DEDICATED process org); `ERA_CRON_ORGANIZATION_IDS` + satellite User DISTINCT discover removed; seeds/imports/loaders bind org with filter on; clinic extra-ticket print link carries `organizationId`. AC-*-TENANT stay 🟡; no SHIPPED flips. |
| 2026-10-01 | No unfiltered tenant mode: kit ALS `skipTenantFilter` removed; hotel Channex webhook / IBE key and F&B public menu (`publicSlug`) look up per registry org with the filter on (registry down → 503); F&B `prismaBare` removed. Finance: no ALS context → error; skip only super-admin `/api/admin/*` + audit archive; workers, crons, guards, public and S2S routes enter per-org context; recovery `bypassTenantFilter` removed. Orch billing dead skip wrappers removed. AC-*-TENANT stay 🟡; no SHIPPED flips. |
| 2026-09-30 | Wave 13 fitness files: `CP-WF-FIT-01` API — employment HEALTH/NARCOLOGY/CRIMINAL_RECORD, org requiredKinds gate on place assignment, floor group. Not SHIPPED. |
| 2026-09-30 | Wave 12 employee cabinet: `CP-WF-SELF-01` API — `/workspace/me`, requests queue, announcements, advance→Finance DRAFT ADVANCE, payslip POSTED. Not SHIPPED. |
| 2026-09-30 | Wave 11 Finance minute pricing: `FIN-HR-MIN-01` API — OT/holiday/rest floor ×2, night/rest/holiday/unpaid slip lines; MGMT hours unchanged. Not SHIPPED. |
| 2026-09-30 | Wave 10 minute buckets: `CP-WF-MIN-01` API — BREAK pairs, bucket columns, approve `minutes`, Finance mirror without payroll premiums. Not SHIPPED. |
| 2026-09-30 | Wave 9 floor: `CP-WF-FLOOR-01` API — live board + SUSPICIOUS queue; place geofence; ACCEPT journal; rebuild skips until accept. Not SHIPPED. |
| 2026-09-30 | Wave 8 Finance HR nav: drop sidebar links to CP org-structure/positions; hide `/hr/timesheet` nav when `platform_workforce` or TIER_3; direct timesheet URL keeps banner (no empty status). CP-WF-TS-01 stays API. |
| 2026-09-02 | CLI-48: `#27`/`#29` create `LabOrderItem` after `LabOrder` (nested `items.create` stamps `organizationId` and is rejected). Word filenames Dimer/CRP/PRL/Insulin/Hormon map to catalog codes. Status SHIPPED. |
| 2026-09-02 | HOT-BOOK-02: reservation-full includes linked Guest on `paxGuests`; card hydrates companion names from that map (not booker-only). Status SHIPPED. |
| 2026-09-02 | HOT-05/HOT-06: reservations import `A / B` → `ReservationGuest`; live FOCP guest = EW Id then name matcher, no first-guest fallback. Status SHIPPED / HEADLESS unchanged. |
| 2026-09-01 | Hotel middleware UTF-8-encodes `x-user-login` / `x-user-fullname` so Cyrillic/Azerbaijani staff names do not crash Edge `Headers#set`. |
| 2026-09-01 | CP-WF-EMP-01: Login & access copy org ID + Open satellite `/login?organizationId=`; hotel staff-provision ensure Role; clinic card/import polish + kit login formExtras after password. Status API where previously API. |
| 2026-09-01 | HOT-FO-03: door+overlap auto-share (assign/import) + ops backfill; room plan parallel lanes require `shareEligible` (no paint safety-net). Status API — not SHIPPED. |
| 2026-09-01 | HOT-FO-03: room plan N lanes without overlay + per-night vacated-bed reuse; HOT-06 overlay inject into EW app windows. Status API / HEADLESS — not SHIPPED. |
| 2026-09-01 | CP-WF-EMP-01: employments ⋯ Login & access (`emp-{staffCode}` + satellite roles, PIN 0000). Status API — not SHIPPED. |
| 2026-08-31 | CP-WF-TS harden: APPROVED cells immutable; cherry-pick approve 410; empty approve 400; absence cancel unlock + sync reconcile; Finance UI link-only + EN banner; vacation multi-line + status gates. Status API — not SHIPPED. |
| 2026-08-31 | CP-WF-TS-01 month grid is CP attendance SoR (Finance 409 `TIMESHEET_MASTER_IS_CP` when `platform_workforce`); VAC/ORD/STAT table+modal; ABS table header + CatalogField. Status API — not SHIPPED (no UAT-SMOKE). |
| 2026-08-31 | CLI-WF-PWD-01 clinic `/account/password`; hotel/fnb STAFF_PROVISIONED scrypt + tenant; other satellites documented as no local login fan-out. |
| 2026-09-01 | Step 5 Finance: Employee `birthDate` map; drop `patronymic`; MDM parts read-through (`personDisplayFromOpsProfile`); hire/edit/opening-balance `middleName` → MDM; ƏMAS prefill from parts; backfill script before migrate. |
| 2026-09-01 | Step 2 orch: workforce hire/card + roster CSV parts; super-admin MDM directory columns; Nafta HR Tam adı → canon parts; STAFF_PROVISIONED fullName from MDM compose. |
| 2026-09-01 | ORCH-MDM-02/03: MDM person name parts (`firstName`/`middleName`/`lastName` ciphers + fullName denorm); resolve dual-write + fill-not-clear; ISO nationality; ops-profile returns parts. Backfill script after migrate. UI directory still step 2. |
| 2026-08-29 | ORCH-MDM-04: super-admin persons directory; CP-WF-EMP-01 employee card + filters; CP-WF-POS-01 archive + drill-down. |
| 2026-08-28 | CLI-25: patient card timeline/history collapse Appointment+Visit to one «Приём» row (slot date, `/visits/[id]`). |
| 2026-08-28 | CLI-48: `#21` attending doctor = one Visit on check-in from `#27` `wo:doctor:{id}` (not a PatientRef field). |
| 2026-08-28 | CLI-48: `#21` re-import updates latest episode any status (dates/status/room/stay); no clinic wipe. |
| 2026-08-28 | CLI-48: `#21` past `checkOut` (Asia/Baku) → episode `IMPORTED_CLOSED` + `closedAt`; live checkout stays `CLOSED`. |
| 2026-08-28 | CLI-48 / CLI-MDM-02: clinic `#21` cutover links MDM via hotel stay (`GET /api/internal/v1/stays/by-external-ref`) then `linkPersonIdentity`; re-import keeps existing `PatientRef.globalPersonId`. |
| 2026-08-28 | ORCH-MDM-03: MDM person core `sex` (MALE/FEMALE/UNKNOWN, no OTHER) + `birthDate`; resolve/ops-profile SoR; hotel/clinic ops cache. CLI-28 note. |
| 2026-08-28 | Clinic quota import: ProgramInstance `@@unique([organizationId, episodeId])`; kit tenant findUnique no longer invents a missing compound unique for 1:1 FKs (CLI-48). CP-TENANT-01 stays API. |
| 2026-08-22 | HOT-HK-05 linen/deep policy SCREEN; sheet duty + needed-by; still not SHIPPED. |
| 2026-08-21 | Fail-closed tenant filter (no unbound default; stamp+mismatch reject); User.phone unique per org; runCronForEachTenant; check:satellite-raw-sql. Bank CAP-NFR-TOPO: same ladder as hotel (pool not built, not a special ban). CP-TENANT-01 stays API; AC-*-TENANT stay 🟡 |
| 2026-08-21 | Clinic scheduling time layers ADR: occupancy vs per-type resource gap vs patient rest vs pair rules; UFF gel 5/0/15; SOFT nurse ≠ cabin gap. CLI-26/30 stay SHIPPED; schema split not built |
| 2026-08-21 | Clinic time layers shipped: ProcedureType.resourceGapMinutes/patientRestMinutes; occupying-tail; SVC-ULTRAFONOFOREZ-GEL; SatAdmin three numbers |
| 2026-08-22 | Nafta ops: gel occupancy 10 (not 5); UFB 1→5; laser/darsonval gap 0; paraffin cycle 20; physio 09–17; 4-chamber 08–18 women AM/men PM; Solux 4 units from 24.08 |
| 2026-08-18 | UI waves A–C: DBO `/open-api` + orch placement page (NONE→SCREEN); HOT-06 + BANK-REF-01 HEADLESS; thin-satellite MDM re-audit. Demo/TE unchanged. |
| 2026-08-18 | UI Coverage Board: `docs/acceptance/UI-COVERAGE-BOARD.md` joins PRM UI + COVERAGE actors + NONE holes. Status=`API` + actor Y = SCREEN (not «no UI»). Sell still Product-Readiness only. |
| 2026-08-18 | Green Scaffold BE Wave 8: vendor leftovers (FISCAL / WA / VOEN) stay out of their product BE rollup (Hotel INT). Same-day owner revert: AC-DBO-OPEN + AC-CP-TOPO stay **in** Bank DBO / Platform BE rollup as 🟡 — playbook `docs/acceptance/BE-OPEN-AND-TOPO-RETURN.md`. No SHIPPED / no edition ga / no SaaS pool sell |
| 2026-08-17 | Green Scaffold BE Wave 7 (Platform): AUTH/BILL/MDM/WF/SA/INT/BIND/CFG Scaffold ✅ + `cp-*-negative.spec.ts`; AC-CP-TOPO stays 🟡; Platform Product-Readiness Scaffold BE stays 🟡; edition `mvp` / no SHARED pool sell |
| 2026-08-17 | Wave 0 Green BE residual registers + DBO Readiness honesty (no Scaffold flips) |
| 2026-08-17 | Waves 9–18 topology closeout: fail-closed module gates + prod refuses ERA_DEV_UNLOCK; CRM ops assertEntitled spot-check; clinic two-org UAT outline + pending signoff stub; PlacementJob Prisma+admin API+host agent+slice stub (CP-PLACE-01 → API); SHARED↔ONPREM REJECTED negative test; bank CAP-NFR-TOPO stays DECLARED; live SHARED pool ops Not built; AC-CP-TOPO 🟡 not Scaffold ✅; edition platform mvp; no false SHIPPED |
| 2026-08-17 | Wave 8 launcher URLs: `GET /v1/satellites/launch-url` prefers SatelliteEndpoint; NEXT_PUBLIC_* local-dev fallback only; CP-LAUNCH-01 API (not SHIPPED; no UAT) |
| 2026-08-17 | Waves 5–7 topology: Finance Nest orch URL/token via kit (CONTROL_PLANE_URL bootstrap-only); Sync pushes optional deploymentTopology+edition into runtime-config; docs/compose hygiene; CP-CFG-01 stays API; CP-PLACE-01 / AC-CP-TOPO unchanged; no SHIPPED / no edition ga |
| 2026-08-17 | Wave 3 topology: product call sites use `satelliteOrganizationId()` / `resolveSatelliteOrganizationId()` (SSO, billing-snapshot, bank BFF, kit clients); drop hotel/clinic env aliases in kit; CP-BIND/CP-TENANT stay API; AC-*-TENANT stay 🟡 |
| 2026-08-17 | Wave 2 topology runtime-config: thin industry (retail/crm/auto/construction/wholesale/logistics) + bank/dbo/bank-core Nest `POST/GET …/runtime-config` + instrumentation boot; CP-CFG-01 stays API (not SHIPPED) |
| 2026-08-17 | Wave 1 topology env: bank/dbo/bank-core bind HTTP + Sync `industry_banking` in INDUSTRY_SATELLITE_KEYS; CP-BIND-01 API; CAP-NFR-TOPO stays DECLARED |
| 2026-08-17 | Tenancy + Nafta gates wave: remaining satellites organizationId (retail/crm/auto/construction/wholesale/logistics/bank); fail-closed entitlement + cron skip on Nafta (hotel/clinic/fnb/finance); Sync activeModules in runtime-config; AC-*-TENANT 🟡; no SHARED pool / Placement |
| 2026-08-17 | B7 bank tenancy: CP-TENANT-01 covers bank/dbo/bank-core organizationId + kit filter; AC-BANK-TENANT 🟡; SHARED bank pool still forbidden |
| 2026-08-17 | Orch missing-screens wave: SuperAdmin org catalog/referrals/landing; owner billing invoices/orders; workforce vacation/orders/ştat/timesheets UI (status API, not SHIPPED) |
| 2026-08-17 | CP-LIC-01: topology license defaults (SHARED trial / DEDICATED+ONPREM perpetual) + super-admin perpetual / ± months; PlacementJob still Doc |
| 2026-08-17 | Topology waves 0–5: CP-BIND/CFG/TENANT → API (kit boot, Sync runtime-config industry+finance, SHARED-ready schema + kit filter); CP-PLACE/TOPO vocabulary still Doc; SHARED pool not sellable |
| 2026-08-17 | CP-TOPO/BIND/CFG/PLACE/TENANT: deployment topology declared; SHARED pool and placement not built |
| 2026-06-15 | Initial honest matrix; clinic CLI-* green target; cross-app highlights |
| 2026-06-16 | CLI-PRESET-* product lines per clinic ADR |
| 2026-06-15 | DH-FX / FC-FX / BK-FX / LG-FX coverage rows (CBAR ecosystem refactor) |
| 2026-06-15 | Re-audit pass 2: HT-FX/WS-FX/WS-CAL/CN/AS/CRM-CAL/LG-CAL SHIPPED; IND-VOEN; BANK-MDM UI |
| 2026-07-02 | CRM v3.0 SHIPPED: CRM-PARTY-*, CRM-IMPORT-*, CRM-CONV-01; CRM-VOEN-01 persist |
| 2026-07-14 | CLI-25 patient card: now/next + pending labs + results/plan previews (card-summary/feed) |
| 2026-07-18 | CLI-30 multi-resource: Pattern A sanatorium allocations+skills; Pattern B Appt.resourceId |
| 2026-07-19 | CLI-06/28 Ops wave: paginated `/patients` + anamnesis gate; `/inpatient/census`; Tenant working hours + matrix horizon/patient filters |
| 2026-07-19 | CLI-26: atomic check-in → CHECKED_IN; auto-complete by endsAt; NO_SHOW burns quota; MANUAL channel; nurse agenda+kanban |
| 2026-07-19 | CLI-26: Location board UX (`ResourceDayMatrix`) + nurse `mine=1` STAFF filter |
| 2026-07-18 | CLI-26: (superseded) nurse check-in auto-completes short procedures |
| 2026-07-14 | CLI-26 procedure day-ops: CHECKED_IN/NO_SHOW, reception matrix DnD, nurse QR anti-fraud |
| 2026-07-14 | CLI-27 clinic→hotel capacity foresight (remaining% warn/critical + CAPACITY_CHANGED) |
| 2026-07-14 | CLI-28 patient clinical demographics (sex, DOB→age, blood, emergency contact) |
| 2026-07-18 | CLI-29 ops home day dashboard (`/` + `/api/ops/day-summary`) |
| 2026-07-21 | CLI-31 doctor-confirm FIFO planning (PROPOSED → placeConfirmedProcedures; rotation/substitution; peak; labs) |
| 2026-07-21 | CLI-32 diagnostic catalog DB + LabOrderItem/LabResult; admin CRUD; lab list table/filters |
| 2026-07-22 | CLI-33 cashier ops: queue/shifts/unified bill/multi-channel settle/over-quota |
| 2026-07-22 | CLI-34 print forms (lab/USM/checkup/procedures) + branding |
| 2026-07-22 | CLI-05: `/appointments` practitioner day matrix; remove nav `/scheduling` |
| 2026-07-22 | Remove dead legacy scheduling: `/scheduling` page, `GET /api/scheduling/slots`, `getAvailableSlots`; home quick-link cleaned |
| 2026-07-22 | CLI-35 sidebar cleanup: Setup→Catalogs/Rules; wards under Inpatient; `/executive` merged into Home (owners); `/admin/catalog-favorites` merged into diagnostic-catalog favorites tab; both routes removed |
| 2026-07-22 | CLI-36 practitioner shift rotation: rule engine (weekly/parity/cycle) + exceptions; matrix off-shift block; booking guard; Shifts admin modal |
| 2026-07-22 | CLI-37 UI list/filter standard: EraListFilterBar instant+inline Reset; clinic home shared date; name-first + icon actions |
| 2026-08-27 | HOT-06: outbox + clinic `/reception/extra-tickets` Issue ticket + 3-copy print + nurse gate. Write drain live on sanatorium desk. Still HEADLESS (not SHIPPED). |
| 2026-08-27 | SaaS Wave 1: hotel request tenant (JWT/session/`enterSatelliteTenant`); Super-Admin Elektraweb + clinic cutover policy + Sync row upsert; widget org login; property env stripped. HOT-06 still HEADLESS (SuperAdmin SCREEN). |
| 2026-08-27 | SaaS Wave 2: clinic request tenant (login/SSO/JWT/middleware ALS; lifecycle S2S; ops stamps via `requestOrganizationId`). AC-CLI-TENANT still 🟡. |
| 2026-08-27 | SaaS Wave 3: F&B/retail/CRM/wholesale/logistics/construction/auto request tenant; finance Nest ALS audited (no kit port). HOT-06 still HEADLESS; TENANT ACs still 🟡. |
| 2026-08-27 | SaaS Wave 4: multi-org cron (`runCronForEachTenant` leftovers + `byOrganization`); SHARED list = `ERA_CRON_ORGANIZATION_IDS`. HOT-06 still HEADLESS; TENANT ACs still 🟡. |
| 2026-08-28 | SaaS Wave 5: hotel+clinic lab two-org isolation CI + UAT lab/field split; signoff lab passed. Field UAT open; TENANT ACs still 🟡; no SHIPPED/`ga`. |
| 2026-08-28 | SaaS Wave 6: HOT-06 lab SHOW path (SuperAdmin policy + clinic Issue-ticket); extension SPA Insert still HEADLESS; not SHIPPED/`ga`. |
| 2026-08-28 | SaaS Wave 7: Placement lab hop SHARED→DEDICATED advance chain; slice stub; AC-CP-TOPO still 🟡; no live migrate sell. |
| 2026-08-28 | SaaS Wave 8: EW ingest ALS stamps (`bridgeRequestOrganizationId`); HOT-06 still HEADLESS / not SHIPPED. |
| 2026-08-28 | SaaS Wave 9: live pool smoke scripts (`ERA_WAVE9_POOL_SMOKE`) hotel+clinic + HOT-06 field runbook; TENANT still 🟡; HOT-06 not SHIPPED; no `ga`. |
| 2026-08-28 | SaaS Wave 10: cron org DB-discover (`listOrganizationIds` / User DISTINCT); env override wins; TENANT still 🟡; no `ga`. |
| 2026-08-28 | SaaS Wave 11: hotel curated JSON placement slice + orch sliceMeta; AC-CP-TOPO still 🟡; host apply open; no `ga`. |
| 2026-08-28 | SaaS Wave 12: honesty closeout — status drift fix + `check:acceptance` SaaS bans; TENANT/TOPO 🟡; HOT-06 HEADLESS; no `ga`. |
| 2026-08-23 | Hotel guest tours HOT-TOUR-01 SHIPPED: `/tours` roster + TOUR folio + `/fleet` + print; SKU hotel_transfers; AC-HOT-TOUR Scaffold ✅; UI SCREEN (not SHOW) |
| 2026-08-30 | Nafta card wave (3): (1) CLI-32/34 intake checklist `PKG-NAFTA-INTAKE` + live instantiate; (2) CLI-49 Solyuks/`belinə`/`NAFTALAN_FILL`/empty-catalog UX + always rematch on `#23`; (3) CLI-25/48 Baku `parseBakuDateTime` + now/PLAN `gte now`. Ops: seed catalogs then re-Apply `#23` (+ `#31` if USG). Not Pilot-ready / not GA. |
| 2026-08-31 | CLI-55 PLANNED: episode as care course (ADR clinic-episode-as-clinical-course). Card switcher, episode children, walk-in close. Not started; waves TBD. CLI-06 anamnesis-on-demographics superseded when CLI-55 ships. |
| 2026-08-31 | CLI-55 **SCREEN**: episode as care course waves W1–W4 (schema/stamp, gates, card switcher, walk-in close+cron). Not SHIPPED / not Pilot. |
| 2026-08-31 | Nafta cutover: hotel `#15` Agency Statement → AGENCY folio (not 1C); `#14` extra bed 96/48; F&B `#30`–`#32` + Retail `#33` wizards API (not SHIPPED) |
| 2026-08-30 | Clinic catalog seed layers: satellite **base** + Nafta **org overlay** (ADR clinic-catalog-base-and-org-overlay-seeds). Wrappers `db:seed:physio` / `db:seed:diagnostic-catalog` run both. |
| 2026-08-19 | HOT-RPT-01/02 Hotel Management Reports W1–W3 (P0 ZIP + P1 catalog + cubes/3-year + email ZIP link HEADLESS); STUB → API — not SHIPPED (no UAT evidence) |
| 2026-08-20 | HOT-AGP-01/02/03 Agency portal P0–P1 (CP grants + hotel book + FO inbox + passport scan); Status=API; AC-HOT-AGP 🟡; SKU `hotel_agency_portal` |
| 2026-08-17 | CLI-38 staff kind + monthly nurse/lab duty roster (`/sanatorium/nurse-roster`); clinic-local absences; planner honors approved posting |
| 2026-08-03 | Hotel FO money / City Ledger audit: HOT-CASH/CO/CL/NA/XFER/BEO/AG/UI rows + ADR hotel-city-ledger-and-fo-money; P5 backlog H-BL-40…48 |
| 2026-08-03 | P5 ship: HOT-CO-02/CASH-03..05/CL-05/NA-02/AG-02/UI-01 → SHIPPED; Finance allocate UI + paymentTermsDays |
| 2026-08-04 | Hotel acceptance closeout: IM/PRM/Sprint/edition synced; Product Readiness remains mvp/🟡 (Scaffold/UI/Pilot open) |
| 2026-08-04 | Hotel BE scaffold green: negative-path suites; DEPOSIT over-HELD refuse; HOT-02 scoped out of AC-HOT-RATE; INT excl. from BE rollup |
| 2026-08-05 | Bank Product Factory: typed paramsJson + activate/retire + apply-on-originate (deposit/loan/card/current); ops UI authoring; readiness stays 🟡/mvp |
| 2026-08-06 | Bank Capability Inventory SSOT (IN/PARTIAL/DECLARED/OUT); Acceptance/PRD/editions disclose mid-size AZ CBS ≠ full ABS; YC yellow-clear lab-pilot |
| 2026-09-01 | List workspace: kit `EraListWorkspace` + server COUNT/page; clinic patients/lab-orders/sanatorium + hotel guests/FO reservations (CLI-37 / HOT-UI-01) |
| 2026-09-01 | List polish: `usePaginatedList` on 5 screens; FO row tint + guestId→ALL; hasNotes btrim; dateFrom/To UI; `paginationMode=server` |
