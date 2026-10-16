# Clinical forms & sanatorium packages (ERA Clinic)

## Single SoT for forms

**Diagnostic catalog** (`Modality` → `DiagnosticService` → `Analyte`) is the only source of truth for form schemas: lab, imaging, functional, endoscopy, **visit**, and packages.

`ClinicalTemplate` table **dropped** (migration `20260903170000_drop_clinical_template`). Form SoT = Diagnostic catalog only.

`ProgramTemplate` is a **different domain** (sanatorium treatment quotas by nights) — not form schemas.

**Entitlement blocks (CLI-51 amend):** each package line is a **block** (`ProgramTemplateProcedure` code = balance key). Optional `ProgramTemplateBlockMember` lists SKUs that may burn that block (`ProcedureType` for treatment families; diagnostic catalog for LAB/EXAM). A LAB block lists catalog kinds `lab_panel`, `imaging`, and `functional` (blood panels, ultrasound, ECG) and still fulfills as `LAB_ORDER`. EXAM lists `visit` only. Knot matrix stores **qty per block** at PDF night columns only (interpolate for other stays). Admin edit modal is wide with physio / bath / paraffin / lab / exam blocks. **`fulfillment` is derived from block kind** (İcra is not a separate admin control). Membership picker is cascaded by kind — not the full treatment catalog on a lab block.

The bath calendar passes the chosen days. The planner picks a free cabin of the guest's sex, or a shared cabin, and an hour inside that day. It stops at the day's end hour from clinic settings (Saturday default 13:00). A day with no free slot stays in the quota. A mode change redraws automatic cells around manual baths and already checked-in or completed sessions. Sitz-then-full marks the first session sitting (`OTURAQ`) and the rest full (`TAM`).

Stay check-in, check-out, and nights come from `ProgramInstance.startsOn` / `endsOn`. If the hotel lifecycle event never wrote a package and the course still has a `reservationId`, opening the patient card or the sanatorium chart reads the hotel stay once (`/api/internal/v1/stays/by-external-ref`) and shows those dates. A failed hotel call leaves the dates empty.

**Versioning:** composition save creates `version+1` and retires the previous row (`isCurrent=false`). A new check-in pins `ProgramInstance.templateId` and freezes `entitlementSnapshot` at that version. Night-only recalc keeps that pin. Super-admin package apply (`MANUAL_RETRY` and the open-course bulk button) moves the course onto the current template, recomputes knot quotas, and cancels the latest future `SCHEDULED`/`PROPOSED` sessions that no longer fit. `COMPLETED` and `CHECKED_IN` stay.

---

## Admin menu (Setup → Catalogs)

| Menu (AZ) | Route | Permission |
|-----------|-------|------------|
| Diaqnostika kataloqu | `/admin/diagnostic-catalog` | `screen:admin.diagnostic_catalog` |
| Sanatoriya paketləri | `/admin/program-templates` | `screen:admin.program_templates` |

No `/admin/templates` page. Visit exam templates: Services tab → filter **Visit templates** (`kind=visit`). The form-fields icon on that row edits `fieldsJson` (no raw JSON required). Saving the service card does not send `fields` and does not clear the blank.

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

## Stay dates and bath seating

Giriş, Çıxış and Gecə on the course card, the treatment card, the bath calendar and package recalculation use the hotel stay when the episode has a reservation. The program window is the fallback. Opening a package from the clinic, including the checkup form, passes those hotel dates into the program instance. When the hotel stay is known, that form does not ask for a start date.

A bath whose procedure code is in an active day series is seated one session per planned stay day (from today forward), into a free cabin of the guest's sex or a shared cabin, and a free attendant. Unknown guest sex only fits a shared cabin. A day that cannot take the session stays on the toast with the date and the reason. Sessions that already seated are not cancelled. Procedures outside a day series still use the minute-grid placer, with the same cabin sex rule.

Bath day modes live in clinic settings (`code`, baths, rest days). Defaults are 2, 3, 5, and alternating. A closed day resets a streak and does not spend the owed rest. Week hours also live in settings: weekday end, Saturday end (default 13:00), shortened-day end (default 13:00), and closed weekdays (default Sunday). A closed weekday stays empty unless the country calendar opens it.

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
