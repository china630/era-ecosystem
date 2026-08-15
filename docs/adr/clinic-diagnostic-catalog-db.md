# ADR: Clinic diagnostic catalog in DB + normalized lab orders

## Status

Accepted — 2026-07-21

Related: [clinic-doctor-confirmed-fifo-planning.md](./clinic-doctor-confirmed-fifo-planning.md) · era-clinic doc/DIAGNOSTIC_AND_LAB_CATALOG.md

## Context

The diagnostic catalog lived in a static JSON file (prisma/seed-data/diagnostic-lab-catalog.json) loaded into memory. Lab orders stored multiple service codes in a comma-joined 	estCode string and all result lines in a 
esultJson blob. Filtering by modality, paginating with accurate totals, and treating results as structured clinical data were not scalable.

## Decision

### Catalog source of truth

1. Tables Modality, DiagnosticService, DiagnosticAnalyte, DiagnosticMetaField hold the catalog in Postgres.
2. JSON seed remains the bootstrap source via prisma/seed-diagnostic-catalog.cjs (idempotent upsert by code).
3. SatAdmin CRUD at /admin/diagnostic-catalog (API under /api/admin/diagnostic-catalog/*) mutates the DB and invalidates the in-memory catalog cache.
4. getDiagnosticCatalog() / indCatalogItem() are async DB readers with cache; picker and TemplateResultForm keep the same DTO shape.

### Normalized lab order

1. LabOrder is the header (status lifecycle, patient, amounts, legacy dual-write fields).
2. LabOrderItem is one row per service code (optional FK to DiagnosticService, snapshot serviceCode).
3. LabResult is one row per analyte/field (code, alue, refs, LabResultFlag).
4. Legacy 	estCode / 
esultJson are **dual-written** during transition; ackfill-lab-order-items.cjs migrates existing rows. Dropping legacy columns is a follow-up migration after soak.

### Results editability

1. Results may be entered/edited while status is COLLECTED | IN_PROGRESS | RESULT_READY.
2. From PUBLISHED onward (and COMPLETED), results are **read-only** in UI (amendment is out of scope).
3. COMPLETE remains the billing/finance handoff step (SATELLITE_CLINIC_LAB_ORDER_COMPLETED + optional payment link).

### List API

GET /api/lab-orders returns { data, total, page, pageSize } with filters: status, criticalOnly (via LabResult.flag), modality (via item→service→modality), patientRefId, createdAt dateFrom/dateTo.

## Consequences

- Modality filter and critical-only are SQL JOINs, not JSON parsing.
- Admin can extend modalities/services/analytes without redeploying JSON.
- Print form for results is deferred (UI stub only).
- Per-item status on LabOrderItem is deferred; header status remains authoritative.
