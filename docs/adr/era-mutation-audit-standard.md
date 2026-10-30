# ADR: ERA mutation audit standard (ecosystem)

**Status:** Accepted  
**Date:** 2026-10-27  
**Implementation:** **Partial (2026-10-29).** Kit belt + `jsonOk` on Hotel/F&B/Clinic. **Wave A fail-closed:** CI scans mutation `route.ts` for silent success bypass. **Wave B Layer B:** F&B pay/discount/room-charge + PosShift open/close; Hotel CashShift open/close + night-audit `DAY_CLOSE` (folio/stay journal already Layer B); Clinic cashier SETTLE/VOID + ClinicShift open/close. **Wave C Finance kit-align:** Nest deny-list → kit `isMutationAuditExemptPath` + `DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES` (+ Finance extras); `DataMaskingService` → kit `isAuditPiiKey` (+ Finance extras); no hash-chain rewrite. **Wave D Finance journal UI:** `/admin/audit` uses kit `CatalogField` + `EraListFilterBar` + `DatePicker`; Reset → `HTTP_MUTATION`. **Wave E infra:** compound `(organizationId, createdAt)` on Hotel/Clinic/F&B `SatelliteAuditLog`; satellite hash-chain deferred. **UI/API parity:** `/admin/audit` + `GET /api/admin/audit`; Finance OWNER `/admin/security-audit`. CI: `npm run check:mutation-audit-belt`. **Not SHIPPED** until UAT (HOT-AUD-01 / FNB-AUD-01 API/SCREEN; Clinic HTTP_MUTATION UAT open). FIN-AUD-01 SHIPPED (Nest Layer A); AC-FIN-AUD stays 🟡 (AuthZ negatives residual). Open debts below.  
**Related:**

- [satellite-mutation-audit.md](./satellite-mutation-audit.md) — first-wave satellite helper + `SatelliteAuditLog` (still the storage contract for industry satellites)
- Finance `AuditMutationInterceptor` / TZ §9 — closest live implementation of Layer A
- [workforce-dual-audit.md](./workforce-dual-audit.md) — CP workforce log vs satellite ops log (orthogonal)
- [era-bank-risk-and-audit.md](./era-bank-risk-and-audit.md) — bank two-tier pattern (same idea, different tables)
- [era-common-laws.mdc](../../.cursor/rules/era-common-laws.mdc) — mutations require an audit trail where the app supports it
- [industry-satellite-api-nest-migration.md](./industry-satellite-api-nest-migration.md) — **P0 platform debt**: industry API Nest cutover is **not** part of audit waves; dual Nest/Next stack is accepted until that ADR is Implemented

## Context

Product ask: **every meaningful action** must be reconstructible (who / when / org / what changed), without slowing the desk or overloading the DB.

Today the estate is uneven:

| Plane | Mechanism | Coverage |
|-------|-----------|----------|
| Finance | Global Nest `AuditMutationInterceptor` on POST/PATCH/PUT/DELETE; hash-chain; archive | Broad Layer A; rich snapshots for allowlisted entities |
| Hotel / F&B / Clinic | Opt-in `record*Audit` → `SatelliteAuditLog` via `@era/satellite-kit` | Strong on stay/folio and some admin; many mutation routes have **no** row |
| Orchestrator | `platform_audit_logs`, `WorkforceAuditLog`, billing coverage rows | Domain-specific; not a uniform HTTP belt |
| Bank | Kernel + ops action log (see bank ADR) | Two-tier by design |

[satellite-mutation-audit.md](./satellite-mutation-audit.md) correctly shipped a **shared model and first wave** (voids, discounts, master retire). It did **not** define ecosystem-wide “100% mutation coverage” or performance rules. Manual service calls cannot stay complete as APIs grow.

Mature systems do **not** put a human “screen” on every API. They put an automatic **security belt** on the HTTP mutation boundary, plus a **domain journal** where before/after meaning matters.

## Decision

### Two layers (mandatory distinction)

