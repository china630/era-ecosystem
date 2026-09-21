# ADR: SaaS extensibility (forms, print, reports) vs deep studio

**Status:** Accepted  
**Date:** 2026-09-18  
**Scope:** Cross-cutting — all cores and industry satellites. Placement + commercial packaging. Not a full schema spec.  
**Implementation:** Wave 1 hardening (finance invoice extras) + Wave 2 hardening (invoice register saved views). Platform studio is not started.  
**Related:** [deployment-topology.md](./deployment-topology.md) · [era-commercial-catalog.md](./era-commercial-catalog.md) · [platform-trial-hierarchy.md](./platform-trial-hierarchy.md) · [managed-lists-vs-enums.md](./managed-lists-vs-enums.md) · [subconto-analytical-dimensions.md](./subconto-analytical-dimensions.md) · [clinic-print-forms.md](./clinic-print-forms.md) · [statform-engine.md](./statform-engine.md) · [sanatorium-vnext.md](./sanatorium-vnext.md) (external 1C accounting adapter) · [CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md)

## Context

1C’s moat is a **metadata platform**: extra attributes on any document, external print layouts, and СКД (a visual query compositor). Mid-market buyers in AZ/CIS often treat that as table-stakes *for trade accounting*. If ERA cannot extend screens, print, and slices at all, operators export to Excel and the product collapses to “a typewriter for primary docs.”

ERA is **not** a 1C clone. It is a SaaS control plane + typed satellites + finance GL. The global goal is a **SHARED pool**. Copying СКД / a visual form designer onto the OLTP schema would:

- take years and still lose to 1C;
- break Prisma migrations and tenancy (`organizationId` filters);
- let one tenant’s report starve the pool (noisy neighbor).

**What already exists (do not reinvent):**

| Analog | Where | What it is |
|--------|--------|------------|
| T1/T2 catalogs + `CatalogField` | All apps | Extend pick-lists without new Prisma columns |
| Diagnostic `fieldsJson` + CPOE | Clinic | Industry form designer (visit/lab/imaging), not a universal document builder |
| `physioFields` / `checkupSectionsJson` | Clinic | Bounded JSON overlays with validation |
| Branded HTML `/print/*` | Clinic (and similar `window.print` elsewhere) | Tenant chrome; **layout lives in code** |
| Wave 1 standard GL reports + MHBS + VAT | Finance | 1C-*parity of canon reports*, not a constructor |
| Subconto on journal lines | Finance | 1C-like **GL dimensions**; flag `ERA_SUBCONTO_ENABLED` |
| `StatReportDefinition` | Finance | Configurable **statutory** blanks, not ad-hoc SQL |
| Hotel management report catalog | Hotel PMS | Screen/PDF slugs; cubes are **not OLAP**; FastReport `.frx` is not ported |
| `EraDataGrid` | satellite-kit | Paginated lists, not pivot/presets |
| JSONB UDF on CRM/finance entities | Finance PRD Wave 3 / CRM v4.0 | **Roadmap / deferred** — not shipped |

**Commercial axes (do not flatten):**

- **Module palette** 19 / 29 / 39 / 99 AZN — [era-commercial-catalog.md](./era-commercial-catalog.md). Lives in `pricing_modules`.
- **Placement planes** SHARED / DEDICATED / ONPREM — [deployment-topology.md](./deployment-topology.md). Same binary; topology is packaging. These are **three commercial planes**, not rungs on the SKU ladder. Intent (not yet seeded): ONPREM list economics on the order of **~36× SHARED subscription + a support fee**; DEDICATED is its own plane (our cloud, isolated stack), not a cheap “upgrade for reports.”
- License **clock** already differs by topology (SHARED trial vs DEDICATED/ONPREM perpetual until admin sets a term) — [platform-trial-hierarchy.md](./platform-trial-hierarchy.md) §1. That is not placement list price.

Nafta today is a **DEDICATED/ONPREM appliance**. That is not a precedent to turn on deep studio, and not a 36× list-price customer.

