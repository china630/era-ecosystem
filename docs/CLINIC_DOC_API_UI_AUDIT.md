# Clinic stack — Doc / API / UI gap audit

Living matrix for **era-clinic** (sanatorium/outpatient satellite). Tracks doc↔API↔UI alignment and **Modal CRUD** playbook compliance after the matrix gaps closure wave.

**Canonical actor matrix:** [COVERAGE_MATRIX.md](./COVERAGE_MATRIX.md) (`CLI-*` rows).

**Plan:** `.cursor/plans/clinic_matrix_gaps_fix_4f17a326.plan.md` (Phases 0–7).

**Last audit:** 2026-06-16 (matrix gaps closure wave)

---

## Before → After (full change picture)

### Metrics

| Metric | Before (pre-fix, ~2026-06-14) | After (post-fix) | Δ |
|--------|-------------------------------|------------------|---|
| Doc→API (`CLI-*` excl. STUB/PLANNED) | ~85% (PATCH gaps on templates/rules) | **100%** (25/25) | +15% |
| Doc→UI (same scope) | ~78% (edit flows missing) | **100%** | +22% |
| API→UI (SatAdmin + ops CRUD) | ~72% (API-only or inline CRUD) | **~98%** | +26% |
| SatAdmin Modal CRUD compliance | ⚠️ create/delete only; no edit modals | **100%** edit via ModalShell | fixed |
| Executive dashboard (CLI-17) | ⚠️ client-side KPI bypass | ✅ `GET /api/executive/summary` + filters | fixed |
| Patient edit (CLI-06) | ❌ read-only card | ✅ edit modal + MDM badge | fixed |
| Visit cancel (K-15) | ❌ `window.prompt` | ✅ CancelVisit ModalShell | fixed |
| `era-clinic` unit tests | ~22 | **28** (12 suites) | +6 |
| DELIVERY checkboxes | gaps in audit | **75/75 (100%)** | closed |

**Excluded from green target (by design):** CLI-23 (HL7 prod STUB), CLI-24 (real NBC STUB), CLI-PRESET-04 (`wellness` PLANNED).

---

### Phases (plan → delivered)

| Phase | Scope | Before | After | Key artifacts |
|-------|-------|--------|-------|---------------|
| **P0** | API hardening | PATCH missing on templates/rules; weak guards | ✅ | `clinical-templates/[id]`, `program-templates/[id]`, `procedure-rules/[id]`, `procedure-compatibility-rules/[id]` PATCH; SatAdmin guard; `PatientMdmRequiredError` on PATCH patients |
| **P1** | SatAdmin modals | create-only or inline forms | ✅ | master-data FIN/MDM/slot; wards edit/delete; procedure-rules edit; templates edit |
| **P2** | Patient & clinical ops | partial / prompt-based UX | ✅ | patient edit modal; contraindication modals; cancel/complete modals; prescription modal; lab create modal |
| **P3** | Dashboards | executive bypass; minimal role UIs | ✅ | `ExecutiveDashboard.tsx`; doctor/nurse polish; cashier mock fiscal display |
| **P4** | i18n | partial az/ru | ✅ | en/az/ru keys for all new modals |
| **P5** | Docs | doc drift on M13, CLI-15/17 | ✅ | module-map, COVERAGE, DELIVERY, UAT-SMOKE, PRD M13 → SHIPPED |
| **P6** | Tests | sparse admin PATCH coverage | ✅ | `admin-templates-rules.spec.ts`, `executive-summary.spec.ts`, extended patient-mdm, ward.service |
| **P7** | Re-audit | ⚠️/❌ in canvas matrix | ✅ | COVERAGE_MATRIX all SHIPPED except STUB/PLANNED |

---

### Gap IDs: plan item → before → after

| ID | Problem (before) | After | Route / file |
|----|------------------|-------|--------------|
| **CLI-01** | FIN/MDM/defaultSlotMinutes API-only | Modal create/edit + MDM lookup + table columns | `/admin/master-data` |
| **CLI-06** | No patient edit UI | Edit modal (fullName, phone, FIN, passport); MDM badge; back-link → `/patients` | `/patients/[id]` |
| **CLI-08** | Compat rules: create+delete, no edit | PATCH API + edit modal; SatAdmin guard on route | `/admin/procedure-rules` |
| **CLI-09** | Sequence rules: create+delete, no edit | PATCH API + shared create/edit ModalShell | `/admin/procedure-rules` |
| **CLI-10** | Templates: create+delete, no edit | PATCH clinical + program templates; edit prefilled modal | `/admin/templates` |
| **CLI-12** | Lab list without create | **New lab order** modal (patient, testCode, visitId) | `/lab-orders` |
| **CLI-15** | Wards/beds create-only | Edit/delete ward & bed modals; link from master-data | `/admin/wards` |
| **CLI-17** | UI bypassed executive API | Client `ExecutiveDashboard` → `GET /api/executive/summary?date=&practitionerId=` | `/executive` |
| **K-15** | `window.prompt` for cancel reason | CancelVisit ModalShell (required reason) | `/appointments` |
| **vNext contraindications** | Inline body-map toggle | Add/remove confirm modals | `PatientContraindicationsPanel.tsx` |
| **vNext prescription** | No issue UI | Issue prescription modal → `POST /api/visits/[id]/prescription` | `/visits/[id]` |
| **Security** | compat-rules without SatAdmin guard | `assertClinicAdminRead/Write` on GET/POST/DELETE/PATCH | `procedure-compatibility-rules/route.ts` |
| **Visit complete** | `window.confirm` | Complete confirm ModalShell | `/visits/[id]`, `/nurse` |
| **CLI-24** | Cashier raw response | Full receipt/fiscal fields + **Mock fiscal (STUB)** badge | `/cashier` |