| Layer | Name | Purpose | Who writes | Richness |
|-------|------|---------|------------|----------|
| **A** | Security / compliance audit | Prove that a mutation happened | HTTP interceptor / middleware (automatic) | Method, path, status, actor, org, IP/UA, correlation id; body/path redacted; optional coarse `entityType`/`entityId` |
| **B** | Domain journal | Explain what changed for ops / disputes | Domain services after a successful business change | Labeled field diffs, money amounts, reasons, refs (stay journal, folio void, role permission replace, master retire) |

**Definition of “100% coverage” for ERA:**

1. **Every successful HTTP mutation** (POST / PATCH / PUT / DELETE) that is not on the deny-list leaves a **Layer A** row in that product’s audit store.
2. **Every high-risk domain operation** listed in § Domain enrich catalog leaves a **Layer B** row (human-readable diff or typed action), even if Layer A already recorded the same request.
3. Reads (GET / HEAD / OPTIONS), health, and deny-listed noise **must not** create audit rows.

Layer A without Layer B is acceptable for low-risk CRUD. Layer B without Layer A is a **gap** (legacy until the HTTP belt lands).

Do **not** invent a second stay-log / folio-log table where [satellite-mutation-audit.md](./satellite-mutation-audit.md) already reuses `SatelliteAuditLog` (e.g. hotel `entityType=Reservation`). Layer B is a **payload/convention**, not a second store, unless a product ADR already defined a dedicated table (Finance `EntityActivity`, bank ops log, CP `WorkforceAuditLog`).

### Where audit lives

| Product | Layer A store | Layer B store |
|---------|---------------|---------------|
| Industry satellites (hotel, F&B, clinic, retail, …) | `SatelliteAuditLog` (per satellite DB, `organizationId` required) | Same table with richer `action` + `changesJson`, or product ADR table |
| Finance | `AuditLog` (+ archive) | Same + optional Activity Stream (§5.E) — collaboration, not security |
| Orchestrator | `platform_audit_logs` / product tables | `WorkforceAuditLog`, billing events — keep separate; correlate by ids |
| Bank | Per [era-bank-risk-and-audit.md](./era-bank-risk-and-audit.md) | Ops action log |

Audit stays **local to the plane** (no mandatory central SIEM in MVP). Export / ship to SIEM is a later NFR, not a blocker for this standard.

Cross-plane correlation uses existing stamps: `organizationId`, optional `cpEmploymentId` / `globalPersonId` via kit `stampWorkforceAuditContext` ([workforce-dual-audit.md](./workforce-dual-audit.md)).

### HTTP belt (Layer A) — stack pattern

**One audit contract, two adapters.** Finance Nest interceptor is the fail-closed reference. Industry satellites stay on Next until [industry-satellite-api-nest-migration.md](./industry-satellite-api-nest-migration.md) is scheduled. Audit waves must make the Next adapter **fail-closed** (no silent bypass), not wait for Nest.

| Stack | Mechanism |
|-------|-----------|
| NestJS (Finance, Orchestrator APIs) | Global interceptor (Finance already); fire-and-forget persist **after** response body is ready |
| Next.js App Router satellites | Shared wrapper / middleware helper in `@era/satellite-kit` (e.g. `withMutationAudit` / route instrumentation) that runs after a **2xx/3xx** mutation handler returns; same writer as `recordSatelliteAudit` |

Rules for the belt:

1. Capture **after** the handler succeeds. Do not write Layer A for thrown 4xx/5xx (failed attempt logging is optional and out of scope for v1).
2. **Never** fail the client mutation because audit insert failed. Log the audit error; optionally enqueue retry (BullMQ / outbox) for money-adjacent paths later.
3. **Do not** join Layer A insert to the business `prisma.$transaction` that posts money, stock, or status — avoids lock inflation and “ops blocked by audit DB”.
4. Prefer **not** loading full before-snapshots in Layer A for every route (Finance allowlist is the exception). Layer A default payload: method, path (normalized), redacted request summary, response id hints when cheap.
5. Attach `userId` from session/JWT when present; S2S / webhook / cron rows may use `userId=null` plus `changes.actorKind` (`SERVICE`, `WEBHOOK`, `SYSTEM`, `CRON`).
6. **In scope for Layer A:** staff UI mutations, authenticated admin APIs, **and** mutating `/api/internal/*` / cron / webhook handlers that change tenant data (unless deny-listed with reason). Auth login/refresh stay on the deny-list.

