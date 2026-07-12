# ERA Ecosystem — URLs, ports, and naming

Canonical reference for domains, ports, repo folders, billing slugs, and environment variables.

**Prod domain:** `era-365.online`  
**Rule:** published host port = container `PORT` (no internal-only port drift in dev).

---

## Platform

| # | Display | Repo folder | Docker service | Subdomain | Port | Public URL |
|---|---------|-------------|----------------|-----------|------|------------|
| 0 | ERA (apex) | — | traefik | `era-365.online` | 80/443 | redirect → `app` |
| 1 | ERA Platform | `era-orchestrator` | `orchestrator` | `app` | 3000 (web), 4000 (api) | `https://app.era-365.online/` |
| 2 | Finance ERP | `era-finance-core` | `finance-web` | `finance-core` | 3100 | `https://finance-core.era-365.online/` |
| 3 | Finance API | `era-finance-core` | `finance-core` | `finance-api` ‡ | 4100 | `https://finance-api.era-365.online/` |
| — | Orchestrator API | `era-orchestrator` | `orchestrator` | `api` | 4000 | `https://api.era-365.online/` |
| 4 | ERA Data Hub | `era-data-hub` | `data-hub` | `data` | 4200 | `https://data.era-365.online/` |
| 5 | Bank Core (API) | `era-bank-core` | `bank-core` | `bank-api` | 4300 | `https://bank-api.era-365.online/` |

Bank Core is a regulated **headless engine** (CBS, second core), **not** an industry satellite and has **no UI** — typically deployed **one per bank** (on-prem capable). Its operational UI is the `era-bank` satellite (see Industry satellites table). ADR [era-bank-core.md](./adr/era-bank-core.md) D9.

‡ Finance API public route: enable with `ERA_FINANCE_API_PUBLIC=true` (open architecture). Internal always: `http://finance-core:4100`.

Finance Web proxies `/api/*` → `finance-core:4100` and `/cp/*` → `orchestrator:4000`.

### Orchestrator platform catalog (industry satellites)

