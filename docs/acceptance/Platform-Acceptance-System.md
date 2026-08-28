# Platform — Acceptance System

**Canon:** [`ERA-Acceptance-Standard.md`](../products/ERA-Acceptance-Standard.md)  
**Readiness SSOT:** [`Platform-Product-Readiness-Matrix.md`](./Platform-Product-Readiness-Matrix.md)  
**AC / BE SSOT:** [`Platform-Implementation-Matrix.md`](./Platform-Implementation-Matrix.md)  
**Evidence:** [`Platform-Evidence-Rules.md`](./Platform-Evidence-Rules.md)  
**Index:** [`Platform-Sprint-Index.md`](./Platform-Sprint-Index.md)  
**Edition:** [`docs/editions/platform.yaml`](../editions/platform.yaml)  
**Apps:** `era-orchestrator`

---

## Scope

- In scope: SSO/launcher, org/billing, entitlements, MDM, workforce hub, super-admin, **deployment topology program** (desired-state config, placement — ADR `deployment-topology`)
- Out of scope: Industry ops screens (live on satellites); **selling** SHARED pool or automated on-prem migrate until AC-CP-TOPO is Scaffold ✅ + Pilot-ready
- **Landed (runtime prep, not sell):** request-scoped tenant on industry satellite ops HTTP + Super-Admin per-org Elektraweb/clinic cutover policy (Waves 1–11) — [saas-request-tenant-and-vendor-bridges.md](../adr/saas-request-tenant-and-vendor-bridges.md) · [SaaS-Honesty-Closeout.md](./SaaS-Honesty-Closeout.md). Live SHARED pool sell / field TENANT Scaffold ✅ still open.
- **Landed (API, not sell):** Nafta bind + kit resolver (AC-CP-BIND ✅ Scaffold BE), Sync runtime-config to industry + Finance Nest (AC-CP-CFG ✅ Scaffold BE), SHARED-ready `organizationId` + kit filter (CP-TENANT-01), topology license defaults + super-admin perpetual/± term (CP-LIC-01), PlacementJob admin API + host agent poll + SHARED↔ONPREM reject + hotel JSON slice lab (CP-PLACE-01 API / AC-CP-TOPO 🟡 not Scaffold ✅). Green Scaffold BE Wave 7: AUTH/BILL/MDM/WF/SA/INT/BIND/CFG negatives. **AC-CP-TOPO** stays Scaffold 🟡 **in** BE rollup (PlacementJob API ≠ live host migrate) → Product-Readiness Scaffold BE **🟡**. Playbook: [BE-OPEN-AND-TOPO-RETURN.md](./BE-OPEN-AND-TOPO-RETURN.md). SHARED pool / migrate still not sellable. Orch missing-screens wave: org catalog / owner billing invoices-orders / WF vacation-orders-ştat-timesheets / referrals+landing (UI present, not UAT-SMOKE / not SHIPPED). Live SHARED pool ops still open.

## Definition of Done (soft / scaffold)

- [ ] Unit / golden / integration tests for changed surface
- [ ] Stage-gate signoff under `reports/`
- [ ] Implementation-Matrix row updated (✅ only per canon §3.2)
- [ ] Product-Readiness-Matrix columns updated if UI/Demo/Pilot touched
- [ ] COVERAGE_MATRIX actor row(s) updated
- [ ] `npm run check:acceptance` PASS

## Definition of Done (pilot / GA)

- [ ] Pilot lab checklist signed
- [ ] Field AC not Scaffold ✅ until field proof
- [ ] Edition yaml `ga` only after `pilot_ready: true` + Pilot field

## Gate script

```bash
node scripts/run-platform-stage-gate.mjs
```

## Honesty

- `gate[x]` ≠ Scaffold ✅ ≠ Pilot-ready  
- Do not write «all ✅» while any in-scope AC or Readiness layer is 🟡/❌  
- MODULES_CATALOG DONE ≠ edition `ga`