#### Canonical Layer A row (satellites → `SatelliteAuditLog`)

Reuse the existing table. Do **not** add a parallel HTTP-audit table.

| Field | Layer A value |
|-------|----------------|
| `entityType` | `HTTP_MUTATION` (fixed) |
| `entityId` | Best-effort resource id from path/body/response (`reservationId`, ticket id, …); else normalized path or `-` |
| `action` | HTTP method: `POST` \| `PATCH` \| `PUT` \| `DELETE` |
| `changesJson` | Redacted `{ method, path, statusCode?, actorKind, correlationId?, bodySummary? }` — no full PII dumps |
| `userId` / `ipAddress` | Session user and client IP when present |

Finance already uses `entityType = HTTP_MUTATION` for generic mutations — satellites align to that name.

#### Layer A vs Layer B in one table

| Concern | Rule |
|---------|------|
| Same request writes both | Allowed. Layer A = proof the HTTP call succeeded; Layer B = domain meaning (e.g. `VOID`, `CHECK_OUT`) |
| Org settings audit UI | Default filter includes `HTTP_MUTATION` **and** domain types; chips/filters separate “HTTP” vs “domain” |
| Entity timeline (stay journal, ticket) | Show **Layer B only** for that `entityType`/`entityId` — never dump raw `HTTP_MUTATION` bodies into ops UX |
| Collision | Domain `action` values stay semantic (`VOID`, `UPDATE`). Layer A `action` is only the HTTP method |

#### Read API (org mutation journal)

**Canon (all products):**

| UI | API |
|----|-----|
| `/admin/audit` | `GET /api/admin/audit` |
| Finance OWNER security only | `/admin/security-audit` → `GET /api/admin/security-audit` (OWNER; not SuperAdmin platform admin) |

`GET /api/admin/audit` supports org-wide Layer A: `entityType=HTTP_MUTATION` (default) and other domain types. Query: `entityType`, `entityId?`, `action?`, `dateFrom?`, `dateTo?` (Asia/Baku civil day), `userId?`, plus `page`/`pageSize` or `limit`. Do **not** require `entityId` for the org belt view. **No redirects** from legacy `/settings/audit`, `/api/audit`, `/api/audit/logs`, `/admin/audit-log`.

#### Org audit UI (filters + nav)

| Filter | Control | Required |
|--------|---------|----------|
| entityType | `CatalogField` CLOSED_SMALL; default `HTTP_MUTATION` | Yes (or server default) |
| entityId | FREE_TEXT | No |
| action | FREE_TEXT | No |
| dateFrom / dateTo | DatePicker (Baku) | No |
| userId | FREE_TEXT | No |

Nav labels (do not use bare “Audit”): **Mutation audit** (`nav.mutationAudit`), Finance **Security audit** (`nav.securityAudit`), Audit Hub / invitations / inventory stocktake keep distinct keys.

**RBAC:** Hotel `/admin/audit` = reports (`REPORTS_READ` / `SCREEN_REPORTS`), **not** blanket `SCREEN_ADMIN`. Finance mutation audit = ledger/audit read (`API_LEDGER_READ`); security-audit = OWNER only.

### Domain enrich (Layer B)

Call kit/app helpers **after** the domain mutation commits (same process as today: `recordHotelAudit`, `recordReservationDiff`, `recordClinicAudit`, `recordFbAudit`, Finance entity snapshots).

**Minimum catalog (all industry satellites + Finance equivalents):**

| Class | Examples | Required |
|-------|----------|----------|
| Money move | Folio charge/payment/void/refund/transfer; ticket void; invoice post/void; cash shift open/close | Yes |
| Stay / visit lifecycle | Check-in/out, cancel, no-show, restore, relocate, amend | Yes |
| Master retire / delete | Room type, rate plan, catalog item soft-delete | Yes |
| RBAC | Role create/update, permission replace, user role bind | Yes |
| Destructive ops | Ops wipe, import apply, settlement push, night-audit day close | Yes |
| Ordinary master create/update | Name/code edits without money | Layer A only is enough unless product ADR says otherwise |