Base: `http://127.0.0.1:4000/platform/v1/catalog` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN`, header `X-Organization-Id`).

| Path | Purpose |
|------|---------|
| `GET /calendar/:country/day?date=` | Production calendar day |
| `GET /calendar/:country/days?from=&to=` | Bulk days (hotel BAR warm cache) |
| `GET /calendar/:country/add-business-days?date=&n=` | Business-day offset |
| `GET /fx/convert?from=&to=&amount=&date=` | FX display convert |
| `GET /companies/:voen` | VÖEN company directory |

Orchestrator proxies to data-hub `/registry/v1/*`. See [orchestrator-platform-integration-gateway.md](./adr/orchestrator-platform-integration-gateway.md).

### Orchestrator platform workforce (industry satellites)

Base: `http://127.0.0.1:4000/platform/v1/workforce` (Bearer `SATELLITE_EVENT_SERVICE_TOKEN`, header `X-Organization-Id`).

| Path | Purpose |
|------|---------|
| `GET /policy?satelliteKey=industry_clinic` | Hire mode: `cp_workforce` \| `disabled` |
| `/workspace/workforce/*` | CP Workforce hub (employments, absences, org, security) |

See [workforce-identity-and-hr-provisioning.md](./adr/workforce-identity-and-hr-provisioning.md).

---

## Public hub (Orchestrator web `:3000`)

Cross-product marketing and onboarding live on **Orchestrator web**, not Finance. Satellites and Finance login pages link out via `NEXT_PUBLIC_ORCH_WEB_URL` (`orchPublicHref()` from `@era/satellite-kit/ui`).

| Route | Purpose | API (if any) |
|-------|---------|--------------|
| `/login` | Platform login (email + password) | `POST /auth/login` on Orch API |
| `/register` | User signup; captures `?ref=` referral code | Orch auth API |
| `/register-org` | Organization registration (VÖEN) — fallback/deep link; primary path is modal on `/organizations` | Orch auth + MDM |
| `/organizations` | Org hub — list memberships, switch org, **+ Organization** modal | `GET /memberships`, `POST /auth/register-organization` |
| `/workspace` | Active org systems (Finance + industry); entitled → **Open**, else → pricing (no waitlist) | `GET /v1/subscription/me` |
| `/settings` | Settings hub (team, subscription) | — |
| `/settings/subscription` | Plan, trial, module chips | `GET /v1/subscription/me` |
| `/pricing` | Public pricing storefront | `GET /v1/public/pricing` |
| `/help` | Canonical FAQ (az \| ru \| en) | — |
| `/terms` | User agreement (az \| ru \| en) | — |
| `/partner` | Referral / partner dashboard | `GET /v1/partner/dashboard` |
| `/` | **Marketing landing** (guest) / auth redirect (authed → workspace/orgs) | `GET /v1/public/landing-modules` |
| `/industry/[vertical]` | SSO deep link for a vertical (entitlement-gated) | SSO launch |

**Redirects to Orchestrator:** Finance `/` (marketing), `/register`, `/register-org`, `/pricing`, `/partner`, `/companies` → `/organizations`, `/settings/subscription`, `/settings/team`, `/dispute/*`, `/super-admin/*`, `/industry/*`; unauthenticated Finance `/login` → `{ORCH_WEB}/login?next=finance` when CP handoff is enabled.

---

## Industry satellites (Web + `/api` on same host)

| # | Display | Repo folder | Docker service | Subdomain | Port | Public URL |
|---|---------|-------------|----------------|-----------|------|------------|
| 5 | Hotel PMS | `era-hotel-pms` | `hotel-pms` | `hotel-pms` | 3201 | `https://hotel-pms.era-365.online/` |

**Hotel FO routes (Wave B):** `/`, `/room-plan`, `/reports/reservations`, `/reports/group-reservations`, `/reports/reservations/notes`, `/reports/inhouse-daily`, `/reports/end-of-day-logs`, `/reports/reservation-times`, `/reports/room-changes`, `/in-house`, `/operations`. See [era-hotel-pms/doc/FRONT-OFFICE-ELECTRAWEB.md](../era-hotel-pms/doc/FRONT-OFFICE-ELECTRAWEB.md).
| 6 | F&B POS | `era-fnb-pos` | `fnb-pos` | `fnb-pos` | 3202 | `https://fnb-pos.era-365.online/` |
| 7 | Clinic | `era-clinic` | `clinic` | `clinic` | 3203 | `https://clinic.era-365.online/` |
| 8 | Retail & E-commerce | `era-retail-pos` | `retail-pos` | `retail-pos` | 3204 | `https://retail-pos.era-365.online/` |
| 9 | Logistics & Customs | `era-logistics` | `logistics` | `logistics` | 3205 | `https://logistics.era-365.online/` |
| 10 | Construction | `era-construction` | `construction` | `construction` | 3206 | `https://construction.era-365.online/` |
| 11 | CRM & Communications | `era-crm` | `crm` | `crm` | 3207 | `https://crm.era-365.online/` |
| 12 | Auto Service | `era-auto-service` | `auto-service` | `auto-service` | 3208 | `https://auto-service.era-365.online/` |
| 13 | Wholesale & Distribution | `era-wholesale` | `wholesale` | `wholesale` | 3209 | `https://wholesale.era-365.online/` |
| 14 | Bank (operational satellite) | `era-bank` | `bank` | `bank` | 3210 | `https://bank.era-365.online/` |

API: `https://{subdomain}.era-365.online/api/...` (Next.js Route Handlers).

**`era-bank`** carries the `industry_banking` gate and is a UI/workflow client of the headless **`era-bank-core`** engine (`:4300`); it holds **no ledger/money state** (ADR D9). Its `/api` is a BFF proxy to the engine. GL reads use **`/api/gl/*`** (trial balance, chart) — not nested under `/api/accounts`.

---

## Port map (quick)

| Port | Service |
|------|---------|
| 3000 | Orchestrator Web |
| 3100 | Finance Web |
| 3201–3210 | Industry satellites (3210 = era-bank; see table above) |
| 4000 | Orchestrator API |
| 4100 | Finance API |
| 4200 | ERA Data Hub API |
| 4300 | Bank Core API (headless engine) |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 8080 | Traefik dashboard (dev) |

---

## Billing slugs and launcher

| Product | Billing slug | Orch path | `vertical` |
|---------|--------------|-----------|------------|
| Hotel PMS | `industry_hotel_pms` | `/industry/hotel` | `hotel` |
| F&B POS | `industry_fnb_pos` | `/industry/fnb-pos` | `fnb-pos` |
| Clinic | `industry_clinic` | `/industry/clinic` | `clinic` |
| Retail | `industry_retail` | `/industry/retail` | `retail` |
| Logistics | `industry_logistics` | `/industry/logistics` | `logistics` |
| Construction | `industry_construction` | `/industry/construction` | `construction` |
| CRM | `industry_crm` | `/industry/crm` | `crm` |
| Auto Service | `industry_auto_service` | `/industry/auto-service` | `auto-service` |
| Wholesale | `industry_wholesale` | `/industry/wholesale` | `wholesale` |
| Bank (satellite) | `industry_banking` | `/industry/banking` | `banking` |

**Banking modules** (`catalog_kind = MODULE`, `satellite_key = industry_banking`): `banking_core` (mandatory), `banking_deposits`, `banking_loans`, `banking_cards`, `banking_payments`, `banking_aml`, `banking_treasury`, `banking_dbo`, `banking_regreporting`. Bundles `banking_bundle_retail|universal`. Branch metering quota: `active_branches`. The `industry_banking` gate is carried by the **`era-bank`** satellite; the regulated logic runs in the headless **`era-bank-core`** engine. Customer self-service runs in **`era-bank-dbo`** (`:3211`, module `banking_dbo`).

**Legacy slugs** (read for one release): `industry_fnb_pos`, `industry_retail`, `industry_logistics`, `industry_crm`, `industry_auto_service`. Migrate: `node scripts/migrate-industry-module-slugs.mjs`.

**API `modules` fields:** `industryFnbPos`, `industryRetail`, `industryLogistics`, `industryCrm`, `industryAutoService`, …

---

## Environment variables (canonical)

| Role | Variable | Example (prod) |
|------|----------|----------------|
| Orch Web | `ERA_APP_ORIGIN` | `https://app.era-365.online` |
| Orch API | `ERA_API_ORIGIN` | `https://api.era-365.online` |
| Finance Web | `ERA_FINANCE_ORIGIN` | `https://finance-core.era-365.online` |
| Finance API (public) | `ERA_FINANCE_API_ORIGIN` | `https://finance-api.era-365.online` |
| Finance API (internal) | `ERA_FINANCE_API_INTERNAL_URL` | `http://finance-core:4100` |
| Finance API expose | `ERA_FINANCE_API_PUBLIC` | `false` / `true` |
| Hotel | `ERA_HOTEL_PMS_ORIGIN` | `https://hotel-pms.era-365.online` |
| F&B | `ERA_FNB_POS_ORIGIN` | `https://fnb-pos.era-365.online` |
| Clinic | `ERA_CLINIC_ORIGIN` | `https://clinic.era-365.online` |
| Retail | `ERA_RETAIL_ORIGIN` | `https://retail-pos.era-365.online` |
| Logistics | `ERA_LOGISTICS_ORIGIN` | `https://logistics.era-365.online` |
| Construction | `ERA_CONSTRUCTION_ORIGIN` | `https://construction.era-365.online` |
| CRM | `ERA_CRM_ORIGIN` | `https://crm.era-365.online` |
| Auto | `ERA_AUTO_SERVICE_ORIGIN` | `https://auto-service.era-365.online` |
| Wholesale | `ERA_WHOLESALE_ORIGIN` | `https://wholesale.era-365.online` |

**Launcher (Next.js):** `NEXT_PUBLIC_SATELLITE_FNB_POS_URL`, `NEXT_PUBLIC_SATELLITE_HOTEL_URL`, … — set from `ERA_*_ORIGIN` in compose.

| Cross-app links | Variable | Example (local Docker) |
|-----------------|----------|------------------------|
| Orchestrator web | `NEXT_PUBLIC_ORCH_WEB_URL` | `http://127.0.0.1:3000` |
| Orchestrator API | `NEXT_PUBLIC_ORCH_API_URL` | `http://127.0.0.1:4000` |
| Finance web | `NEXT_PUBLIC_FINANCE_WEB_URL` | `http://127.0.0.1:3100` |
| Storage add-on gate | `PLATFORM_STORAGE_ENABLED` | `true` — enables upload API routes |
| S3 driver | `STORAGE_DRIVER`, `S3_*`, `AWS_*` | See [PLATFORM_ADDONS.md](./PLATFORM_ADDONS.md) § platform_storage |
| Data Hub (internal) | `ERA_DATA_HUB_URL` | `http://data-hub:4200` |
| Data Hub consumer | `ERA_DATA_HUB_ENABLED` | `true` on **finance-core** and **bank-core** (Phase 2 contract default) |
| Data Hub service token | `DATA_HUB_SERVICE_TOKEN` | Required when hub consumer enabled |
| Finance CBAR ingest | `ERA_DATA_HUB_FINANCE_CBAR_INGEST_DISABLED` | `true` — finance no longer runs CBAR HTTP/cron (hub SoR) |
| Industry reference data | `ORCHESTRATOR_URL`, `SATELLITE_EVENT_SERVICE_TOKEN`, `ERA_SATELLITE_ORGANIZATION_ID` | Industry sync reads via orchestrator `GET /platform/v1/catalog/*` ([ADR](./adr/orchestrator-platform-integration-gateway.md)). Orchestrator backend: `ERA_DATA_HUB_URL`, `DATA_HUB_SERVICE_TOKEN`. HS tariff preview remains Finance-only. |
| Data Hub RO (Phase 0) | `FINANCE_RO_DATABASE_URL` | Read-only `era_finance` (D1) |
| Data Hub auth | `DATA_HUB_SERVICE_TOKEN`, `DATA_HUB_DEV_API_KEYS` | Internal / MVP external keys |
| Bank Core org | `ERA_BANK_ORGANIZATION_ID` | The single bank org (one deployment = one bank) |
| Bank Core ref-data mode | `ERA_DATA_HUB_ONPREM` | `true` for isolated on-prem bank deployments |
| Bank satellite → engine | `ERA_BANK_CORE_URL`, `BANK_CORE_SERVICE_TOKEN` | `era-bank` BFF calls to `era-bank-core` |
| Bank satellite origin | `ERA_BANK_ORIGIN` | `https://bank.era-365.online` |
| Sanatorium per-satellite org (docker) | `ERA_HOTEL_ORGANIZATION_ID`, `ERA_FB_ORGANIZATION_ID`, `ERA_CLINIC_ORGANIZATION_ID`, `ERA_RETAIL_ORGANIZATION_ID` | See [NAFTA_SANATORIUM_UAT.md](./NAFTA_SANATORIUM_UAT.md); fallback `ERA_SATELLITE_ORGANIZATION_ID` |
| Hotel guest MDM strict | `ERA_HOTEL_GUEST_MDM_STRICT` | `true` in production templates — create blocked without MDM link after transient resolve |
| Dev module unlock (deprecated) | `ERA_DEV_UNLOCK_ALL_MODULES` | Superseded by [ADR platform-trial-hierarchy](./adr/platform-trial-hierarchy.md) — use owner Connect + super-admin trial UI |

**JWT issuer (current):** `era-orchestrator`

---

## Local `hosts` (development)

```text
127.0.0.1 era-365.online app.era-365.online api.era-365.online
127.0.0.1 finance-core.era-365.online finance-api.era-365.online
127.0.0.1 hotel-pms.era-365.online fnb-pos.era-365.online clinic.era-365.online retail-pos.era-365.online
127.0.0.1 logistics.era-365.online construction.era-365.online crm.era-365.online
127.0.0.1 auto-service.era-365.online wholesale.era-365.online
127.0.0.1 data.era-365.online
```

---

## PostgreSQL databases

| Env variable | Database name |
|--------------|---------------|
| `ORCHESTRATOR_DB` | `era_orchestrator` |
| `FINANCE_DB` | `era_finance` |
| `HOTEL_DB` | `era_hotel_pms` |
| `FNB_POS_DB` | `era_fnb_pos` |
| `RETAIL_POS_DB` | `era_retail_pos` |
| `LOGISTICS_DB` | `era_logistics` |
| `CONSTRUCTION_DB` | `era_construction` |
| `CRM_DB` | `era_crm` |
| `AUTO_SERVICE_DB` | `era_auto_service` |
| `WHOLESALE_DB` | `era_wholesale` |
| `CLINIC_DB` | `era_clinic` |
| `DATA_HUB_DB` | `era_data_hub` |
| `BANK_CORE_DB` | `era_bank_core` |
| `BANK_SATELLITE_DB` | `era_bank` (operational/UI state only) |

After DB name changes: reset dev volume (`docker compose down` + remove `docker-data/postgres`) or run rename migration.

---

## Related docs

- [SETUP_AND_RUN.md](./SETUP_AND_RUN.md) — how to start the stack
- [SMOKE_ALL_SERVICES.md](./SMOKE_ALL_SERVICES.md) — health checks
- [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) — SSO and JWT
