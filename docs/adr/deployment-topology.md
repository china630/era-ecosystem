# ADR: Deployment topology (SHARED / DEDICATED / ONPREM)

**Status:** Accepted (vocabulary + target architecture)  
**Date:** 2026-08-17  
**Implementation:** Not built. Current industry satellites are still mostly **one process + one DB + one org** (Nafta appliance).  
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
- Unique keys: `@@unique([organizationId, code])`, not global `@unique` on tenant codes (staff `User.phone` is `@@unique([organizationId, phone])`).
- **Fail-closed Prisma filter:** kit `createSatelliteTenantExtension` throws `SatelliteOrganizationUnboundError` when org is missing or sentinel (`unbound` / production `demo-org`). It never skip-filters. `ERA_SKIP_TENANT_FILTER=1` is seed-only. Creates stamp context org (including nested `create` / `createMany.data` / `connectOrCreate.create`) and reject a client-supplied foreign `organizationId`. Postgres columns have **no** `@default` for org — the kit is the SoR. Call sites may omit `organizationId` on create; TypeScript uses `SatellitePrisma` / `asSatellitePrisma` so generated CreateInputs do not force a hand-written org on every write.
- **Child tables / catalogs:** do **not** spray `organizationId` onto join rows (`RatePlanAddOn`, `RoomTypeRate`) or platform catalogs (`IcdCode`). Isolation is via parent FK + service invariant (no cross-org FK). Slice export joins from tenant roots. Postgres RLS (`SET LOCAL era.organization_id`) is the follow-up belt for raw SQL — not enabled this wave (would break migrate/seed without SET on every connection).
- **Cron:** `runCronForEachTenant` — dedicated/on-prem uses bind; SHARED sets `ERA_CRON_ORGANIZATION_IDS`.
- One **image**, different values. No `saas` vs `onprem` git branch.
- Finance already has `organizationId` + Prisma tenant extension. Dedicated finance = **isolated Postgres + same binary**, not a schema without org.
- Industry satellite **tenant roots** carry `organizationId` + kit filter (CP-TENANT-01 API). Live SHARED pool / field two-org UAT remain open (AC-*-TENANT 🟡).

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
| `publicBaseUrl` | Public orch / launcher base |
| `platformSuperAdminEmails` | PSA list |
| `ssoSharedSecret` | SSO HMAC material |
| `satelliteEventServiceToken` | Event / internal Bearer |
| `activeModules` / `hotelModules` | Entitlement cache |
| `deploymentTopology` | SHARED \| DEDICATED \| ONPREM (**informational** — never skip tenant filter) |
| `edition` | Subscription / plan label string |

Resolution order (target): memory → DB `_era_runtime_config` → file cache → env override.

**Finance SSO lesson (Nafta):** drifted compose tokens / PII keys / HMAC versions. Same class of bug on every satellite — desired state is the fix. Finance Nest clients re-resolve orch URL per call (Wave 5) so Sync updates apply without process restart.

Orchestrator sets **desired** placement and config. A **host agent / GitOps** applies it. Orchestrator must not SSH and rewrite compose (Deploy staging already proved this is fragile).

**Host agent (Wave 11):** `scripts/era-placement-agent.mjs` polls `GET /v1/placement-agent/jobs` (Bearer `ERA_PLACEMENT_HOST_TOKEN` or `SATELLITE_EVENT_SERVICE_TOKEN`) for `PENDING` / `PROVISION` jobs and **logs** apply steps. Real compose/migrate/restore stays on the host. Advance state via Super-admin `POST /v1/admin/placement-jobs/:id/advance`. Kit stub: `@era/satellite-kit` `exportOrgSlice` — metadata only (`note: "not implemented full dump"`).

**PlacementJob API (Waves 11–15):** model + admin create/list/advance + hop reject for direct SHARED↔ONPREM. State stubs: freeze → exportSlice → markProvisioned → bindAndConfig (existing Sync) → cutoverEndpoint → smoke → complete. **Not** a live migrate product / not sellable. CP-PLACE-01 = **API**; AC-CP-TOPO stays open / 🟡 — not Scaffold ✅.

### 5. Placement jobs (upgrade and downgrade)

`deploymentTopology` lives on `Organization` (default **SHARED**). Per-`SatelliteEndpoint` mix remains a later PlacementJob. License **defaults** (not capability bans) follow this field — see [platform-trial-hierarchy.md](./platform-trial-hierarchy.md) §1:

- SHARED → system trial
- DEDICATED / ONPREM → no trial, perpetual until super-admin sets a date
- Super-admin can always shrink / extend / clear the clock. ONPREM regulation is honest only while orchestrator is reachable (cloud CP + tunnel). Air-gap = contract / signed lease, not a remote PMS kill switch.

Cutover is a **PlacementJob**. Product UI does **not** offer a single-shot SHARED ↔ ONPREM job. Customer wizard = two hops:

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

**Freeze → export → switch `SatelliteEndpoint` → smoke → unfreeze.** Rollback = point the endpoint back. Purpose: no writes during copy; no split-brain after DNS/URL cutover. Honest window 15–60 minutes; no zero-downtime promise in v1.

Invariants:

1. Source and target **Prisma migration hash** must match or stop. SHARED pool is usually ahead — catch up dedicated/on-prem **in place** before import into the pool.
2. Slice, not whole DB (ops rows, audit, object-storage prefix). **Do not** slice MDM, billing, entitlements, holdings (stay on orchestrator).
3. **Platform secrets** (pool SSO HMAC, pool event token) are **never** copied onto dedicated/on-prem or back into the pool. Re-issue. **Tenant secrets** (fiscal/NBC/VOEN certs) travel with the org.
4. BullMQ / outbox payloads carry `organizationId`.
5. Cuid/UUID PKs; tenant codes unique **per org**.

### 6. Bank

Same topology vocabulary, `organizationId` discipline, fail-closed filter, and remaining TENANT work as hotel/clinic. Live SHARED pool is **not built** for any satellite including bank — that is sequencing, not a product exception. Owner: no bank-only ban until a written exception. Current deploys may still be one process = one bank (D8 implementation).

### 7. Implementation order

1. This ADR + acceptance honesty (this change).
2. `organizationId` on industry satellite tenant rows + composite uniques (kit helper; per-satellite PRs).
3. Runtime desired config from orchestrator (finish bind → full config).
4. Export/import slice + freeze/cutover (`era-placement` in kit / orch).
5. Button SHARED → DEDICATED, then DEDICATED ↔ ONPREM, then downgrade into SHARED.
6. Ladder first on hotel / clinic / fnb / retail; finance isolated-DB dedicated; **bank same ladder** (schema+filter already; live pool when other satellites get it).

### 8. Git / deploy scopes

Follow `.cursor/skills/era-git-ship`: kit+ADR, then **one satellite** schema PR, then orchestrator placement, then finance SSO/config. Do not ship “all satellites + orch + Nafta compose” in one PR. Nafta appliance deploy ≠ SHARED pool deploy (same image, different values).

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
| CP-PLACE-01 | PlacementJob admin API + host agent poll + slice metadata stub (API — not SHIPPED; no live dump/migrate) |
| CP-TENANT-01 | Additive `organizationId` on clinic/hotel/fnb tenant roots + kit Prisma filter (API; live SHARED pool not done) |

Product-Readiness: do **not** sell SHARED pool or automated topology migrate. Edition stays `mvp`. Live SHARED pool ops remain open (Wave 17).
