# Clinical forms & sanatorium packages (ERA Clinic)

## Single SoT for forms

**Diagnostic catalog** (`Modality` → `DiagnosticService` → `Analyte`) is the only source of truth for form schemas: lab, imaging, functional, endoscopy, **visit**, and packages.

`ClinicalTemplate` table **dropped** (migration `20260903170000_drop_clinical_template`). Form SoT = Diagnostic catalog only.

`ProgramTemplate` is a **different domain** (sanatorium treatment quotas by nights) — not form schemas.

---

## Admin menu (Setup → Catalogs)

| Menu (AZ) | Route | Permission |
|-----------|-------|------------|
| Diaqnostika kataloqu | `/admin/diagnostic-catalog` | `screen:admin.diagnostic_catalog` |
| Sanatoriya paketləri | `/admin/program-templates` | `screen:admin.program_templates` |

No `/admin/templates` page. Visit exam templates: Services tab → filter **Visit templates** (`kind=visit`). Field designer edits `fieldsJson` (no raw JSON required).

Ops exam fill: `/visits/[id]` → CPOE panel (catalog `kinds=visit` + `TemplateResultForm` → `CpoeEntry`).

**Print (one CpoeEntry):** history on `/visits/[id]` or patient card **Exam notes** → language dialog → `/print/visit-exam/[cpoeEntryId]?lang=…&autoprint=1`. Sheet includes visit ICD diagnoses. Payload `v:1` snapshots field/line labels + qualitative options for archival reprint. Auth: `api:visits` **or** `api:patients` (middleware + page).

---

## Permissions

| Key | Use |
|-----|-----|
| `screen:admin.diagnostic_catalog` | Form catalog admin + APIs |
| `screen:admin.program_templates` | Sanatorium package admin + APIs |
| Legacy `screen:admin.templates` | Migrated at parse time → diagnostic_catalog + program_templates |

Access matrix (`/admin/access`): labels for both keys; legacy templates key removed from UI checklist.

---

## Future debt (not in this wave)

| Item | Notes |
|------|--------|
| **Whole-visit print** | One sheet with all `CpoeEntry` rows for a visit (+ optional combined layout). Separate route e.g. `/print/visit/[visitId]`. |
| **FHIR export** | Production HL7/FHIR is Phase K4+ / OUT of current edition. Optional later: download stub `QuestionnaireResponse` / `Composition` from `payloadJson` (file only, not partner integration). |

---

## Related

- [DIAGNOSTIC_AND_LAB_CATALOG.md](./DIAGNOSTIC_AND_LAB_CATALOG.md)
- ADR [clinic-print-forms.md](../../docs/adr/clinic-print-forms.md) (visit-exam route)
- ADR [nafta-program-quota-knots.md](../../docs/adr/nafta-program-quota-knots.md) (CLI-51 packages)
- Seed: `prisma/seed-diagnostic-catalog*.cjs` (not ClinicalTemplate)
