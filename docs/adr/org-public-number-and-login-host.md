# ADR: Public organization number and login host (SHARED)

**Status:** Accepted — **implemented** (A1–A6, B1–B4 in code). Apply migrations + kit rebuild. Do not sell white-label login / flip TENANT Scaffold ✅ / edition `ga` without live TLS + UAT evidence.  
**Date:** 2026-09-19  
**Related:** [saas-request-tenant-and-vendor-bridges.md](./saas-request-tenant-and-vendor-bridges.md) · [deployment-topology.md](./deployment-topology.md) · [satellite-organization-bind.md](./satellite-organization-bind.md) · [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [era-commercial-catalog.md](./era-commercial-catalog.md) · [PLATFORM_ADDONS.md](../PLATFORM_ADDONS.md) §6 (`platform_domain`)

**Reading path:** [SAAS_SHARED_RUNTIME.md](../SAAS_SHARED_RUNTIME.md)

## Context

SHARED pools require the staff login to name **which organization**: satellite staff credentials are unique as `@@unique([organizationId, login])` (industry `User`) or `@@unique([organizationId, username])` (bank `OpsUser`). Cross-org `findFirst({ login })` / `findFirst({ username })` is forbidden.

Industry satellites therefore added an `organizationId` field on `/login` (clinic first; hotel, F&B, and remaining Next satellites followed the same Zod: `z.string().uuid()`). That field is the **control-plane UUID**. It is correct for isolation and unusable for reception: 36 hex characters, easy to mistype, impossible to dictate by phone.

VÖEN is the wrong public key: 10 digits; encrypted + blind-indexed (`taxIdCipher` / `taxIdBlindIndex`); DEPARTMENT orgs often share the parent VÖEN; foreigners may have none; staff must not type a tax identifier at the desk.

SSO from the orchestrator launcher already carries UUID in the HMAC ticket. Owners never type it. The pain is **local satellite auth** on a cloud pool URL (one host, many orgs).

The SaaS request-tenant ADR already listed three ways to pass the org at login: **field, query, or hostname map**. Hostname map was never built. `PlatformCustomDomain` exists as add-on `platform_domain` (19 AZN, CNAME toward `portal.era365.az`) and does **not** resolve satellite `/login` from `Host`.

There is one live-ish org in the pool today. Keeping UUID on the login form or API “during rollout” would only preserve a dead contract. Cut it.

## Decision

### 1. Two identifiers — never substitute

| Identifier | Field / claim | Who uses it |
|------------|---------------|-------------|
| **Canonical tenant id** | UUID `Organization.id` | PK/FK, Prisma ALS, JWT `organizationId`, SSO ticket, bind, Sync keys, satellite events, S2S bodies |
| **Public organization number** | `publicOrgNumber` (CP) / login body `orgNo` | Humans: staff login, support, printed card, `?org=` |

Do **not** migrate satellite tables, unique keys, or JWT tenant claims off UUID. Do **not** put `publicOrgNumber` in event envelopes as the tenant key.

**API login field name:** `orgNo` (not `organizationId`, not `id`).  
**Query:** `?org=104221`.  
**UI copy:** “Organization code” / ERA ID (en + az + ru).

### 2. Public number — SoT, shape, allocation

**SoT:** control plane `organizations.public_org_number` (`Int`, unique). Satellites never mint numbers.

**Cardinality:** one number per `Organization` row — not per satellite, not per outlet.

- Two restaurants in one hotel F&B SKU → two **Outlet** rows, **one** `orgNo`. After login, existing outlet select / PIN `outletId`.
- DEPARTMENT clinic of a hotel → **its own** number (separate tenant).
- Second legal entity (own VÖEN) → second `Organization` → second number.

**Range:** 100000–999999 (six digits, no leading zero). Space is enough for the market; if it ever is not, **widen the public number** — UUID stays. Login validators may accept 6–8 digits later; canon at ship is 6.

**Allocation:** cryptographically random in range, retry on unique conflict. **Rejected:** sequential 100001, 100002… (adjacent typo is another valid org; leaks growth).

**Lifecycle:** assigned at org create; backfill existing rows once. Immutable after issue except Super-admin incident (not self-service). Soft-deleted orgs keep the number (do not recycle).

**Not VÖEN.** Login must not accept a tax id in the `orgNo` field.

### 3. Login contract (industry Next satellites **and Bank ops**)

Applies to local `POST /api/auth/login` on: clinic, hotel-pms, fnb-pos, retail-pos, crm, wholesale, logistics, construction, auto-service, **and `era-bank` ops staff**.

Bank is on the **same topology ladder** (`SHARED` / `DEDICATED` / `ONPREM`) until the owner writes an exception. One-deploy = one bank is the usual **appliance**, not the login/product law. Branches / МФР are a posting dimension **inside** one licensed org — they do not replace `orgNo`. `ERA_BANK_ORGANIZATION_ID` is emergency process bind, not SHARED request tenant.

**SHARED:** `orgNo` required. Regex `^[1-9][0-9]{5}$`. Resolve to UUID (local Sync cache, else S2S), then credential lookup **inside that org** (`findUserByCredential` or `OpsUser` `{ organizationId, username }`) + `enterSatelliteTenant`. JWT `organizationId` = UUID.

**DEDICATED / ONPREM:** `orgNo` may be omitted; process bind UUID is the tenant. Number is still shown in control plane.

**Cut UUID from this surface:**

- Login **body must not** accept `organizationId` (no dual Zod, no “UAT still posts UUID”).
- Login **UI** must not show, prefill, or validate UUID (`UUID_RE`, `NEXT_PUBLIC_ERA_SATELLITE_ORGANIZATION_ID` as UUID prefill).
- Query must not use `?organizationId=<uuid>`.
- i18n hints that tell staff to copy UUID from Workforce Login & access go away.
- Smoke / UAT that POST UUID to `/login` are rewritten to `orgNo`.

**Unchanged:**

- JWT / session `organizationId` = UUID. Optional extra claim `orgNo` for chrome only.
- `POST /api/auth/sso/exchange` HMAC still uses UUID (launcher, not reception).
- Bind, runtime-config, events, MDM, finance membership JWT — UUID.
- **Finance Core** and **orchestrator** local login stay **out of this ADR** (email + membership picker / SSO). Do not add `orgNo` there unless a later ADR says so.
- **Bank DBO customers** never type ERA ID. SHARED channel org is resolved from **Host** (ERA `{orgNo}.bank…` / `{orgNo}.dbo…` or white-label CNAME) or appliance process bind. Optional `orgNo` on DBO OTP JSON is only for lab/scripts — not the customer UI.

**Errors:** missing/invalid `orgNo`, unknown number, unknown user, bad password → same client message (`Invalid credentials` / 401 as today for auth failures; SHARED missing `orgNo` stays 400). Do not distinguish “no such org”.

**Rate limit:** `/login` by IP **and** by `orgNo`. Six digits are enumerable.

### 4. Resolve path and performance

Hot Prisma path stays UUID-indexed.

On login:

1. Look up `orgNo` → UUID in satellite cache populated by **Sync** (tiny map, all orgs entitled to this pool).
2. Cache miss → orchestrator S2S `GET /internal/v1/organizations/by-public-number/:orgNo` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN`) → cache.
3. Reception must still log in if orchestrator is briefly down **for orgs already synced**.

Do not call the control plane on every authenticated API request.

S2S resolve response may include a **display name** for a future confirmation step. Shipping login **must not** require a public unauthenticated “name for this number” API (customer enumeration). If a confirm-name UX is added later, rate-limit it; never return VÖEN or UUID to the browser.

### 5. Convenience without white-label (included)

Priority, all **in the product**, not a SKU:

1. Typed `orgNo` on the shared pool URL.
2. Bookmark / `?org=104221`.
3. Browser `localStorage` of last successful `orgNo` on that origin.
4. **ERA-owned subdomain** (optional follow-on): `{orgNo}.<satellite-pool-host>` (example shape only). Wildcard TLS on **our** DNS. Middleware binds tenant; hide the code field. This is **not** white-label (the host still says ERA).

Hostname map in the request-tenant ADR means this class of feature. It was never implemented.

### 6. White-label custom host — SKU `platform_domain`

When the address bar must **not** show ERA (`pms.client.az` → hotel pool login): paid add-on.

**Reuse** existing catalog key `platform_domain` (already “White-Label Domain”). Do not invent a second add-on for ops login vs portal unless a later commercial ADR splits them. Extending the SKU: custom host for **portal and/or satellite login**.

**List prices** (palette 19 / 29 / 39 / 99):

| Offer | AZN / month | What it includes |
|-------|-------------|------------------|
| **Host** | **19** | **One** custom hostname → **one** satellite login (typical: PMS only) |
| **Org pack** | **29** | Custom hostnames for **all satellite logins of that org** that the org is entitled to (hotel + F&B + clinic + …). Not per outlet. |

Mutex: 19 XOR 29 (same pattern as Data Hub tiers). No 8 AZN “extra host” meter.

**Gate:** resolve a customer `Host` to an org **only** if `platform_domain` is active and the hostname is `ACTIVE` for that org + `satelliteKey`. DNS pointed at the pool without entitlement must not log anyone in (no free white-label).

**Limits:**

- 19: at most one `satellite_login` custom host; second host → upsell 29 or reject.
- 29: at most one login host per entitled industry satellite (not per restaurant).
- Downgrade 29→19: extra hosts leave `ACTIVE` (operator deletes or Super-admin parks).

**Model gap vs today:** `PlatformCustomDomain` is `(organizationId, hostname)` without satellite key or kind. Login white-label needs `satelliteKey` + kind (`portal` vs `satellite_login`).

**Resolve for login** must **not** be the current JWT-gated `GET platform/domains/v1/resolve/:hostname` as a browser call. Prefer Sync of hostname→UUID onto the satellite, or S2S with service token + rate limit. A public unauthenticated resolve without limits is a customer directory.

**Edge / TLS** (ops, not Nest): ERA wildcard for included subdomains; per-hostname certificate for custom domains; `PENDING_DNS` → `ACTIVE` as today’s domain MVP. Until edge works, Super-admin domain cards are not SHIPPED / not sellable as white-label login.

DEDICATED/ONPREM already have a customer host; this SKU is for **SHARED pool** vanity DNS + our TLS, not “having a domain at all”.

### 7. Security

- `orgNo` is **not a secret**. Password + `(organizationId, login)` + rate limit are.
- Random numbers reduce typo-into-neighbour vs sequential.
- Do not leak org existence via distinct errors or unbounded name lookup.
- Internal APIs keep UUID (guessable six-digit ids must not become S2S keys).
- Super-admin shows `orgNo` large; UUID is copy-for-support, not reception copy-paste.
- Host vs `?org=` mismatch → reject, do not let query override Host tenant.

### 8. Honesty / acceptance

This ADR does **not** make SHARED pool Pilot-ready or edition `ga`. It replaces an unusable login identifier and defines a later paid host map.

SHIPPED for ERA ID = control-plane number + kit resolve + all listed satellite logins on `orgNo` + UAT-SMOKE **UI** (not curl-only) + i18n.  
SHIPPED for white-label login = entitlement + Host bind + live TLS/DNS evidence.

## Consequences

**Positive:** reception can remember or bookmark a six-digit code; isolation stays UUID; VÖEN stays tax data; two F&B halls stay outlets; white-label is optional and priced; SSO unchanged.

**Negative:** every industry login route and smoke must change in one cut (no UUID compatibility window). Sync must carry the number map. Custom domain is a real edge project, not a form.

**Rejected:**

- Replacing UUID PK with integer id in satellites.
- VÖEN as login org key.
- Per-satellite public numbers (`clinic 11`, `hotel 12`) for one org.
- Per-outlet public numbers.
- Sequential org numbers.
- Dual login API (UUID or `orgNo`) “for scripts”.
- Charging SKU for ERA-owned `{orgNo}.…` subdomains.
- Process bind as SHARED request tenant (unchanged ban).

## Implementation note

**Status (2026-09-19):** Waves A1–A6 and B1–B4 are **implemented in code** for industry Next satellites, plus the Bank cycle: `era-bank` ops `orgNo` login (same kit resolve as clinic), JWT/middleware `organizationId`, engine `X-Organization-Id` → ALS, DBO Host/bind resolve without a customer ERA ID field. Thin-spot pass 2 (bank): ALS before `OpsUser` lookup; SHARED engine fail-closed without org header (health/internal exempt); DBO lab `orgNo` + reject leftover UUID; Host CNAME targets `industry_banking` / `banking_dbo`; customer-safe DBO errors. Do **not** flip TENANT Scaffold ✅ / edition `ga` / white-label SHIPPED without live TLS evidence and UAT-SMOKE UI signoff for ERA ID login. Finance/orch login unchanged.

| Wave | What |
|------|------|
| A1 | CP `publicOrgNumber`, allocator, S2S `by-public-number`, Super-admin ERA ID |
| A2 | Kit `resolveLoginOrganizationId` + rate limit |
| A3 | Industry login / PIN / EW widget on `orgNo`; orch `?org=` deep links |
| A4 | Sync mergeable orgNo→UUID map |
| A5 | `?org=` + localStorage; ERA subdomain parser + Traefik HostRegexp (wildcard TLS still ops) |
| A6 | Docs / honesty (this ADR + matrices) |
| B1–B4 | `platform_domain` 19 XOR `platform_domain_org` 29; Host map; activate DNS; downgrade guard |