Hotel stay journal remains the Layer B UX for reservations ([satellite-mutation-audit.md](./satellite-mutation-audit.md)); the HTTP belt must not force a second UI table.

### Redaction and PII

All Layer A/B JSON passes `redactAuditChanges` (kit) or Finance equivalent **before** persist.

Minimum key families (case-insensitive substring match, extend over time):

- credentials: `password`, `passwordHash`, tokens, secrets  
- identity: `fin`, `passport`, `documentNumber`, `nationalId`  
- contact: `phone`, `email`  
- payment: raw card PAN / CVV (never store); bank account full numbers if present  

Display of IP on stay journal remains permission-gated (hotel already restricts IP to settings permission).

### Integrity, retention, performance

| Concern | Rule |
|---------|------|
| Integrity | Per-row content hash required (`integrityHash` / Finance `hash`). Org **hash-chain** is Finance-grade; satellites may add chain later without blocking Layer A rollout |
| Retention | Hot table for recent ops; archive or cold partition ≥ 12 months (Finance archive job is the reference) |
| Volume | One audit row per mutation (or one Layer B summary per batch import), not per Prisma field write |
| Forbidden | Prisma middleware that audits **every** `update`/`create`; GET logging; logging high-frequency telemetry/early-access spam |
| Indexes (today) | `SatelliteAuditLog`: `organizationId`, `createdAt`, `(entityType, entityId)`, plus Wave E compound `(organizationId, createdAt)` on Hotel/Clinic/F&B (org journal lists; tenant extension injects `organizationId`) |
| Indexes (follow-up) | Thin sats (retail/CRM/…) still lack the compound index until they gain Layer A volume; drop redundant single-column indexes only after EXPLAIN proves compound covers org-only paths |

Expected cost of Layer A: one small INSERT after response. That is acceptable at FO/POS load; if a hot path exceeds budget, move persist to a queue **without** dropping the coverage rule.

### Deny-list (Layer A skip)

Products keep an explicit deny-list (Finance already has auth/webhook/early-access skips). Ecosystem baseline:

- Auth: login, register, refresh, SSO exchange (login success may be a separate security event later)
- Health / ready / metrics
- High-frequency non-authoritative telemetry (`early-access/events` class)
- Idempotent webhook **acks** that only echo status, when a dedicated webhook journal already exists (document per product)

Every skip needs a one-line reason in code (`// audit-exempt: …`) so CI can allow it.

### Coverage enforcement (follow-up, required for “done”)

When Layer A lands for a product:

1. Default: all mutation route handlers go through the belt.
2. CI / lint gate (planned): mutation `route.ts` / controller method without belt registration and without `audit-exempt` comment → fail.
3. Acceptance: Product Implementation-Matrix / COVERAGE row for mutation audit moves only when Layer A is on and a UAT path shows org-wide audit UI for a sample mutation **and** a Layer B money/lifecycle sample.

### UI

| Surface | Shows |
|---------|--------|
| Org mutation journal (`/admin/audit` on Hotel, F&B, Clinic, Finance) | Layer A + filterable Layer B |
| Finance OWNER security journal (`/admin/security-audit`) | OWNER org security view (not Audit Hub) |
| Entity timeline (reservation journal, invoice activity) | Layer B primary; do not dump raw HTTP bodies into ops UX |
| Holding / cross-satellite merge | **Out of scope** — deep-link per plane ([workforce-dual-audit.md](./workforce-dual-audit.md)) |

### Rollout order

1. **This ADR** (standard).  
2. **Hotel** — Next mutation belt + deny-list + CI stub; keep existing reservation/folio Layer B.  
3. **F&B, Clinic** — same kit belt; expand Layer B beyond void/discount.  
4. **Orchestrator** — document which routes are already covered; add belt gaps for security-admin / org mutations not on `WorkforceAuditLog` / `platform_audit_logs`.  
5. **Finance** — treat as reference; align deny-list naming and redaction kit helpers where shared; no rewrite of hash-chain.  
6. Thin satellites (retail, logistics, …) — belt when they gain authenticated mutation APIs.

