# Nafta revenue remap runbook

SSOT matrix: [`nafta-revenue-remap-matrix.json`](./nafta-revenue-remap-matrix.json).

## Order

1. Backup hotel, clinic, F&B, finance databases.
2. Hotel: `node era-hotel-pms/scripts/ops/nafta-revenue-remap.mjs` (or dry-run with `--dry-run`).
3. Clinic: `node era-clinic/scripts/ops/nafta-revenue-remap.mjs`.
4. F&B: `node era-fnb-pos/scripts/ops/nafta-revenue-remap.mjs`.
5. Finance (from `era-finance-core/packages/database`): `npx tsx prisma/scripts/ops/nafta-revenue-gl-remap.ts`.
6. Smoke: night audit preview, Extra payment lodging, clinic folio post, F&B room charge, finance day document.

## Notes

- Remap FKs / strings before deleting or deactivating codes.
- Dense renumber uses temp codes (`__t_*`) to avoid unique collisions.
- Finance historical journals: lines pointing at retired NAS leaves move to the target leaf; retired leaves stay inactive for audit.
- **Retail / other satellites:** grep for hotel BOCC strings (`41xx`, `2007`, `BOARD`, …). Nafta retail store uses category defaults in hotel catalog only — **no retail DB remap** (N/A) unless a property stores hotel codes locally.