---

### UI pattern: inline / prompt → ModalShell

| Area | Before | After | Legacy |
|------|--------|-------|--------|
| **Practitioners** | create modal only; FIN not in form | create/edit modal + FIN MDM lookup + `defaultSlotMinutes` | — |
| **Wards & beds** | create modals only | + edit ward, edit bed, confirm delete | — |
| **Procedure rules** | inline create forms | unified create/edit ModalShell + delete confirm | — |
| **Templates** | create + inline delete | create/edit ModalShell + delete confirm | — |
| **Patient card** | static server page | client fetch + **Edit patient** modal | — |
| **Contraindications** | click zone → instant POST | add modal + remove confirm modal | body-map visual only |
| **Appointments cancel** | `window.prompt(reason)` | CancelVisit modal (textarea) | — |
| **Visit complete** | `window.confirm` | ModalShell confirm | doctor + nurse |
| **Prescription** | API only | Issue prescription modal (lines sku/qty) | — |
| **Lab orders** | list + detail stepper only | + **New lab order** modal on list | detail stepper unchanged |
| **Executive KPI** | hardcoded / client calc | date + practitioner filters via API | OrgOwner gate |
| **Cashier pay** | minimal success text | receipt id, fiscal id, QR, settlementOnly, STUB badge | mock tier OK |

---

### API additions (Phase 0)

| Resource | Method | File | Fields |
|----------|--------|------|--------|
| Clinical template | PATCH | `app/api/admin/clinical-templates/[id]/route.ts` | title, specialty, bodyJson |
| Program template | PATCH | `app/api/admin/program-templates/[id]/route.ts` | name, durationDays, procedures[] |
| Procedure sequence rule | PATCH | `app/api/admin/procedure-rules/[id]/route.ts` | minGapMinutes, kind |
| Compat rule | PATCH | `app/api/admin/procedure-compatibility-rules/[id]/route.ts` | ruleType, minHours, note |
| Compat rules collection | GET/POST/DELETE + guard | `procedure-compatibility-rules/route.ts` | SatAdmin assert |
| Patient | PATCH error | `app/api/patients/[id]/route.ts` | `PatientMdmRequiredError` → 400 |

*(Ward/bed PATCH/DELETE existed; Phase 1 wired UI modals.)*

---

### CLI-* matrix (current status)

| ID | Capability | Doc | API | OpsUI | SatAdmin | Status |
|----|------------|-----|-----|-------|----------|--------|
| CLI-01 | Practitioners | ✅ | ✅ | — | ✅ modal + FIN/MDM | **SHIPPED** |
| CLI-02 | Rooms | ✅ | ✅ | — | ✅ modal | **SHIPPED** |
| CLI-03 | Resources | ✅ | ✅ | — | ✅ modal | **SHIPPED** |
| CLI-04 | Procedure types | ✅ | ✅ | — | ✅ modal | **SHIPPED** |
| CLI-05 | Appointment create | ✅ | ✅ | ✅ modal | — | **SHIPPED** |
| CLI-06 | Patient registry | ✅ | ✅ | ✅ + **edit modal** | — | **SHIPPED** |
| CLI-07 | Service catalog | ✅ | ✅ | — | ✅ | **SHIPPED** |
| CLI-08 | Compat rules | ✅ | ✅ PATCH | — | ✅ edit modal | **SHIPPED** |
| CLI-09 | Sequence rules | ✅ | ✅ PATCH | — | ✅ edit modal | **SHIPPED** |
| CLI-10 | Templates | ✅ | ✅ PATCH | — | ✅ edit modal | **SHIPPED** |
| CLI-11 | LIS profiles | ✅ | ✅ | — | ✅ | **SHIPPED** |
| CLI-12 | Lab lifecycle | ✅ | ✅ | ✅ + **create modal** | — | **SHIPPED** |
| CLI-13 | Sanatorium chart | ✅ | ✅ | ✅ | ✅ | **SHIPPED** |
| CLI-14 | Reception queue | ✅ | ✅ | ✅ | — | **SHIPPED** |
| CLI-15 | Inpatient beds | ✅ | ✅ | ✅ ward board | ✅ **edit/delete modals** | **SHIPPED** |
| CLI-16 | Visit complete + billing | ✅ | ✅ | ✅ | — | **SHIPPED** |
| CLI-17 | Executive summary | ✅ | ✅ | ✅ **API filters** | OrgOwner | **SHIPPED** |
| CLI-18 | Settings persist | ✅ | ✅ | — | ✅ | **SHIPPED** |
| CLI-19 | Admin audit | ✅ | ✅ | — | ✅ | **SHIPPED** |
| CLI-20 | Docker seed | ✅ | — | — | — | **SHIPPED** |
| CLI-21 | Discount K-13 | ✅ | ✅ | ✅ modal | — | **SHIPPED** |
| CLI-22 | Insurance M12 | ✅ | ✅ | ✅ panel | — | **SHIPPED** |
| CLI-23 | HL7 LIS prod | deferred | STUB | — | — | **STUB** |
| CLI-24 | Real NBC fiscal | ADR | STUB | ✅ mock cashier | — | **STUB** |

