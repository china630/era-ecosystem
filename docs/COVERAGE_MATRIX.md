# ERA ecosystem — coverage matrix (Doc / API / UI / actors)

Living matrix for **honest readiness**. Replaces optimistic DELIVERY-only summaries.

**Related:** [READINESS_MATRIX.md](./READINESS_MATRIX.md) · [NAFTA_DOC_API_UI_AUDIT.md](./NAFTA_DOC_API_UI_AUDIT.md) · [UI_PLAYBOOK_SATELLITES.md](./UI_PLAYBOOK_SATELLITES.md) · [LOCAL_UAT_GAP_CHECKLIST.md](./LOCAL_UAT_GAP_CHECKLIST.md)

**Last updated:** 2026-06-16

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
| **OrgOwner** | SSO owner | `/workspace`, `/executive`, `BUSINESS_OWNER` |
| **SuperAdmin** | Platform super-admin | Orch `/super-admin/*`, hotel `/admin/import` |

Cell values: **Y** = screen/path exists · **—** = not applicable · **N** = gap

---

## era-clinic (`CLI-*`)

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | Status | Blocker |
|----|------------|-----|-----|-------|----------|----------|------------|--------|---------|
| CLI-01 | Practitioners ops catalog (specialty, slots) | PRD M2 | Y | — | Y `/admin/master-data` | — | — | SHIPPED | Ops edit only; hire via CP Workforce |
| CLI-WF-01 | Practitioner hire (CP workforce → provision) | ADR cp-core-workforce-hub | Y CP hire + STAFF_PROVISIONED | — | — | Y (payroll mirror optional) | — | SHIPPED | UAT: Workspace hire → clinic DOCTOR login |
| CP-WF-HUB-01 | CP Workforce hub end-to-end (hire, org, absence, security) | ADR | Y | — | — | Y `/workspace/workforce/*` | Y | SHIPPED | Plan E clean cutover |
| CP-WF-EXP-01 | Workforce CSV export (roster, absences, timesheet) | ADR F1 | Y | — | — | Y `/workspace/workforce/export` | — | SHIPPED | No FIN in default CSV |
| CP-WF-SEAT-01 | Unified seat licensing + Security Admin widget | ADR F4 | Y | — | — | Y `/workspace/workforce/security` | — | SHIPPED | `POST /internal/v1/licensing/seats/check` |
| CLI-02 | Rooms master | PRD M2 | Y | — | Y | — | — | SHIPPED | — |
| CLI-03 | Resources (equipment) | vNext | Y | — | Y | — | — | SHIPPED | — |
| CLI-04 | Procedure types | vNext | Y | — | Y | — | — | SHIPPED | — |
| CLI-05 | Appointment create (K-01) | PRD | Y | Y modal | — | — | — | SHIPPED | — |
| CLI-06 | Patient registry (M1) | PRD | Y | Y `/patients` | Y | — | — | SHIPPED | — |
| CLI-07 | Service catalog (M6) | PRD | Y | — | Y `/admin/catalog` | — | — | SHIPPED | — |
| CLI-08 | Procedure compatibility rules | M11 | Y | — | Y modal | — | — | SHIPPED | — |
| CLI-09 | Procedure sequence rules (FIFO) | vNext | Y | — | Y modal | — | — | SHIPPED | — |
| CLI-10 | Clinical / program templates | vNext | Y | — | Y `/admin/templates` | — | — | SHIPPED | — |
| CLI-11 | LIS profiles | M11 | Y | — | Y | — | — | SHIPPED | — |
| CLI-12 | Lab order lifecycle | K2 | Y | Y | — | — | — | SHIPPED | — |
| CLI-13 | Sanatorium chart | K5 | Y | Y | Y | — | — | SHIPPED | — |
| CLI-14 | Reception queue | W3 | Y | Y | — | — | — | SHIPPED | — |
| CLI-15 | Inpatient beds | M13 | Y | Y | Y ward board + admin modal CRUD | — | — | SHIPPED | `/admin/wards` edit/delete ward & bed |
| CLI-16 | Visit complete + billing | K4 | Y | Y | — | — | — | SHIPPED | — |
| CLI-17 | Executive summary | K-14 | Y | Y | Y filters via API | Y | — | SHIPPED | `/executive` → `GET /api/executive/summary` |
| CLI-18 | Clinic settings persist | ops | Y | — | Y | — | — | SHIPPED | — |
| CLI-19 | Admin audit log | ADR | Y | — | Y `/admin/audit` | — | — | SHIPPED | — |
| CLI-20 | Docker demo seed | ops | — | — | — | — | — | SHIPPED | `RUN_SEED` |
| CLI-21 | Discount K-13 | PRD | Y | Y visit modal | — | — | — | SHIPPED | — |
| CLI-22 | Insurance eligibility M12 | PRD | Y | Y visit panel | — | — | — | SHIPPED | Finance proxy |
| CLI-23 | HL7 LIS prod | PRD deferred | STUB | — | — | — | — | STUB | vendor |
| CLI-24 | Real NBC fiscal | ADR | STUB | Y cashier mock | — | — | — | STUB | external |

