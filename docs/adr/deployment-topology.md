# ADR: Deployment topology (SHARED / DEDICATED / ONPREM)

**Status:** Accepted (vocabulary + target architecture)  
**Date:** 2026-08-17  
**Implementation:** Nafta hotel, clinic, and retail run **SHARED** (one process + one DB of that satellite, many `organizationId`). DEDICATED and ONPREM stay placement options for other customers. Row isolation on hotel child/line tables is part of the hotel child-tenant wave; AC-*-TENANT stays 🟡 until field two-org UAT. Do not sell SHARED from placement alone. Other industry satellites are not implied SHARED by the Nafta pool.  
**Related:** [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [org-operating-mode.md](./org-operating-mode.md) · [satellite-organization-bind.md](./satellite-organization-bind.md) · [era-bank-core.md](./era-bank-core.md) D8 · [CONTROL_PLANE_ARCHITECTURE.md](../CONTROL_PLANE_ARCHITECTURE.md)

## Context

ERA accidentally treated **org = new instance** as the only SaaS model (compose env, no `organizationId` on many satellite tables). That blocks a real multi-tenant pool. It is still a **valid commercial step** on a ladder:

1. **SaaS pool** (many orgs, our cloud)
2. After growth — **dedicated instance** (org ≈ instance, our cloud)
3. Late stage — **on-prem** (same binary, customer iron)
4. Optional paid **source license** (legal access to the repo/tag — not a fourth topology)

Product owner (2026-08-17): **Bank follows the same ladder** until a later written exception. Existing ADR D8 default (one bank deployment) remains the *current implementation*, not a permanent product ban on SHARED bank.

## Decision

### 1. Two axes — never substitute

**Axis A — legal / money / point of sale** (already shipped as concepts):

| Term | Meaning | Not |
|------|---------|-----|
| **STANDALONE** | Org with own VÖEN; own fiscal and revenue | Not “own server” |
| **DEPARTMENT** | Child org (`parentOrgId`); ops DB own; money/fiscal may route to parent | Not “dedicated instance” |
| **Outlet** | Second POS/bar/register **inside one org and one satellite DB** | Not a new org or deploy |

**Axis B — where the process and database live** (this ADR):

| Term | Meaning | Not |
|------|---------|-----|
| **SHARED** | One satellite **process + one DB of that satellite** → many `organizationId`. Isolation = row filter, not container. | Not one Postgres for hotel+clinic+finance |
| **DEDICATED** | One process + one DB → **one** `organizationId` (code still filters). This is *org ≈ instance* as **placement**. | Not a different product; not DEPARTMENT |
| **ONPREM** | Same image as DEDICATED, customer infrastructure (VLAN/VM/disk). Orchestrator is cloud+tunnel or a local control-plane copy. | Not a code fork. Differs from DEDICATED by **who owns iron and network** |

**Source license:** commercial SKU / edition flag (`source_license`), not a `deploymentTopology` value. Same binaries; support = upstream only.

### 2. Code law

**Schema and services are always multi-tenant. Topology is packaging.**

```text
SHARED:     1 process + 1 per-satellite DB  → many organizationId
DEDICATED:  1 process + 1 DB                → one organizationId (filter still required)
ONPREM:     same binary                     → one organizationId + customer perimeter
```

- Every new operational row and raw SQL on satellites: `organizationId` from session / `satelliteOrganizationId()`, never a module-level `const ORG = process.env…`.
- Unique keys: `@@unique([organizationId, code])`, not global `@unique` on tenant codes.
- One **image**, different values. No `saas` vs `onprem` git branch.
- Finance already has `organizationId` + Prisma tenant extension. Dedicated finance = **isolated Postgres + same binary**, not a schema without org.
- Industry satellites today often omit `organizationId` (see [satellite-mutation-audit.md](./satellite-mutation-audit.md)). That debt **blocks SHARED**. Treat as a global fix, keeping all three topologies.

**SHARED pool is per product**, not one mega-DB:

| Pool | Database | Tenants |
|------|----------|---------|
| Clinic SHARED | `era_clinic` | many clinic orgs |
| Hotel SHARED | hotel DB | many hotels |
| F&B / Retail / … | that satellite DB | many orgs of that product |
| Finance SHARED | `era_finance` | many legal entities |

A holding (e.g. Nafta) in SHARED has hotel rows in the hotel pool and clinic rows in the clinic pool, keyed by org / department UUID. Satellites never share one Postgres.

### 3. Topology is per SatelliteEndpoint

A holding may mix topologies if sold that way (expected):

- Hotel **DEDICATED** + clinic **SHARED** is valid.
- Sanatorium join is **MDM + events + `SatelliteEndpoint` URLs**, not a shared DB and not Docker DNS.
- Default **pilot / appliance** (Nafta): all satellites the **same** topology. Mix is an explicit SKU, not the silent default.
- Refuse mix when the customer requires all clinical data on their iron, or when there is no stable hotel→orch→clinic path.

`DEPARTMENT` clinic of a DEDICATED hotel may still live in the SHARED clinic pool.

### 4. Orchestrator is desired state (kill env folklore)

Bootstrap env only:

- Orchestrator URL (`CONTROL_PLANE_URL` / `ORCHESTRATOR_URL` — **install bootstrap**; after Sync, satellites resolve via kit `resolveOrchestratorBaseUrl()` / runtime-config `orchestratorEventUrl`)
- One handshake token (or mTLS) — `SATELLITE_EVENT_SERVICE_TOKEN` / Finance `CONTROL_PLANE_SERVICE_TOKEN`
- `DATABASE_URL` (+ Redis / port as required by the binary)
- Optional `ERA_SATELLITE_ORGANIZATION_ID` as **emergency override**

Everything else comes from orchestrator → satellite **runtime-config** Sync payload (extend [satellite-organization-bind.md](./satellite-organization-bind.md)):

| Field | Purpose |
|-------|---------|
| `organizationId` | Bind (also via bind API) |
| `orchestratorEventUrl` | Live orch base for events / S2S |
| `publicBaseUrl` | **This satellite process** public URL (`SatelliteEndpoint.baseUrl`) — SHARED pool membership (`satellite-pool/members`) matches on it |
| `satellitePublicBaseUrl` | Alias of self URL (same as `publicBaseUrl`) |
| `orchestratorPublicBaseUrl` | Public orch / launcher base (optional; **not** used for pool self-discovery) |
| `platformSuperAdminEmails` | PSA list |
| `ssoSharedSecret` | SSO HMAC material |
| `satelliteEventServiceToken` | Event / internal Bearer — **one non-folklore** shared secret on orch + SHARED sats (never `change-me` / empty); folklore values are omitted from Sync/desired-state |
| `activeModules` / `hotelModules` | Entitlement cache |
| `deploymentTopology` | SHARED \| DEDICATED \| ONPREM (**informational** — never skip tenant filter) |
| `edition` | Subscription / plan label string |

Resolution order (target): memory → DB `_era_runtime_config` → file cache → env override.

**Finance SSO lesson (Nafta):** drifted compose tokens / PII keys / HMAC versions. Same class of bug on every satellite — desired state is the fix. Finance Nest clients re-resolve orch URL per call (Wave 5) so Sync updates apply without process restart.

Orchestrator sets **desired** placement and config. A **host agent / GitOps** applies it. Orchestrator must not SSH and rewrite compose (Deploy staging already proved this is fragile).

**Host agent:** `scripts/era-placement-agent.mjs` polls `GET /v1/placement-agent/jobs` (Bearer `ERA_PLACEMENT_HOST_TOKEN` or `SATELLITE_EVENT_SERVICE_TOKEN`) for `PROVISION` jobs, applies recipe (`composeYaml` via `docker compose up` when `ERA_PLACEMENT_CLONE_MODE=compose`, else lab dry-run), then `POST …/report-provision`. Orchestrator runs CONFIGURE (Sync + secret markers) and, unless `ERA_PLACEMENT_AUTOPILOT=0`, autopilots FREEZE→EXPORT→IMPORT→CUTOVER→SMOKE→DONE. Kit: `@era/satellite-kit/placement` (`exportFullOrgSlice` / OrgFullSliceV2, `isOrganizationPlacementFrozen` / 423). Service advance: `POST /v1/admin/placement-jobs/:id/advance`.

**PlacementBatch (engineering A–F + full-org P0–P3):** `POST/GET /v1/admin/orgs/:orgId/placement-batches` — org + satelliteKeys + packaging + **required** targetHost. Start stores `recipeJson` (services + `composeYaml`), child jobs at `PROVISION`, process log. Default `ERA_PLACEMENT_INLINE_LAB≠0` schedules inline lab provision (no separate agent). Freeze writes `Organization.settings.placementFreeze` and Sync pushes `placementFreeze` / `placementFrozenOrgIds` so hotel middleware returns **423** on mutations. Product slice = **OrgFullSliceV2** (`formatVersion: 2`): Prisma DMMF models with scalar `organizationId` + FK order + object-storage manifest stub + checksum; hotel + clinic wired; other satellites **fail-closed** until routes exist (`packages/satellite-kit/src/placement/FULL_ORG_WIRE.md`). Cutover upserts `SatelliteEndpoint`; smoke hits `/api/health` (or lab). Lab envs: `ERA_PLACEMENT_SLICE_LAB`, `ERA_PLACEMENT_SMOKE_LAB`. Hop reject for direct SHARED↔ONPREM. CP-PLACE-01 = **API**; AC-CP-TOPO stays 🟡 — field UAT / live blob copy / remaining sats open. Not sellable.

### 5. Placement jobs (upgrade and downgrade)

`deploymentTopology` lives on `Organization` (default **SHARED**). Per-`SatelliteEndpoint` mix remains a later PlacementJob. License **defaults** (not capability bans) follow this field — see [platform-trial-hierarchy.md](./platform-trial-hierarchy.md) §1:

- SHARED → system trial
- DEDICATED / ONPREM → no trial, perpetual until super-admin sets a date
- Super-admin can always shrink / extend / clear the clock. ONPREM regulation is honest only while orchestrator is reachable (cloud CP + tunnel). Air-gap = contract / signed lease, not a remote PMS kill switch.

Cutover is a **PlacementBatch** (many satellite jobs). Product UI does **not** offer a single-shot SHARED ↔ ONPREM job. Customer wizard = two hops:

```text
SHARED  ⇄  DEDICATED  ⇄  ONPREM
```

| Hop | Deploy | Data | v1 |
|-----|--------|------|----|
| SHARED → DEDICATED | Provision stack, bind, cutover endpoint | Export **slice** `WHERE organizationId = ?` | Automate first |
| DEDICATED → ONPREM | Appliance + keys + bind | Dump of already-single-org DB | Automate second |
| ONPREM → DEDICATED | Reverse deploy into our cloud | Dump → restore | Automate |
| DEDICATED → SHARED | Join pool, switch endpoint | Import slice | Automate last (schema + uniques must match) |
| SHARED ↔ ONPREM direct | — | — | **No** single job |

**Target order (clone on live pool, one freeze, one copy):** provision empty clone → configure (secrets / runtime-config on clone; endpoint still pool) → freeze pool writes → export → import → cutover `SatelliteEndpoint` → smoke → done. Rollback = point the endpoint back to the pool. Honest window 15–60 minutes; no zero-downtime promise in v1.

**Engineering ladder:** `PENDING → PROVISION → CONFIGURE → FREEZE → PREFLIGHT (migration-hash + disk) → EXPORT → IMPORT → CUTOVER → SMOKE (health+login) → DONE`. Hotel/clinic export **full org** SoR via OrgFullSliceV2 (not curated guest-only lists); freeze skips `runCronForEachTenant` orgs; UI banner + rollback. Still open before Scaffold ✅: **field UAT**, live object-storage copy hook, remaining satellites' full-org routes, SSO login smoke beyond `/login` GET.

Invariants:

1. Source and target **Prisma migration hash** must match or stop. SHARED pool is usually ahead — catch up dedicated/on-prem **in place** before import into the pool.
2. Slice, not whole DB (ops rows, audit, object-storage prefix). **Do not** slice MDM, billing, entitlements, holdings (stay on orchestrator).
3. **Platform secrets** (pool SSO HMAC, pool event token) are **never** copied onto dedicated/on-prem or back into the pool. Re-issue. **Tenant secrets** (fiscal/NBC/VOEN certs) travel with the org.
4. BullMQ / outbox payloads carry `organizationId`.
5. Cuid/UUID PKs; tenant codes unique **per org**.

### 6. Bank

Same topology vocabulary and `organizationId` discipline as other satellites. **Do not** build a SHARED bank **pool** until the owner lifts the current D8 default in a follow-up. Schema work must not bake “no org column” as forever.

### 7. Implementation order

1. This ADR + acceptance honesty (this change).
2. `organizationId` on industry satellite tenant rows + composite uniques (kit helper; per-satellite PRs).
3. Runtime desired config from orchestrator (finish bind → full config).
4. Export/import slice + freeze/cutover (`era-placement` in kit / orch).
5. Button SHARED → DEDICATED, then DEDICATED ↔ ONPREM, then downgrade into SHARED.
6. Ladder first on hotel / clinic / fnb / retail; finance isolated-DB dedicated; bank pool later if owner says so.

### 8. Git / deploy scopes

Follow `.cursor/skills/era-git-ship`: kit+ADR, then **one satellite** schema PR, then orchestrator placement, then finance SSO/config. Do not ship “all satellites + orch + Nafta compose” in one PR. Nafta hotel/clinic/retail already deploy as a SHARED pool (same image as DEDICATED; many `organizationId` in one DB). Do not collapse that into one PR with every other satellite.

## Consequences

- Selling “SaaS then dedicated then on-prem” is allowed **as a roadmap**, not as a live automated product.
- Nafta-style appliance is **ONPREM/DEDICATED**, useful, and not a mistake — it is one of three placements.
- Claiming SHARED multi-tenant SaaS or one-click on-prem migrate while satellite tables lack `organizationId` is false-green.
- Mixed hotel DEDICATED + clinic SHARED is a supported **sales** shape once endpoints and event contracts are topology-agnostic; it is not the Nafta default.

## Acceptance / coverage

| ID | Fact |
|----|------|
| CP-TOPO-01 | Vocabulary + this ADR (Doc) |
| CP-BIND-01 | Org UUID bind + Super-admin sync + kit boot hydrate (API; Nafta industry uses kit resolver) |
| CP-CFG-01 | Runtime-config Sync fan-out to industry + Finance Nest (API — not SHIPPED) |
| CP-LAUNCH-01 | Owner launcher base URL from SatelliteEndpoint + env fallback (API — not SHIPPED) |
| CP-PLACE-01 | PlacementBatch Start→DONE lab + OrgFullSliceV2 hotel/clinic (API — not SHIPPED; field UAT / blob copy / other sats open) |
| CP-TENANT-01 | `organizationId` on tenant roots + hotel child/line tables + kit Prisma filter (API). Nafta hotel/clinic/retail placement is SHARED. Field two-org UAT still open — not sellable as multi-tenant SaaS |

Product-Readiness: do **not** sell SHARED pool or automated topology migrate. Edition stays `mvp`. Nafta hotel/clinic/retail already run as a SHARED placement; field two-org UAT and sell remain open (Wave 17).