Implementation PRs must update this ADR’s **Implementation** line and the first-wave ADR status note.

## Open debts (planes without full Layer A / Layer B)

| Plane | Layer A today | Layer B / UI | Debt |
|-------|---------------|--------------|------|
| Hotel | `jsonOk` → belt + CI scan (Wave A) | Stay/folio journal + CashShift + `BusinessDay` DAY_CLOSE + `/admin/audit` | UAT; Wave E compound `(organizationId, createdAt)` landed; hash-chain deferred. CORS IBE uses explicit `scheduleHotelHttpMutationAudit` |
| F&B | same | Void/roles + Ticket PAY/DISCOUNT/ROOM_CHARGE/DEFER_HUB + PosShift OPEN/CLOSE + `/admin/audit` | UAT later; Wave E compound index landed; residual ordinary menu CRUD = Layer A only; hash-chain deferred |
| Clinic | same | Opt-in writers + ClinicReceipt SETTLE/VOID + ClinicShift OPEN/CLOSE + `/admin/audit` | HTTP_MUTATION UAT later; Wave E compound index landed; hash-chain deferred |
| Finance | Nest `AuditMutationInterceptor` (SHIPPED) | `/admin/audit` + `/admin/security-audit` + hash-chain; Wave D filter bar = CatalogField + EraListFilterBar + kit DatePicker | Wave C–D landed; AC-FIN-AUD 🟡 AuthZ/UAT residual; satellite hash-chain stays out of Finance rewrite |
| Orchestrator | Partial: `WorkforceAuditLog`, `platform_audit_logs`, billing | CP security audit screens | Inventory gaps: org/security-admin mutations not on those tables; no uniform HTTP belt |
| **Industry API Nest cutover** | N/A (platform) | N/A | **P0** — [industry-satellite-api-nest-migration.md](./industry-satellite-api-nest-migration.md). Out of audit waves. |
| Retail (`era-retail-pos`) | None | None / thin | Port kit belt + `SatelliteAuditLog` + org audit UI when mutation API volume justifies |
| CRM | None | None | Same as retail |
| Wholesale / Logistics / Construction / Auto | None | None | Same — thin-industry backlog |
| Bank / Bank DBO | Own two-tier (bank ADR) | Ops action log | Align vocabulary with this ADR; do not merge stores |
| Data Hub | HEADLESS / policy APIs | Orch settings | Document HEADLESS exceptions; no cashier audit UI |

**CI:** `npm run check:mutation-audit-belt` (wired in `run:quality-gates`) — Hotel / F&B / Clinic: requires `jsonOk` hook **and** fails on mutation `route.ts` success `NextResponse.json` without `jsonOk` / `schedule*HttpMutationAudit` / `// audit-exempt:`. Thin sats later.

## Non-goals

- Centralized multi-product audit warehouse in orchestrator (MVP).  
- Guaranteed delivery under process kill mid fire-and-forget (document residual risk; queue upgrade later for money paths).  
- Auditing every Prisma write or every UI click.  
- Replacing domain ledgers (folio lines, GL, night-audit runs) with audit rows — ledgers remain source of money truth; audit explains **who triggered** change.  
- Blocking checkout / pay / night audit when audit storage is down.  
- **Rewriting industry satellite APIs onto Nest** — tracked as P0 platform debt, not an audit deliverable ([industry-satellite-api-nest-migration.md](./industry-satellite-api-nest-migration.md)).

## Consequences

- “100% of actions” becomes a **testable** rule (HTTP belt + enrich catalog), not an unbounded wish.  
- New APIs inherit Layer A via `jsonOk` (or explicit `withMutationAudit`) without remembering a service call; Layer B stays intentional for high-risk meaning.  
- Satellites stay autonomous DBs; Finance and CP keep stronger integrity features until satellites opt into chain/archive.  
- [satellite-mutation-audit.md](./satellite-mutation-audit.md) remains the satellite **storage and helper** contract; this ADR is the **ecosystem coverage and performance** contract above it.  
- Thin satellites and Orchestrator gaps are tracked in **Open debts** — do not claim ecosystem-wide SHIPPED until those rows close.
