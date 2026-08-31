# ADR: Clinic print forms (trilingual)

## Status

Accepted — 2026-07-22

## Context

Nafta sanatorium needs printable clinical forms (lab CBC/UA/biochemistry, USM narrative, check-up specialist list, procedure schedule) in az/ru/en, with language chosen at print time (independent of UI locale). Branding (logo, clinic name, phone, address, signatures) must be configurable per tenant.

## Decision

1. HTML print routes under app/print/* with @media print and window.print() (no PDF dependency). Query ?lang=az|ru|en&autoprint=1. Extra-ticket combat copy: `/print/extra-ticket/[ticketId]` (3 copies: reception / nurse / guest). Dual-run EW `saveCheck` is not driven from ERA.
2. PrintLanguageDialog on every print entry point (lab workflow modal, patient card results/plan).
3. Tenant print branding fields (printLogoDataUrl, trilingual names/addresses/footers, signatures, checkupSectionsJson).
4. Qualitative lab values stored as option codes (AnalyteValueOption trilingual labels) so reprints resolve to any language.
5. USM phrases (ImagingPhrase) stored as codes in LabResult (phrase.{organ} / meas.{key}) for trilingual narrative assembly.
6. Print chrome skipped via ClinicOpsShell when path starts with /print.

Checkup and procedure-schedule prints take optional `?episode=` (selected course). Default remains latest by `openedAt` when omitted. Canon: [clinic-episode-as-clinical-course.md](./clinic-episode-as-clinical-course.md) (CLI-55 SCREEN).

## Consequences

- Print labels live in src/domain/print/print-labels.ts (not UI i18n cookie).
- Catalog admin must maintain value options and imaging phrases for full trilingual fidelity.
- Free-text legacy imaging results still print as-entered (single language).