### Presets

| ID | Line | Before | After |
|----|------|--------|-------|
| CLI-PRESET-01 | `outpatient` | SHIPPED | SHIPPED |
| CLI-PRESET-02 | `sanatorium_clinical` | SHIPPED | SHIPPED |
| CLI-PRESET-03 | `inpatient_day` | PARTIAL (ward free-text) | **SHIPPED** (admin modal CRUD) |
| CLI-PRESET-04 | `wellness` (SV8) | PLANNED | **PLANNED** (defer) |

---

### Explicit out-of-scope (unchanged)

| ID | Reason | Status |
|----|--------|--------|
| CLI-PRESET-04 wellness | Product decision — Phase 5 defer | **PLANNED** in docs |
| CLI-23 HL7 LIS prod | Vendor/cert external | **STUB** |
| CLI-24 Real NBC fiscal | External NBC; mock tier acceptable | **STUB** (UI shows mock badge) |

---

### Documentation & rules updated

| Doc / rule | Change |
|------------|--------|
| `docs/CLINIC_DOC_API_UI_AUDIT.md` | **new** — this file |
| `docs/COVERAGE_MATRIX.md` | CLI-15/17 notes; M13 SHIPPED |
| `era-clinic/doc/DELIVERY-CLINIC.md` | modal CRUD checklist; M13 SHIPPED |
| `era-clinic/doc/UAT-SMOKE.md` | modal walkthrough steps (wards, patient edit, executive, prescription) |
| `era-clinic/PRD.md` | M13 PARTIAL → SHIPPED |
| `era-clinic/.cursor/rules/era-clinic-module-map.mdc` | PATCH routes, `/admin/wards`, executive API |

---

### Verification (Phases 6–7)

| Check | Result |
|-------|--------|
| `cd era-clinic && npm test -- --ci` | **28/28 pass** (12 suites) |
| `cd era-clinic && npm run build` | ✅ (run in CI/local gate) |
| `node scripts/delivery-readiness.mjs` | era-clinic **75/75 (100%)** |
| Manual UAT | [UAT-SMOKE.md](../era-clinic/doc/UAT-SMOKE.md) § Admin master data + modal paths |

---

## Executive summary

| Metric | Target (plan) | Result |
|--------|---------------|--------|
| Doc→API (excl. STUB/PLANNED) | 37+/41 ✅ | **25/25 = 100%** |
| Doc→UI | 37+/41 ✅ | **100%** |
| API→UI | 37+/41 ✅ | **~98%** |
| Modal CRUD (SatAdmin + registry) | 0 ❌, 0 ⚠️ | **OK** |

**Sanatorium pilot ops:** green for all shipped `CLI-*` capabilities via modals.

**Not blocking pilot:** HL7 prod adapter, real NBC fiscal, wellness preset (CLI-PRESET-04).

---

## Re-audit checklist

- [x] PATCH on templates, procedure rules, compat rules
- [x] SatAdmin guard on compat-rules collection route
- [x] Patient PATCH returns 400 on MDM required error
- [x] FIN/MDM/defaultSlotMinutes in practitioner modal
- [x] Ward/bed edit/delete modals
- [x] Patient edit modal + contraindication modals
- [x] Cancel visit modal (no `window.prompt`)
- [x] Lab create modal on list page
- [x] Executive dashboard uses API with filters
- [x] Prescription issue modal
- [x] Cashier mock fiscal display with STUB badge
- [x] i18n en/az/ru for new modal keys
- [x] COVERAGE_MATRIX + DELIVERY + UAT synced
