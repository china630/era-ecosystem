# ERA Clinic — full implementation plan

Product architecture: [ADR clinic-product-lines-and-presets](../../docs/adr/clinic-product-lines-and-presets.md)  
PRD: [../PRD.md](../PRD.md) · Coverage: [../../docs/COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md#era-clinic-cli) · Delivery: [DELIVERY-CLINIC.md](./DELIVERY-CLINIC.md)

**Goal:** one shippable `era-clinic` satellite with honest actor coverage, operation presets, MDM discipline, and a clear path to `inpatient_day` — without a second satellite.

**Definition of done (per capability):** [era-coverage-definition.mdc](../../.cursor/rules/era-coverage-definition.mdc) — COVERAGE_MATRIX row + DELIVERY tag + UAT-SMOKE UI path.

---

## Current baseline (2026-06-16)

| Area | State |
|------|--------|
| Outpatient ops | Appointments, visit, lab, queue, scheduling — **SHIPPED** |
| SatAdmin | Master data, patients, catalog, templates, procedure rules, settings, audit — **SHIPPED** (recent wave) |
| Sanatorium | Episodes, chart, program quota, procedure rules — **SHIPPED** (Nafta) |
| Presets | `Outlet.preset` in schema — **not wired** in UI/config |
| MDM | `globalPersonId` on `PatientRef` — **partial** (not mandatory on all flows) |
| Inpatient M13 | Ward/bed models + assign UI — **Partial** (no ward admin; free-text codes) |
| Hotel bridge | Lifecycle ingress — **partial** (HTTP bridge + fan-out in progress per sanatorium ADR) |
| Fiscal | Cashier mock — **STUB** |
| HL7 / NBC prod | **STUB / deferred** |

---

## Target presets (end state)

| Preset | Nav / routes gated | Module keys (orchestrator, future) |
|--------|-------------------|--------------------------------------|
| `outpatient` | Default ops only | `clinic_outpatient` |
| `sanatorium_clinical` | + sanatorium, program, compatibility rules | `clinic_sanatorium` |
| `inpatient_day` | + inpatient ADT, ward admin | `clinic_inpatient_day` |
| `wellness` | Scheduling + resources only (SV8) | `clinic_wellness` |

Implementation: `Tenant` / `Outlet.preset` + `requireClinicPreset()` in middleware/nav (new).

---

## Phase 0 — Governance & structure (1–2 weeks)

**Outcome:** docs and code boundaries aligned; no new clinical features.

| ID | Task | Artifacts |
|----|------|-----------|
| P0-01 | ADR product lines | `docs/adr/clinic-product-lines-and-presets.md` ✓ |
| P0-02 | PRD § product lines + scope fix | `era-clinic/PRD.md` |
| P0-03 | Retag DELIVERY M13 / K1 drift | `doc/DELIVERY-CLINIC.md` |
| P0-04 | COVERAGE_MATRIX preset rows | `docs/COVERAGE_MATRIX.md` CLI-PRESET-* |
| P0-05 | Internal `src/domain/` layout doc | `era-clinic/doc/ARCHITECTURE.md` |
| P0-06 | Move services → domain incrementally (first slice: master-data + patient) | `src/domain/master-data/*`, `src/domain/patient/*` |
| P0-07 | Module map update | `.cursor/rules/era-clinic-module-map.mdc` |

---

## Phase 1 — Foundation hardening (2–3 weeks)

**Outcome:** demo-ready outpatient; MDM and catalogs enforced.

| ID | Task | CLI / module | Actors |
|----|------|--------------|--------|
| P1-01 | **Mandatory MDM** on patient create/update | CLI-06 | OpsUI |
| P1-02 | Practitioner ↔ `globalPersonId` / HR provision hook | CLI-01 | SatAdmin |
| P1-03 | ICD picklist only (remove free-text on sanatorium diagnosis) | CLI-13 | OpsUI |
| P1-04 | Ward/bed **SatAdmin CRUD** (replace free-text assign) | CLI-15 | SatAdmin |
| P1-05 | **Preset config** API + admin UI (`outpatient` default) | CLI-PRESET-01 | SatAdmin |
| P1-06 | Nav/route gating by preset | — | all |
| P1-07 | Waitlist + appointment reminders (orchestrator notify) | K3 | OpsUI |
| P1-08 | Visit cancel with reason K-15 | PRD | OpsUI |
| P1-09 | i18n / procedure-rules ru/az gaps | — | — |
| P1-10 | Expand UAT-SMOKE all admin paths | — | QA |

**Tests:** domain unit tests for patient MDM, master-data, ward CRUD.

---

## Phase 2 — Outpatient excellence (2–3 weeks)

**Outcome:** `outpatient` preset **SHIPPED** end-to-end.

| ID | Task | Notes |
|----|------|-------|
| P2-01 | Smart scheduler polish (resource conflicts, practitioner duration in master data) | SANATORIUM plan §1.1 |
| P2-02 | Doctor/nurse queue UX (role dashboards) | `/doctor`, `/nurse` |
| P2-03 | CPOE modal + template picker wired to admin templates | M10; catalog [DIAGNOSTIC_AND_LAB_CATALOG.md](./DIAGNOSTIC_AND_LAB_CATALOG.md) seeded — UI renderer still pending |
| P2-04 | Catalog sync schedule + stale indicator | M6 |
| P2-05 | Cashier structured flow + `@era/fiscal` mock unified | CLI-24 STUB ok |
| P2-06 | Executive KPI filters (date, practitioner) | K-14 |
| P2-07 | Portal hardening (token scope, lab publish link) | M8 |

---

## Phase 3 — Sanatorium clinical pack (3–4 weeks)

**Outcome:** `sanatorium_clinical` preset **SHIPPED**; hotel bus not HTTP-only.

Depends: orchestrator fan-out (sanatorium-vnext wave 2).

| ID | Task | ADR |
|----|------|-----|
| P3-01 | Hotel lifecycle → clinic via bus only (remove direct bridge) | SV1, SV10 |
| P3-02 | Program instantiate on check-in + medical reservation | SV11 |
| P3-03 | Treatment planner + capacity executive band | vNext |
| P3-04 | `patientOrigin` billing router E2E tests | SV5 |
| P3-05 | Retail prescription reserve / procedure consumption | SV12 |
| P3-06 | PII boundary tests (hotel sees no diagnosis) | SV13 |
| P3-07 | Nafta UAT doc refresh | NAFTA_SANATORIUM_UAT |

Preset gate: sanatorium nav hidden unless `sanatorium_clinical` or bundle entitled.

---

## Phase 4 — Inpatient day preset (3–4 weeks)

**Outcome:** `inpatient_day` **SHIPPED** — not full HIS.

| ID | Task | Scope |
|----|------|-------|
| P4-01 | ADT-light: admit, transfer bed, discharge | New domain module |
| P4-02 | Link admission → visit or inpatient encounter model | Schema decision |
| P4-03 | Daily ward charge event → Finance | New contract field or event |
| P4-04 | Inpatient nav + ward board UI | OpsUI |
| P4-05 | COVERAGE CLI-15 → SHIPPED (no free-text) | Matrix |
| P4-06 | **Extract candidacy:** stabilize API → start `packages/clinic-domain` spike | ADR D5 |

**Explicitly out of Phase 4:** OR scheduling, MAR, ward pharmacy, DRG.

---

## Phase 5 — Platform & integrations (ongoing / parallel)

| ID | Task | Status target |
|----|------|---------------|
| P5-01 | HL7/file LIS adapter interface | STUB → API |
| P5-02 | Orchestrator ICD-10 AZ subset (read-only API) | new platform API |
| P5-03 | `clinic_*` module keys on orchestrator pricing | CP seed |
| P5-04 | `wellness` preset (SV8) | SHIPPED minimal |
| P5-05 | NBC fiscal via `@era/fiscal` prod provider | STUB until cert |
| P5-06 | Workforce clock / staff roster display | HR events |

---

## Phase 6 — Hospital HIS appendix (future — separate PRD section)

Only after Phase 4 stable and customer pull:

- OR management
- Medication administration (MAR)
- Ward pharmacy / controlled substances
- Case billing / DRG-like aggregation in Finance

**Architecture default:** still `era-clinic` + module keys; spin-off satellite only per ADR decision tree.

---

## Suggested execution order (single PR stream)

```text
P0 governance + domain folders
  → P1 MDM + ward admin + presets
  → P2 outpatient polish
  → P3 sanatorium bus (parallel with P2 if team split)
  → P4 inpatient_day
  → P5 integrations
  → P6 hospital HIS appendix (product decision)
```

---

## Metrics

| Metric | Source |
|--------|--------|
| SHIPPED % (strict) | `node scripts/readiness-strict-delivery.mjs` |
| Per-capability | `docs/COVERAGE_MATRIX.md` CLI-* |
| Preset readiness | CLI-PRESET-* rows (add in P0-04) |
| Nafta demo | `doc/UAT-SMOKE.md` + docker `RUN_SEED` |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Scope creep into full HIS | Preset + ADR; Phase 6 gate |
| Second satellite too early | ADR D5 — domain folder first |
| M13 oversold | Rename delivery to ward-lite until P4 |
| Sanatorium blocked on orchestrator fan-out | P3 dependency explicit |

---

## Changelog

| Date | Note |
|------|------|
| 2026-06-16 | Initial plan — presets, phases 0–6 |
