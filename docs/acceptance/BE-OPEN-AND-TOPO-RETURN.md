# Return playbook — AC-DBO-OPEN + AC-CP-TOPO (in BE rollup, Scaffold 🟡)

**Status:** Owner 2026-08-18 — these two ACs stay **in Scaffold BE rollup** as 🟡. They paint Bank DBO and Platform **Scaffold BE 🟡**. Not Scaffold ✅. Not excluded (Wave 8 exclude reverted).

**Not this page:** vendor External leftovers that stay **out** of rollup (Hotel INT): `AC-RET-FISCAL`, `AC-CRM-WA`, `AC-DH-VOEN`, `AC-HOT-INT`, Clinic HL7 CLI-23 / fiscal CLI-24 residuals, all `AC-*-TENANT`.

**UI class:** both ACs are **SCREEN** on [UI-COVERAGE-BOARD.md](./UI-COVERAGE-BOARD.md) (`/open-api`, `/super-admin/orgs/{id}/placement`). Scaffold BE still 🟡 until this playbook checklist.

**Canon:** [ERA-Acceptance-Standard.md](../products/ERA-Acceptance-Standard.md) §3.2.  
**Matrices:** [Bank-DBO-Implementation-Matrix.md](./Bank-DBO-Implementation-Matrix.md) · [Platform-Implementation-Matrix.md](./Platform-Implementation-Matrix.md)

When you come back, do not re-litigate «is this vendor?». OPEN is **our** stretch (curl-only). TOPO is **our** placement product (API scaffold ≠ live hop/pool). Both belong in BE rollup until closed or the owner explicitly excludes them again.

---

## 1. AC-DBO-OPEN — Open API B2B + API keys

### What it is

Customer/partner **Open API** on the DBO channel: keys + AIS/PIS-shaped engine routes (`/dbo/open/*`). Not retail UI. Not full Open Banking GA (Inventory `CAP-DBO-OB`).

### Why 🟡 (not vendor)

Engine routes exist. Proof is **curl-only stretch**. Canon: no Scaffold ✅ without negative path + non-curl evidence for a claimed API product. This is a **Code** residual, not KKM/e-taxes.

### Already landed (do not rebuild)

- Engine: `era-bank-core` `dbo/open/*` (accounts / orders lab)
- Channel BFF may proxy; UI for key admin is thin or missing
- Inventory: `CAP-DBO-OB` **IN** (lab AIS/PIS) — IN ≠ AC Scaffold ✅ ≠ GA
- Other DBO ACs (AUTH/ACC/PAY/CORP/SO/LOAN-APP/3DS) already Scaffold ✅

### Do not confuse with

| Not this AC | Where |
|-------------|--------|
| Retail/corporate DBO screens | AC-DBO-AUTH…3DS (already ✅) |
| Live ASAN / rails | YC-E3 / YC-E1 — parent Inventory |
| Full AIS/PIS suite / PFM / H2H | Capability Inventory §10 OUT/PARTIAL |
| SHARED bank pool | AC-BANK-TENANT — out of rollup; same bar as hotel TENANT (not a special ban) |

### Close checklist (all required for Scaffold ✅)

1. Negative Jest: bad API key → 401; revoked key → 401; key of org A cannot read org B → 403/empty; missing scope → 403.
2. UAT-SMOKE **non-curl** path: SatAdmin or partner-admin UI to create a key + one deny step (or signed `reports/bank-dbo-open-api-signoff.md` with UI screenshots — Evidence-Rules).
3. Implementation-Matrix: Proof = spec paths + UAT; residual Code cleared; **in-rollup** stays.
4. Product-Readiness: Scaffold BE → ✅ only after this AC ✅ (worst in-scope). UI/Demo/Pilot/Sell unchanged unless Open API UI is sold.
5. Inventory: do **not** flip CAP-DBO-OB to «GA». AC ✅ ≠ full Open Banking.
6. `npm run check:acceptance`. No `ga`.

### Files to open first