## Decision

### 1. Product bet

ERA wins as **industry ops + Azerbaijan-canon finance**, not as a low-code platform. Flexibility is required so the system does not lose to Excel/1C. ERA will **not** ship a general СКД or a visual builder of every screen.

Customers who need true 1C-class query composition for **accounting** may keep 1C via the planned `external/1С` accounting adapter ([sanatorium-vnext.md](./sanatorium-vnext.md)). That is a complementary path, not a failure of this ADR.

### 2. Three capability layers — one codebase, different quotas

Same images and contracts on every topology. `deploymentTopology` is **informational** and **never** skips the tenant filter ([deployment-topology.md](./deployment-topology.md) §2, §4).

| Layer | What | SHARED | DEDICATED / ONPREM |
|-------|------|--------|---------------------|
| **SaaS core** | Extra fields on **documents** (registry + JSONB, `CatalogFieldKind`); saved list views; branded print from a **whitelisted document snapshot**; canon reports; GL **subconto** | Full product. This is the SaaS goal. | Same |
| **Studio light** | Pivot/group on **published marts/cubes**; customer print templates using **placeholder whitelist** only; statement timeout; row/CPU caps | Optional SKU; strict caps so the pool survives | Same APIs; higher caps |
| **Studio deep** | Customer BI sidecar (Metabase / Cube / column store — vendor TBD); long-running SQL; unconstrained layouts | **Forbidden** on the pool (hosted BI on *our* replica may exist later as an expensive meter — still not user SQL on OLTP) | SKU + sidecar on **their** compute; reporting worker isolated from OLTP |

Do **not** wait for DEDICATED to ship SaaS core. Extra fields, branding, saved views, and canon reports are how SHARED stays sellable. Deep studio is a privilege of an **expensive placement plane**, not the “real ERA.”

### 3. Placement does not enable a feature

- Entitlement = **SKU + compute policy**, not `if (topology === 'DEDICATED')`.
- Mix remains valid (e.g. hotel DEDICATED + clinic SHARED). Deep studio applies **per `SatelliteEndpoint`**, not to the whole holding.
- Sales rule: sell DEDICATED/ONPREM for isolation, residency, load, air-gap, compliance — **not** for “add Driver name on the invoice.” That field is SaaS core.

### 4. Data rules

**Screen fields**

- Registry per `(organizationId, entityType, key)`: type, labels, `CatalogFieldKind`, active/retire.
- Values on the **operational document** as JSONB (or equivalent), unknown keys → 400 (clinic `physioFields` pattern).
- **Do not** add tenant-defined Postgres columns.
- Fields that affect money, tax, stock, or posting are **typed columns or subconto**, after a domain ADR — never opaque JSON on `JournalEntry`.

**Print**

- Statutory / fiscal / KO-1 / e-qaimə / MHBS layouts stay **vendor-owned**.
- Tenant branding (logo, legal names, footers) is SaaS core.
- Customer-uploaded DOCX/HTML is Studio light/deep, placeholders from the **print snapshot** only — no SQL in templates.
- Clinic HTML print routes remain the current implementation until a templating wave; this ADR does not require Puppeteer on every reception click.
- **W3 (finance commercial invoice):** live `PrintSnapshot` (flat dotted keys + one `{{#lines}}` loop) interpolated into a **checked-in** vendor HTML blank (`FINANCE_INVOICE_COMMERCIAL`). Placeholder catalog is read-only. Not a frozen issued-copy row; not fiscal equivalence.

**Reports**

- Canon reports stay first-class (finance Wave 1, hotel catalog, statutory engines).
- Saved views persist grid config (columns/filters/sort), not ad-hoc SQL.
- Analytic queries run against **published marts** (`*_fact` / balances-as-of), never as a general query over live journal/folio/cashier tables.
- Hotel “cubes” stay honest: not OLAP until a mart exists.
- Text-to-SQL / AI analyst: only against marts, never against master OLTP; not an accounting control.

