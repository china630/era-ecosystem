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

‡ Finance API public route: enable with `ERA_FINANCE_API_PUBLIC=true` (open architecture). Internal always: `http://finance-core:4100`.

Finance Web proxies `/api/*` → `finance-core:4100` and `/cp/*` → `orchestrator:4000`.

---

## Public hub (Orchestrator web `:3000`)

Cross-product marketing and onboarding live on **Orchestrator web**, not Finance. Satellites and Finance login pages link out via `NEXT_PUBLIC_ORCH_WEB_URL` (`orchPublicHref()` from `@era/satellite-kit/ui`).

| Route | Purpose | API (if any) |
|-------|---------|--------------|
| `/login` | Platform login (email + password) | `POST /auth/login` on Orch API |
| `/register` | User signup; captures `?ref=` referral code | Orch auth API |
| `/register-org` | Organization registration (VÖEN) | Orch auth + MDM |
| `/pricing` | Public pricing storefront | `GET /v1/public/pricing` |
| `/help` | Canonical FAQ (az \| ru \| en) | — |
| `/terms` | User agreement (az \| ru \| en) | — |
| `/partner` | Referral / partner dashboard | `GET /v1/partner/dashboard` |
| `/` | Industry module launcher (authenticated) | entitlements snapshot |

**Redirects to Orchestrator:** Finance `/register`, `/register-org`, `/pricing`, `/super-admin/*`, `/industry/*`; unauthenticated Finance `/login` → `{ORCH_WEB}/login?next=finance` when CP handoff is enabled.

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

API: `https://{subdomain}.era-365.online/api/...` (Next.js Route Handlers).

---

## Port map (quick)

| Port | Service |
|------|---------|
| 3000 | Orchestrator Web |
| 3100 | Finance Web |
| 3201–3209 | Industry satellites (see table above) |
| 4000 | Orchestrator API |
| 4100 | Finance API |
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

**JWT issuer (current):** `era-orchestrator`

---

## Local `hosts` (development)

```text
127.0.0.1 era-365.online app.era-365.online api.era-365.online
127.0.0.1 finance-core.era-365.online finance-api.era-365.online
127.0.0.1 hotel-pms.era-365.online fnb-pos.era-365.online clinic.era-365.online retail-pos.era-365.online
127.0.0.1 logistics.era-365.online construction.era-365.online crm.era-365.online
127.0.0.1 auto-service.era-365.online wholesale.era-365.online
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

After DB name changes: reset dev volume (`docker compose down` + remove `docker-data/postgres`) or run rename migration.

---

## Related docs

- [SETUP_AND_RUN.md](./SETUP_AND_RUN.md) — how to start the stack
- [SMOKE_ALL_SERVICES.md](./SMOKE_ALL_SERVICES.md) — health checks
- [INTEGRATION_SSO_EVENTS.md](./INTEGRATION_SSO_EVENTS.md) — SSO and JWT