### MDM natural-person identity

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | Status | Blocker |
|----|------------|-----|-----|-------|----------|----------|------------|--------|---------|
| CLI-MDM-01 | Practitioner MDM link | ADR | Y | — | Y `/admin/master-data` | — | — | SHIPPED | — |
| CLI-MDM-02 | Patient intake resolve | PRD M1 | Y | Y `/patients` | Y | — | — | SHIPPED | — |
| HOT-MDM-01 | Guest create/edit MDM link + masked ops-profile | ADR | Y | Y GuestCardModal | Y | — | — | SHIPPED | — |
| FIN-CIT-01 | Natural person via MDM (HR/CP) | TZ §28.2 | Y | — | Y | Y | — | SHIPPED | — |
| FIN-HR-MDM-01 | Employee payroll mirror + MDM person read-through | ADR | Y | — | Y | Y | — | SHIPPED | Plan D — no local FIN/name |
| CP-WF-PII-01 | Workforce employments/absences MDM batch display + hire resolve | ADR | Y | — | — | Y `/workspace/workforce/*` | Y | SHIPPED | masked FIN default |
| FIN-CP-MDM-01 | Counterparty ИП FIN → globalPersonId | ADR | Y | — | Y modal | Y | — | SHIPPED | — |
| BANK-MDM-01 | CIF natural + UBO resolve | ADR D4 | Y | Y CIF modal | Y API | — | — | SHIPPED | — |
| ORCH-MDM-01 | Org register → GlobalLegalEntity | ADR | Y | — | — | Y | Y | SHIPPED | — |
| ORCH-MDM-02 | internal resolve/merge API | ADR | Y | — | — | — | HEADLESS | HEADLESS | service token |

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
| HOT-01 | Master data CRUD | Y | Y `/admin/master-data` | SHIPPED | — |
| HOT-02 | BAR rates Excel import | partial | wizard | BLOCKED | Nafta Excel export |
| HOT-03 | Guest notify H-BL-06 | Y | send pages | STUB | Twilio/SendGrid |
| HOT-04 | e-qaimé H-BL-24 | stub | folio read-only | STUB | prod cert |
| HOT-05 | Elektraweb import | Y | — | SHIPPED | SuperAdmin only `/admin/import` |
| HOT-MDM-01 | Guest MDM link (create/edit/merge) | Y | Y GuestCardModal | SHIPPED | — |
| HOT-MDM-02 | Guest MDM ops-profile masked display | Y `/api/mdm/person-ops-profile` | Y GuestCardModal | SHIPPED | — |

---

## era-fnb-pos (highlights)

| ID | Capability | OpsUI | Status | Blocker |
|----|------------|-------|--------|---------|
| FNB-01 | CARD pay + shift | Y `/orders` | SHIPPED | — |
| FNB-02 | Real KKM NBC | mock | STUB | external |
| FNB-03 | Admin modal CRUD | Partial | API | P06 UI program |

---

## era-finance-core (highlights)

| ID | Capability | SatAdmin | Status | Blocker |
|----|------------|----------|--------|---------|
| FIN-01 | GL / documents ERP | Y web | SHIPPED | — |
| FIN-02 | Satellite event worker | — | HEADLESS | by design |
| FIN-03 | e-qaimé | stub modal | STUB | prod cert |
| FIN-04 | NAS / reference hub | Y `/admin/data` | SHIPPED | — |
| FC-FX-01 | Converter + revaluation on hub CBAR | Y | SHIPPED | `ERA_DATA_HUB_ENABLED` |
| FC-FX-02 | Customs auto CBAR on bgdDate | Y | SHIPPED | Finance Trade Pro |

---

## era-data-hub · FX (reference data)

