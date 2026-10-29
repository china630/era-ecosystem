# ADR: Clinic print forms (trilingual)

## Status

Accepted — 2026-07-22

**Related:** [extensibility-forms-print-reports.md](./extensibility-forms-print-reports.md) (platform print: branding vs customer templates vs statutory lock) · [cp-organization-profile-and-branding.md](./cp-organization-profile-and-branding.md) (legal name / multi-contact / logo SoR on orch; clinic keeps footers + clinical signatures local; DEPARTMENT clinic may have its own phone)

## Context

Nafta sanatorium needs printable clinical forms (lab CBC/UA/biochemistry, USM narrative, check-up specialist list, procedure schedule) in az/ru/en, with language chosen at print time (independent of UI locale). Branding (logo, clinic name, phone, address, signatures) must be configurable per tenant.

## Decision

1. HTML print routes under app/print/* with @media print and window.print() (no PDF dependency). Query ?lang=az|ru|en&autoprint=1. Extra-ticket combat copy: `/print/extra-ticket/[ticketId]` (3 copies: reception / nurse / guest). Dual-run EW `saveCheck` is not driven from ERA.
2. PrintLanguageDialog on every print entry point (lab workflow modal, patient card results/plan).
3. Tenant print branding fields: footers, clinical signatures, checkupSectionsJson remain local. Header logo/address/phone prefer Control Plane org profile when Sync has cached it (CP-ORG-PROFILE-01 Track A — admin UI locks those fields).
4. Qualitative lab values stored as option codes (AnalyteValueOption trilingual labels) so reprints resolve to any language.
5. USM phrases (ImagingPhrase) stored as codes in LabResult (phrase.{organ} / meas.{key}) for trilingual narrative assembly.
6. Print chrome skipped via ClinicOpsShell when path starts with /print.

Checkup and procedure-schedule prints take optional `?episode=` (selected course). Default remains latest by `openedAt` when omitted. Canon: [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) (CLI-55 SCREEN).

7. **Visit exam (CPOE):** `/print/visit-exam/[cpoeEntryId]` — one saved `CpoeEntry` (snapshotted labels/options + visit diagnoses). Entry points: `/visits/[id]` CPOE history and patient-card exam notes → PrintLanguageDialog. Auth: `api:visits` or `api:patients`. Whole-visit multi-entry print and FHIR export remain **future debt** ([CLINICAL_AND_PROGRAM_TEMPLATES.md](../../era-clinic/doc/CLINICAL_AND_PROGRAM_TEMPLATES.md)).
8. **Course summary:** `/print/episode/[patientId]?episode=` — stay strip plus anamnesis, complaints, ICD, labs/diagnostics (every order item; also labs on a visit of this course), exam notes, seated procedures. Always printable (OPEN = interim note on the sheet). Entry: printer on the patient-card stay strip. Auth: any of `screen:doctor` / `screen:sanatorium` / `screen:patients`. Not a statutory epicrisis. No server PDF (browser print / Save as PDF).

## Consequences

- Print labels live in src/domain/print/print-labels.ts (not UI i18n cookie).
- A4 chrome (`PrintShell`): header date is one line (`Tarix 2026-10-16`). Lab/USM date = result ready (`completedAt` / `publishedAt` / `resultDate`). Procedure and checkup date = print day (Asia/Baku). Patient block is two columns — identity left, episode stay (doctor, arrival, departure, nights, room) right. Procedure table has no doctor column; sites and settings print in Notes.
- Catalog admin must maintain value options and imaging phrases for full trilingual fidelity.
- Free-text legacy imaging results still print as-entered (single language).
