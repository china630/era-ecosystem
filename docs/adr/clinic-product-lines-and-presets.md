# ADR: Clinic product lines, operation presets, and domain packaging

## Status

Accepted — 2026-06-16

## Related

- [sanatorium-vnext.md](./sanatorium-vnext.md) (SV6 single clinical engine, SV8 wellness preset)
- [clinic-multi-resource-scheduling.md](./clinic-multi-resource-scheduling.md) (Pattern A sanatorium / Pattern B outpatient)
- [workforce-identity-and-hr-provisioning.md](./workforce-identity-and-hr-provisioning.md)
- [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md)
- [era-clinic/PRD.md](../../era-clinic/PRD.md) · [CLINIC-FULL-IMPLEMENTATION-PLAN.md](../../era-clinic/doc/CLINIC-FULL-IMPLEMENTATION-PLAN.md)

---

## Context

Healthcare IT is often described as three commercial models:

| Model | Primary KPI | Typical MIS focus |
|-------|-------------|-------------------|
| **Outpatient clinic** | Throughput / day | Scheduling, visit, fee-for-service |
| **Inpatient / hospital (HIS)** | Bed turnover, case complexity | ADT, nursing, OR, DRG-style billing |
| **Sanatorium / resort** | RevPAR + procedure upsell | Hotel PMS + medical scheduler + packages |

ERA already ships **`era-clinic`** as ambulatory MIS-lite plus sanatorium clinical modules (Nafta). PRD §1.3 listed “inpatient, OR” as out-of-scope for v1, while M13 added a **ward stub** — creating product/doc drift.

Question: should “hospital” be a **new industry satellite**, a **new orchestrator vertical**, or an **extension of era-clinic**?

Benchmark inside ERA:

- **Retail:** one satellite, `Outlet.preset` (grocery, pharmacy, …).
- **Hotel:** one satellite, `hotel_*` module keys + City/Resort/Sanatorium bundles.
- **Sanatorium:** composition of `era-hotel-pms` + `era-clinic` + events — not a third monolithic MIS.

~70% of outpatient and light-inpatient share the same operational core (patients, practitioners, rooms/resources, scheduling, visits, lab, catalog sync, Finance events, MDM).

---

## Decision

### D1 — One clinical satellite (`era-clinic`)

There is **one** industry gate: `industry_clinic`. There is **no** separate `industry_hospital` vertical or `era-hospital-his` satellite **by default**.

Hospital / inpatient capabilities are a **product line and module pack** on the same deployment, database, SSO, and event contracts.

Aligns with sanatorium-vnext **SV6** (single clinical engine for walk-in and in-house).

### D2 — Operation presets (not separate apps)

Operation mode is configured per tenant/outlet via **`Outlet.preset`** (schema already exists) and/or tenant settings — same pattern as retail.

| Preset | Audience | Enables (high level) | Disables / defers |
|--------|----------|----------------------|-------------------|
| **`outpatient`** | Polyclinic, diagnostics | Appointments, visit, lab, catalog, queue | Sanatorium chart, program quota, hotel bridge |
| **`inpatient_day`** | Day hospital, observation ward | Ward/bed master, ADT-light, daily charges | Full HIS (OR, MAR, DRG) |
| **`sanatorium_clinical`** | Nafta in-house guests | Program templates, procedure rules, episodes, hotel lifecycle | Heavy standalone EMR |
| **`wellness`** | SPA without EMR (SV8) | Resource scheduling, light card | ICD-heavy CPOE, lab, inpatient |

**Sanatorium as a business** is still a **bundle** on orchestrator (`industry_hotel_pms` + `industry_clinic` + optional retail), not a preset used alone.

### D3 — Product line vs full HIS (scope language)

| Term | Meaning in ERA |
|------|----------------|
| **Inpatient day / ward-lite** | In scope as preset `inpatient_day` on `era-clinic` — future phase |
| **Full HIS** (OR management, MAR, ward pharmacy, DRG/case billing) | **Separate product appendix** — explicit roadmap; **not** implied by M13 stub |
| **M13 today** | Technical stub only; COVERAGE_MATRIX CLI-15 notes ward free-text gap |