| ID | Capability | Doc | API | Status | Blocker |
|----|------------|-----|-----|--------|---------|
| DH-REGISTRY | Hub `/registry/v1` health + auth | ADR | Y | HEADLESS | service token |
| DH-FX-01 | Hub FX ingest + `/fx/*` API | TZ §FX | Y | SHIPPED | `ERA_DATA_HUB_DATA_SOURCE=hub` prod |
| FC-DH-001 | Finance FX consumer | PRD §4.18 | Y | SHIPPED | — |
| FC-DH-002 | Finance HS/customs tariffs | PRD §4.18 | Y | SHIPPED | — |
| FC-DH-003 | Finance calendar consumer | PRD §4.18 | Y | SHIPPED | — |
| FC-DH-004…010 | Banks/IBAN/VÖEN/geo/UoM/tax/CoA | PRD §4.18 | Y | SHIPPED | hub + fallback |
| FC-DH-COA | PostingRole de-hardcode CI | TZ §28.3 | — | HEADLESS | `lint-nas-literals.mjs` |
| LOG-REF-01 | Logistics HS/FX preview via Finance | Y `/customs` | Y | SHIPPED | — |
| BANK-REF-01 | Bank multi-catalog hub + snapshot | — | Y | API | on-prem snapshot |
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
| CN-CAL-02 | Construction timesheet → CP → Finance | ADR F2 | Y event | — | — | — | — | HEADLESS | Import + CP approve + Finance consumer |
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
| ORCH-02 | Module toggle modal | Y | — | SHIPPED |
| ORCH-03 | MDM persons write | — | Y | SHIPPED |
| ORCH-MDM-01 | Org register → GlobalLegalEntity | Y | Y | SHIPPED |
| ORCH-MDM-02 | internal resolve/merge API | — | HEADLESS | `[h]` |
| ORCH-04 | Vendor SMS/email prod | — | — | STUB |

---

## era-orchestrator CP workforce (Plan A)

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | UAT-SMOKE |
|----|------------|-----|-----|-------|----------|----------|------------|-----------|
| CP-WF-EMP-01 | Minimal employment (MDM hire) | ADR cp-workforce-absence-split | `POST /platform/v1/workforce/employments` | — | — | Y | — | Workspace → employments → hire by globalPersonId + orgUnit + position |
| CP-WF-ABS-01 | Absence workflow | ADR cp-workforce-absence-split | `/platform/v1/workforce/absences/*` | — | — | Y | — | create → submit → approve on `/workspace/workforce/absences` |
| CP-WF-ORG-01 | Org structure (OrgUnit tree) | ADR cp-workforce-org-units | `/platform/v1/workforce/org-units/*` | — | — | Y | — | bootstrap scope → create tree on `/workspace/workforce/org-structure` |
| CP-WF-POS-01 | Cadre positions (slots) | ADR cp-workforce-org-units | `/platform/v1/workforce/positions/*` | — | — | Y | — | create position on `/workspace/workforce/positions` |
| CP-WF-SEC-01 | Security Admin (matrix, grants, bindings, seats, audit) | ADR cp-workforce-role-templates-and-security-admin | `/platform/v1/workforce/security/*`, `/role-templates`, `/manual-grants` | — | — | Y | — | `/workspace/workforce/security` matrix + manual grants |
| CP-WF-HIRE-01 | CP hire + STAFF_PROVISIONED | ADR cp-workforce-role-templates-and-security-admin | `POST /platform/v1/workforce/employments/hire` | — | — | Y | — | hire wizard with satellite checkboxes → clinic login |

## era-finance-core HR mirror (Plan A + B + C)

| ID | Capability | Doc | API | OpsUI | SatAdmin | OrgOwner | SuperAdmin | UAT-SMOKE |
|----|------------|-----|-----|-------|----------|----------|------------|-----------|
| FIN-HR-ABS-01 | Absence payroll mirror + calculators | TZ §7.0.2 | `GET /hr/absences`, vacation/sick calc | Y (read) | — | — | — | CP approve → Finance payroll list + syncAbsences |
| FIN-HR-CC-01 | CostCenter mirror (Department/JobPosition) | ADR cp-workforce-org-units | `GET /hr/departments`, `GET /hr/job-positions` | Y (read) | — | — | — | HEADLESS — CP org event → mirror row; UI banner → Workspace |

---

## Other industry satellites

Modal CRUD audit (LOCAL_UAT §5): **Partial** for FB, Ret, Log, Con, CRM, Auto, Cli (pre-this-PR), Who. See per-app DELIVERY `[~]` rows.

**era-bank-core:** L1 kernel = **HEADLESS** (no UI). **era-bank** ops satellite UI = **GA** (teller back-office, BFF-only — no local ledger). **era-bank-dbo** = customer channel GA.

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
| 2026-06-15 | Initial honest matrix; clinic CLI-* green target; cross-app highlights |
| 2026-06-16 | CLI-PRESET-* product lines per clinic ADR |
| 2026-06-15 | DH-FX / FC-FX / BK-FX / LG-FX coverage rows (CBAR ecosystem refactor) |
| 2026-06-15 | Re-audit pass 2: HT-FX/WS-FX/WS-CAL/CN/AS/CRM-CAL/LG-CAL SHIPPED; IND-VOEN; BANK-MDM UI |
| 2026-07-02 | CRM v3.0 SHIPPED: CRM-PARTY-*, CRM-IMPORT-*, CRM-CONV-01; CRM-VOEN-01 persist |
