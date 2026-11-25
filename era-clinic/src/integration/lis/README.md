# Clinic LIS integration port (CLI-23)

**Status:** STUB — production HL7 v2 / ASTM adapters are not enabled in this edition.

## Adapter modes (`ERA_CLINIC_LIS_ADAPTER`)

| Mode | Behavior |
|------|----------|
| `disabled` | Default. No inbound listener; staff use manual import (`/api/lab-orders/import`, file profiles). |
| `file` | Watch-folder / SFTP drop processed by existing `lab_import` pipeline (`LisFileProfile`). |
| `hl7` | Reserved. MLLP ORU^R01 / ORM^O01 listener (not wired in production builds). |

## Boundaries

- Structured results land on `LabOrderItem` / `LabResult` via the ops lab order service — same tenant `organizationId` discipline as all clinic writes.
- Mis-matched specimens should queue for manual pairing (future `lis_unmatched_result` table — not in P1 foundation).
- COVERAGE_MATRIX **CLI-23** remains **STUB** until a vendor-certified path is UAT-signed.

## Related

- `era-clinic/nest/native/controllers/lab_import.controller.ts`
- `era-clinic/nest/native/controllers/admin_lis-profiles.controller.ts`
- `docs/acceptance/Clinic-Implementation-Matrix.md` — AC-CLI-LAB scope-cut