PRD out-of-scope is reinterpreted: **full government-style HIS** is out; **inpatient_day preset** is in the clinic roadmap.

### D4 — Master data tiers (closed catalog rule)

All clinical and billing references must resolve through moderated catalogs — no free-text in invoices or core clinical facts.

| Tier | Owner | Examples |
|------|-------|----------|
| **Platform MDM** | Orchestrator `era_mdm` | `GlobalNaturalPerson`, FIN/passport, org VÖEN |
| **Shared clinical reference** | Orchestrator platform catalog + local clinic `IcdCode` | Full WHO ICD-10 (2019) in clinic DB now; orch `GET /platform/v1/catalog/icd10` gateway sync (W3, in-process generator, **not** data-hub); lab analyte dictionary remains satellite |
| **Operational master data** | Satellite admin | Practitioners, rooms, resources, procedure types, wards/beds |
| **Commercial** | Finance + cache in clinic | Service codes, prices, insurance contracts |

**Workforce:** practitioners link to `globalPersonId` via Finance HR provisioning when HR module is active ([workforce ADR](./workforce-identity-and-hr-provisioning.md)).

**Patients:** registration must call MDM resolve; `PatientRef.globalPersonId` mandatory on create (implementation plan).

### D5 — Code layout now; `packages/clinic-domain` later

**Now (no second app):**

```text
era-clinic/src/
  domain/          # pure services — no Next/React imports
  infra/           # prisma, external clients
  app/             # app/, pages remain under app/ (Next convention)
```

Migrate existing `src/lib/services/*` and domain logic into `src/domain/*` incrementally.

**Later — extract package when:**

1. `inpatient_day` ADT API is stable, **or**
2. A second thin shell is required (rare SKU), **or**
3. Domain unit tests need isolation from Next.

**Package boundary (future `packages/clinic-domain`):**

- In: visit/lab/scheduling/inpatient state machines, validation, types.
- Out: Prisma migrations, Next routes, i18n, middleware, UI.

Do **not** extract before a second consumer or stable inpatient API — avoid guessed public API (YAGNI).

**Do not** spin off `era-hospital-his` until maintainability forces it; prefer preset + module keys + optional package extract.

### D6 — Commercial module keys (future)

Optional billable keys under `industry_clinic` (orchestrator `pricing_modules`), mirroring `hotel_*`:

| Key | Preset / feature |
|-----|------------------|
| `clinic_outpatient` | Base (default with gate) |
| `clinic_inpatient_day` | Ward ADT-light |
| `clinic_sanatorium` | Program/quota/chart |
| `clinic_wellness` | SV8 light mode |

Marketing name “ERA Hospital” = **`industry_clinic` gate + inpatient module pack**, not a new launcher tile.

### D7 — Finance and events unchanged in principle

Money stays in Finance. Satellite emits `@era/contracts` events. Inpatient adds **new event shapes or line types** (daily ward charge, future case close) via Finance integration — not a new satellite.

---

## Consequences

**Positive**

- One deployment per org for polyclinic + ward of same legal entity.
- Reuses admin, MDM, lab, sanatorium investment.
- Clear preset story for sales (outpatient vs sanatorium vs future ward).
- Path to hospital modules without greenfield SSO/DB.

**Negative**

- Single codebase grows; requires preset guards and module keys discipline.
- Full HIS still large future effort — must not be oversold via M13 stub.

**Anti-patterns**

- New `industry_hospital` vertical for same buyer as clinic.
- Greenfield `era-hospital-his` before extract threshold.
- Free-text ICD, ward codes, or service names in production flows.

---

## Decision tree (for PRD / sales)

```text
Same legal entity, outpatient + beds?
  → one era-clinic deployment, presets outpatient + inpatient_day

Sanatorium with hotel stay?
  → hotel + clinic entitlements, preset sanatorium_clinical, bus events

SPA only, no EMR?
  → preset wellness

Full OR + MAR + DRG?
  → clinic product appendix "Hospital HIS modules"
  → still era-clinic + module keys until ADR mandates spin-off

Second satellite?
  → only after packages/clinic-domain extract + separate deploy SKU proven
```

---

## Changelog

| Date | Note |
|------|------|
| 2026-06-16 | Initial acceptance — presets, single satellite, domain packaging policy |
