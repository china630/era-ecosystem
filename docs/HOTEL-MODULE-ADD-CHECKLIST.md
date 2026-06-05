# Checklist: add a new Hotel PMS submodule (`hotel_*`)

Use this when adding a billable/feature module inside **industry_hotel_pms** (e.g. `hotel_migration_pro`).

## Two layers (do not confuse)

| Layer | What it is | Where |
|-------|------------|--------|
| **Catalog** | “We sell this module” — name, price, satellite link | DB `pricing_modules` (+ optional `pricing_bundles.module_keys`) |
| **Entitlement** | “This org bought it” | DB `organization_subscriptions.active_modules` |
| **Runtime gate** | API/UI actually checks the key | TypeScript in hotel-pms + `@era/satellite-kit` |

Inserting only a row in `pricing_modules` is **not enough** for the app to know the module exists in `hotelModules` or to gate routes.

---

## Minimum code + DB touch points

### 1. Orchestrator — canonical key list (required)

- `era-orchestrator/packages/database/prisma/lib/core/hotel-module-keys.ts`
  - Add key to `HOTEL_PRICING_MODULE_KEYS`
  - Optional legacy alias in `HOTEL_MODULE_KEY_ALIASES` (e.g. `migration_pro` → `hotel_migration_pro`)

Mirror the same file in:

- `packages/satellite-kit/src/integration/hotel-module-keys.ts` (must stay in sync)

### 2. Orchestrator — catalog seed (required for new installs / seed button)

- `era-orchestrator/packages/database/prisma/lib/core/pricing-module-seed.ts`
  - Row: `key`, `name`, `pricePerMonth`, `sortOrder`, `isPremium`, `satelliteKey: "industry_hotel_pms"`

Then either:

- Deploy + `POST /v1/admin/.../config/billing/seed-pricing`, or
- Manual SQL `INSERT INTO pricing_modules (...)` with the **same `key`**

### 3. Orchestrator — enable for an org (required to “turn on”)

- Super-admin / subscription UI, or API that updates `organization_subscriptions.active_modules`
- Must include the canonical key (e.g. `hotel_migration_pro`), not only a display name

`/v1/subscription/me` exposes `hotelModules.<key>: true|false` built from `HOTEL_PRICING_MODULE_KEYS` + `active_modules`.

### 4. Hotel PMS — API gate (required for protected APIs)

- `requireHotelModule('hotel_<name>')` at the start of each route handler  
  Pattern: `era-hotel-pms/src/lib/hotel-module-gate.ts` → `assertHotelModuleActive` via orchestrator snapshot

### 5. Hotel PMS — UI routes (if there is a screen)

- `packages/satellite-kit/.../hotel-module-keys.ts` → `HOTEL_MODULE_BY_ROUTE`  
  e.g. `"/migration": "hotel_migration_pro"`
- `HotelOpsShell.tsx` — nav section `id` must equal the module key (`hotel_migration_pro`)
- `messages/{en,ru,az}.json` — `nav.*` labels

### 6. Optional

- `pricing-bundle-seed.ts` — add key to City/Resort/Sanatorium bundle `moduleKeys` if it should ship with a package
- `docs/adr/hotel-module-taxonomy.md` — documentation table
- `era-hotel-pms/doc/DELIVERY.md` — delivery note
- E2E / unit test for route → module mapping

---

## Manual DB-only workflow (experienced ops)

1. `INSERT` into `pricing_modules` with `key = 'hotel_migration_pro'`, `catalog_kind = 'MODULE'`, `satellite_key = 'industry_hotel_pms'`.
2. Add `'hotel_migration_pro'` to target org’s `active_modules` array.
3. **Still deploy** code that includes the key in `HOTEL_PRICING_MODULE_KEYS` and gates APIs — otherwise `hotelModules` in snapshot may omit the flag and routes won’t be mapped.

You do **not** need a new REST “module API” in the hotel app for catalog — hotel reads entitlements from orchestrator `GET /v1/subscription/me`.

---

## `hotel_migration_pro` (Migration PRO)

- **Purpose:** all hotel types — queue guest data for migration service (extension skeleton submits later).
- **Canonical key:** `hotel_migration_pro` (alias `migration_pro` in active_modules).
- **Bundles:** included in Hotel City, Hotel Resort, Hotel Sanatorium (`pricing-bundle-seed.ts`).
- **PMS:** `/api/migration/registrations`, `/migration` UI, nav section Migration PRO.
