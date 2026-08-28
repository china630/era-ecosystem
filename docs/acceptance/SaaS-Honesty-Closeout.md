# SaaS honesty closeout (Waves 1–12 + isolation eng)

**Wave:** 12 + isolation engineering (2026-08-28)  
**Canon:** [SAAS_SHARED_RUNTIME.md](../SAAS_SHARED_RUNTIME.md) · [adr/saas-request-tenant-and-vendor-bridges.md](../adr/saas-request-tenant-and-vendor-bridges.md)  
**Gate:** `npm run check:acceptance` (SaaS false-green bans in `scripts/check-acceptance-consistency.mjs`)

This page freezes **what may and may not be claimed** after the SaaS runtime-prep and isolation-engineering waves. It does **not** flip Product-Readiness Sell/Pilot or edition `ga`.

## Claim freeze

| Claim | Status |
|-------|-------------------------|
| Request tenant on industry Next (login/JWT/ALS/stamps) | **Landed** |
| Hotel ops stamps via `requestOrganizationId` (not process bind) | **Landed** (isolation eng) |
| SHARED Sync skips process `applyOrganizationBind` | **Landed** (isolation eng) |
| Orch pool members SoR for cron | **Landed** (isolation eng) |
| Placement artifact + host agent import-slice apply log | **Landed** (eng code path); **field open** |
| Super-Admin per-org Elektraweb / clinic cutover + Sync | **Landed** (lab SHOW) |
| Multi-org cron + User DISTINCT discover | **Landed** |
| Lab / live-smoke two-org isolation (hotel + clinic) | **Landed** (lab); **field open** |
| Live SHARED pool sell / edition `ga` / «SaaS pool ready» | **Forbidden** |
| AC-*-TENANT Scaffold ✅ | **Open** (needs field two-org UAT) |
| HOT-06 SHIPPED | **Open** (needs field SPA Insert; stays HEADLESS) |
| Placement host migrate / AC-CP-TOPO Scaffold ✅ | **Open** (eng path ≠ Scaffold ✅) |

## Forbidden positive claims

Do not write (outside Forbidden / do not / ≠ / never / «not …» contexts):

- `SaaS pool ready` / `SHARED pool ready` / `sellable SHARED pool` as a product claim
- `HOT-06` marked **SHIPPED** without HEADLESS / not SHIPPED / field-open wording
- `AC-HOT-TENANT` / `AC-CLI-TENANT` / `AC-CP-TOPO` as Scaffold ✅ without «still not» / «needs field» / «remain open»

## Related Product-Readiness Forbidden lines

- [Hotel-Product-Readiness-Matrix.md](./Hotel-Product-Readiness-Matrix.md) — no SHARED hotel SaaS pool sell
- [Clinic-Product-Readiness-Matrix.md](./Clinic-Product-Readiness-Matrix.md) — no multi-tenant clinic SaaS sell
- [Platform-Product-Readiness-Matrix.md](./Platform-Product-Readiness-Matrix.md) — no GA / SaaS pool; TOPO 🟡

## Signoffs still pending (human)

- [reports/two-org-isolation-signoff.md](../../reports/two-org-isolation-signoff.md) — field section
- [reports/hot06-field-runbook.md](../../reports/hot06-field-runbook.md) — field SPA Insert
- [reports/placement-lab-hop-signoff.md](../../reports/placement-lab-hop-signoff.md) — host apply / field migrate