- `era-bank-core` dbo-open controllers
- `era-bank-dbo` if BFF/UI for keys exists
- [Bank-DBO-Evidence-Rules.md](./Bank-DBO-Evidence-Rules.md)
- [Bank-Capability-Inventory.md](./Bank-Capability-Inventory.md) §10

---

## 2. AC-CP-TOPO — SHARED / DEDICATED / ONPREM placement + hops

### What it is

Control-plane **placement product**: freeze → org slice → provision → bind/runtime-config → cutover `SatelliteEndpoint` → smoke → unfreeze. Hops: SHARED⇄DEDICATED⇄ONPREM (no single-shot SHARED↔ONPREM).

### Why 🟡 (in rollup)

PlacementJob **API scaffold** exists. Live dump/import, host apply of a real stack, and live SHARED **pool ops** do not. Owner: hop/pool is part of Platform BE, not a silent exclude. Field-intent migrate stays max 🟡 until field proof — but **API hop** can become Scaffold ✅ with negatives + lab slice UAT (not sell).

### Already landed (do not rebuild)

- ADR [deployment-topology.md](../adr/deployment-topology.md) §4–§5
- Prisma `PlacementJob` + `PlacementJobService` + admin/agent HTTP
- SHARED↔ONPREM → REJECTED (`placement-job.service.spec.ts`)
- Host poll stub: `scripts/era-placement-agent.mjs`
- Kit `exportOrgSlice` metadata stub (not full dump)
- Bind + runtime-config Sync on industry + finance + bank (separate ACs ✅)
- `organizationId` + kit filter (CP-TENANT-01 API; TENANT ACs out of satellite BE rollup)
- License defaults CP-LIC-01 (not a pool)

### Do not confuse with

| Not this AC | Where |
|-------------|--------|
| Org UUID bind / Sync | AC-CP-BIND ✅ |
| SSO/token desired-state | AC-CP-CFG ✅ |
| Schema `organizationId` | CP-TENANT-01 / AC-*-TENANT (out of satellite rollup) |
| STANDALONE / DEPARTMENT / Outlet | money/POS axis — not topology |
| Selling SHARED SaaS pool | Product-Readiness topology table — **Not built** even after TOPO Scaffold ✅ |

### Close checklist (Scaffold ✅ = lab hop, not sell)

1. Real slice export `WHERE organizationId = ?` (ops tables + audit prefix) — not metadata stub.
2. Negative: SHARED↔ONPREM still REJECTED; migration-hash mismatch stops; freeze blocks writes.
3. Lab UAT: one hop SHARED→DEDICATED **or** documented dry-run signoff `reports/placement-shared-to-dedicated-signoff.md` (UI or ops runbook — not curl-only if SuperAdmin button exists).
4. Host agent applies **something** observable (compose/k8s apply log), not only poll+log.
5. Implementation-Matrix: TOPO ✅ only per §3.2; **still not** Pilot-ready / `ga` / «SaaS pool».
6. Product-Readiness: BE ✅ when TOPO ✅; **Sell unchanged** until pool/migrate are explicit sell claims + Pilot field.
7. COVERAGE CP-PLACE-01 stays API until SuperAdmin hop UI + UAT-SMOKE.
8. `check:acceptance`. Forbidden: TOPO ✅ → edition `ga` or «продаём SHARED».

Live SHARED **pool** (many orgs, one process) is a **later** sell gate (topology program wave 17). TOPO Scaffold ✅ can mean «lab hop works» without pool ops.

### Files to open first

- `era-orchestrator/apps/api/src/placement/`
- `scripts/era-placement-agent.mjs`
- kit placement/slice-export stub
- [deployment-topology.md](../adr/deployment-topology.md)
- Platform Product-Readiness **Topology / tenancy (honesty)**

---

## 3. Honesty when closing

- Do not exclude these ACs from rollup again without a written owner line in this file.
- Do not mark Scaffold ✅ from Wave 7/8 negatives that only cover reject-direct or curl.
- Bank DBO BE and Platform BE stay 🟡 until the matching AC above is ✅.
- Vendor ACs (FISCAL / WA / VOEN / Hotel INT) stay out of their product BE rollup.
