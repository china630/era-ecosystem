# Nafta stack — Doc / API / UI gap audit

Living matrix for **Nafta sanatorium pilot** satellites: find features documented as shipped but missing API or UI, and APIs without operator screens.

**Canonical actor matrix:** [COVERAGE_MATRIX.md](./COVERAGE_MATRIX.md) (Doc / API / UI × Ops / SatAdmin / OrgOwner / SuperAdmin).

**Method:** for each capability, classify layers:

| Layer | Source of truth |
|-------|-----------------|
| **Doc** | `DELIVERY*.md`, `BACKLOG-PRODUCTION.md`, `UAT-SMOKE.md`, ADR, `nafta/*`, PRD/TZ |
| **API** | Route handlers (`app/api/*`, Nest controllers) |
| **UI** | Pages (`app/**/page.tsx`), modals linked from nav, admin screens |

**Gap types:**

| Tag | Meaning |
|-----|---------|
| **OK** | Doc ≈ API ≈ UI for declared actor (or HEADLESS by design) |
| **API-only** | Backend exists; FO/ops cannot act without curl/Postman |
| **UI-only** | Screen exists; thin or undocumented |
| **Doc-only** | Documented / planned; no implementation |
| **Doc drift** | Doc says Done; code differs |
| **Partial** | Two of three layers OK; third incomplete |
| **Orphan UI** | Page exists but not in app shell nav |

**Nafta stack scope** ([NAFTA_SANATORIUM_UAT.md](./NAFTA_SANATORIUM_UAT.md)):

| Satellite | Port | Role |
|-----------|------|------|
| era-orchestrator | 3000 / 4000 | Launcher, MDM, billing, events gateway |
| era-finance-core | 3100 / 4100 | GL, AR, invoices, HR (parent org) |
| era-hotel-pms | 3201 | FO, folio, medical ops, distribution |
| era-fnb-pos | 3202 | Restaurant POS, room charge, banquet extras |
| era-clinic | 3203 | Sanatorium clinical, lab, queue |
| era-retail-pos | 3204 | Pharmacy retail (optional department) |

**Last audit:** 2026-06-15 (coverage honesty + clinic admin wave)

---

## Executive summary

| Satellite | Doc (strict) | API | Ops UI | SatAdmin UI | Top gap pattern |
|-----------|--------------|-----|--------|-------------|-----------------|
| **hotel-pms** | high | ~96% | ~94% | master-data SHIPPED | bar-rates Excel BLOCKED; notify STUB |
| **era-clinic** | realigned | ~93% | ~85% post-wave | master-data was missing → **fixed 2026-06-15** | was doc drift M1/M2 |
| **era-fnb-pos** | high | ~94% | ~92% | menu partial | Real KKM external |
| **era-finance-core** | quartet-only DELIVERY | ~88% | ERP strong | `/admin/data` | event worker HEADLESS |
| **era-orchestrator** | high | ~96% | launcher OK | super-admin OK | vendor notify STUB |

**Previous audit (2026-06-14) overstated clinic UI (~90%)** by counting ops flows (sanatorium, queue, LIS) while **master data, appointment create, patient registry** were API-only — see [COVERAGE_MATRIX CLI-*](./COVERAGE_MATRIX.md#era-clinic-cli).

---

## Post-run remainder (external / by-design only)

| ID | Area | Status | Notes |
|----|------|--------|-------|
| P3 | Staff provision webhook | By design | orchestrator → satellite |
| P3 | OTA webhook ingest (prod creds) | External | adapter stub OK |
| — | hotel bar-rates adapter | Blocked | [IMPORT-PRICING-MAP](../era-hotel-pms/doc/nafta/IMPORT-PRICING-MAP.md) |
| — | hotel/clinic HL7 / NBC / e-qaimé | STUB | prod vendor |
| — | finance E8 consumption event | HEADLESS | Finance worker |

---

## era-clinic (full matrix)

| Feature | Doc | API | OpsUI | SatAdmin | Gap (pre-2026-06-15) | Now |
|---------|-----|-----|-------|----------|------------------------|-----|
| Practitioners / rooms / resources | M2 | partial | — | **missing** | Doc drift | **SHIPPED** `/admin/master-data` |
| Procedure types | vNext | read-only | — | **missing** | Doc drift | **SHIPPED** master-data tab |
| Patient registry M1 | PRD | partial | **missing** | — | Doc drift | **SHIPPED** `/patients` |
| Appointment create K-01 | PRD | yes | **missing** | — | API-only | **SHIPPED** modal |
| Service catalog M6 | PRD | yes | — | **missing** | API-only | **SHIPPED** `/admin/catalog` |
| Procedure rules | M11 | yes | — | inline form | UX + FIFO rules | **SHIPPED** modal + tabs |
| Clinical/program templates | vNext | Y | Y CPOE | Y diagnostic + packages | dual SoT | **SCREEN** `/admin/diagnostic-catalog` + `/admin/program-templates` + `/visits/[id]` CPOE; `ClinicalTemplate` dropped ([doc](../era-clinic/doc/CLINICAL_AND_PROGRAM_TEMPLATES.md)) |
| LIS profiles | M11 | yes | — | yes | OK | **OK** |
| Sanatorium chart | K5 | yes | yes | yes | OK | **OK** |
| Reception queue | W3 | yes | yes | — | OK | **OK** |
| Lab lifecycle | K2 | yes | yes | — | OK | **OK** |
| Inpatient M13 | PRD | yes | yes | assign modal | ward master free-text | **SHIPPED** `/admin/wards` edit/delete |
| Executive K-14 | PRD | yes | yes filters | — | client bypass | **SHIPPED** API-driven |
| Docker demo seed | ops | — | — | — | missing | **SHIPPED** `RUN_SEED` |
| HL7 LIS prod | deferred | stub | — | — | external | **STUB** |

---

## era-hotel-pms (updated highlights)

| Feature | Doc | API | UI | Gap |
|---------|-----|-----|-----|-----|
| Channel mappings | H-BL-25 | yes | `/channel` | **OK** |
| BAR bootstrap | IMPORT-PRICING-MAP | yes | wizard 21a | **OK** |
| Import bar-rates | IMPORT-PRICING-MAP | partial | wizard | **Blocked (Excel)** |
| Omnichannel H-BL-06 | BACKLOG | STUB vendor | send pages | **Partial (STUB)** |
| Master data admin | DELIVERY | yes | `/admin/master-data` | **OK** |

---

## era-fnb-pos / finance / orchestrator

See [COVERAGE_MATRIX.md](./COVERAGE_MATRIX.md) FNB-*, FIN-*, ORCH-* rows.

---

## Module maps

| Satellite | Map |
|-----------|-----|
| clinic | `era-clinic/.cursor/rules/era-clinic-module-map.mdc` |
| hotel-pms | `era-hotel-pms/.cursor/rules/era-hotel-pms-module-map.mdc` |
| fnb-pos | `era-fnb-pos/.cursor/rules/era-fnb-pos-module-map.mdc` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-14 | Initial Nafta stack audit; waves A–F |
| 2026-06-16 | Clinic matrix gaps closure; [CLINIC_DOC_API_UI_AUDIT.md](./CLINIC_DOC_API_UI_AUDIT.md) before/after tables |