### 5. Performance and tenancy

- OLTP master posts documents. Analytics (light and deep) use timeout, org filter, and — when load appears — **read replica / mart**, then column store if volumes demand it.
- JSONB extras are cheap for sparse input. Filtering/grouping them over a year of sales without a mart is **not** a SHARED workload.
- Deep studio on DEDICATED/ONPREM still must not run unbounded SQL on the transactional primary (night audit, cashier, `postJournalInTransaction`).
- SHARED pool is the topology that makes user SQL lethal; price planes do not change that physics.

### 6. Placement hops and deep artifacts

Deep studio is **one-way thickening**. A hop DEDICATED → SHARED (already the last/hardest hop) **refuses** or requires dropping customer SQL, external BI, and unconstrained templates. Contract text must say so.

Nafta appliance ≠ deep studio preview.

### 7. What this ADR does not decide

- Exact JSONB tables and migrations (follow-up TZ per satellite).
- BI vendor (Metabase vs Cube vs other) or AG Grid vs kit grid for saved views.
- Seeding a 36× ONPREM multiplier into `pricing_modules` (needs a later placement-pricing decision; **do not** overload the 19/29/39/99 module freeze).
- Studio SKU slugs (not in [PLATFORM_ADDONS.md](../PLATFORM_ADDONS.md) until designed).

## Consequences

- Sell/show: SaaS core flexibility is a **future SHARED** claim, not today’s SHIPPED. Studio deep is **not** a SHARED Product-Readiness row.
- Control plane bills modules on the catalog palette; placement fee/support is a **different invoice plane** when implemented.
- Partners/support: even at ~36×, deep studio is “their compute + our mart contract,” not unlimited debugging of SQL against GL.
- Clinic field designer and finance subconto stay the models to copy **inside their domains**.
- Writing a general query compositor or forking an `onprem` git branch is out of policy ([deployment-topology.md](./deployment-topology.md): one image).

## Follow-up / waves

| Wave | Scope | Status |
|------|--------|--------|
| **W1** | Extra-field registry + JSONB on **finance `Invoice`** (`entityType=FINANCE_INVOICE`). Kit validator: never-defined keys → 400; **retired keys are stripped on write**. SatAdmin definitions (OWNER/ADMIN) + create/view extras on the invoice modal (ACCOUNTANT+). Extras **do not** post to GL. | Hardening |
| **W2** | Saved views on **finance invoice register** (`gridKey=FINANCE_INVOICE_LIST`): whitelist columns/filters/sort/pageSize; `SavedListView` CRUD; class-A `/sales/invoices` with `EraListWorkspace` + `EraSavedViewsBar`. No SQL / no JSONB extra filters. | Hardening |
| **W3** | Print snapshot + placeholder whitelist on one **non-statutory** blank (`FINANCE_INVOICE_COMMERCIAL`): kit `interpolatePrintTemplate`; `GET /api/invoices/:id/print-snapshot` + `print-html`; staff `/print/invoice/:id`; ViewInvoiceModal Print; `/settings/print-placeholders` catalog. Not KO-1 / e-qaimə / MHBS. Live snapshot (not persisted). | Hardening |
| Later | Published mart → Studio light SKU; sidecar → Studio deep (DEDICATED/ONPREM only) | Not started |
| Pricing | Placement list-price ADR when ~36× / DEDICATED amounts are seeded | Not this ADR |

## References

- Clinic form SoT: [era-clinic/doc/CLINICAL_AND_PROGRAM_TEMPLATES.md](../../era-clinic/doc/CLINICAL_AND_PROGRAM_TEMPLATES.md)
- Hotel reports honesty: [era-hotel-pms/doc/MANAGEMENT-REPORTS-CATALOG.md](../../era-hotel-pms/doc/MANAGEMENT-REPORTS-CATALOG.md)
- SaaS pool sell ban: [acceptance/SaaS-Honesty-Closeout.md](../acceptance/SaaS-Honesty-Closeout.md)
