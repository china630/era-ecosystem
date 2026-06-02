# UI playbook — industry satellites

Target: **list/table screens** + **modal CRUD** aligned with [DESIGN.md](../DESIGN.md) and `@era/satellite-kit/ui`.

## Layout — app shell (canonical)

Authenticated routes use the **Finance-aligned shell** from `@era/satellite-kit/ui`:

| Piece | Component | Notes |
|-------|-----------|--------|
| Root body | `APP_SHELL_CLASS` | Full viewport, `#EBEDF0` background |
| Route wrapper | **`EraAppRouteShell`** | Mobile drawer, sidebar collapse, bare public paths |
| Header | **`EraAppHeader`** | Fixed top bar; slots for left cluster + right profile cluster |
| Sidebar | **`EraAppSidebar`** | **`17.5rem`** expanded; **`overflow-x-hidden`**; collapsible sections via `EraOpsSidebarSections` |
| Main | `EraOpsContent` inside shell | No `max-w-*` on ops screens |
| Platform links | `PlatformSessionBarServer` | Finance / Billing deep links only — **not** org name (org is in header) |

Reference implementations:

| App | Shell file |
|-----|------------|
| Finance (reference) | `era-finance-core/apps/web/app/app-shell.tsx` + `MainHeader` / `MainSidebar` |
| Hotel (pilot) | `era-hotel-pms/src/components/HotelOpsShell.tsx` — FO routes: see [FRONT-OFFICE-ELECTRAWEB.md](../era-hotel-pms/doc/FRONT-OFFICE-ELECTRAWEB.md) |
| Retail / others | `src/components/*OpsShell.tsx` |

### Header right cluster (ERA / legacy ElektraWeb: read **right → left** = Profile → Organization → Bell → Locale)

DOM order (LTR): **Locale → Bell → Organization → Profile → TierBar** (`EraAppHeader` in `@era/satellite-kit`).

```mermaid
flowchart LR
  L[Locale AZ/RU/EN] --> N[Notifications]
  N --> O[Organization]
  O --> P[Profile icon]
  P --> T[TierUsageBar]
```

| Slot | Finance | Satellites |
|------|---------|------------|
| Locale | `LanguageSwitcher` (react-i18next) | **`SatelliteHeaderLocale`** — buttons **AZ**, **RU**, **EN** only |
| Filter menus | — | **`FilterMenuButton`** — grouped toolbar filters (room plan grouping/period) |
| Organization | `HeaderOrganizationSwitcher` (`variant="switcher"`) | `HeaderOrganization variant="label"` + `organizationName` from SSO/session |
| Notifications | `InAppNotificationBell` | **`SatelliteNotificationBell`** on Hotel + industry shells (Wave A/B) |
| Profile | `HeaderProfileMenu` | `HeaderProfileMenu` (avatar icon) + logout via `/api/auth/logout` |
| Tier bar | `HeaderSubscriptionStrip` → `HeaderTierUsageBar` | `useControlPlaneSubscription()` or app billing snapshot |

### Sidebar checklist

- [ ] Width **`w-[17.5rem]`** (kit default) — not legacy `w-56`
- [ ] **`overflow-x-hidden`** on aside + nav; long labels **`truncate`**
- [ ] Collapsible sections with chevron + auto-open on active route (hotel: `navSections`)
- [ ] **No** locale / user / logout in sidebar footer
- [ ] **No** create/add (`+`) or modal-only actions in sidebar — navigation links only
- [ ] Collapse toggle in sidebar header (desktop) — not a duplicate logout block

### Mobile

- Hamburger in `EraAppHeader` opens drawer; backdrop click closes
- Sidebar collapse (`4.5rem` rail) applies on **`lg+` only**

## CRUD pattern

1. **Index route** — table of entities, primary action “Add” opens modal
2. **Modal** — `ModalShell` + form; POST/PATCH to `/api/...`
3. **Delete** — confirm in modal footer (`ModalFooter`)
4. **No full-page create** for admin entities (ops flows like POS floor, Room Rack may stay full-screen)
5. **Large reservation modal (hotel):** ~90% viewport, tabbed — `ReservationCardModal` / ElectraWeb parity

## Reference implementations

| App | Example |
|-----|---------|
| Finance | `apps/web/components/sales/modals/CreateCounterpartyModal.tsx` |
| Hotel | `src/components/EraModal.tsx`, `app/admin/master-data/page.tsx` |
| Retail (SP9 pilot) | `app/settings/page.tsx` — outlet name edit in modal |

## Checklist per app admin area

- [ ] Uses `CARD_CONTAINER_CLASS` + `DATA_TABLE_CLASS` tokens
- [ ] Create/edit in modal, not dedicated `/new` page
- [ ] Errors shown inline in modal (not alert)
- [ ] API/server errors on auth pages → **Sonner toast top-right** via `showApiError` from `@era/satellite-kit/ui` (no inline red text under fields)
- [ ] i18n keys if app has locale files
- [ ] Authenticated shell uses **`EraAppRouteShell`** (not legacy `EraOpsRouteShell` without header)

## Out of scope

- Copying full Finance ERP density to satellites (subscription locks, holdings tree in sidebar)
- Orch web super-admin (separate shell — see [orch-admin-shell.md](./adr/orch-admin-shell.md))

## Public auth pages (`/login`)

Use **`AuthLoginCard`** from `@era/satellite-kit/ui` on every satellite and match [DESIGN.md](../DESIGN.md):

- Background `#EBEDF0`; card `CARD_CONTAINER_CLASS`
- Title row: product title (left) + **`SatelliteLocaleToggle`** (right)
- Single credential field: login / email / phone + password
- Submit → `POST /api/auth/login`
- Links (in order): need account → register on Orch → pricing on Orch → FAQ on Orch; user agreement → Orch `/terms`
- URLs: `orchPublicHref("/register")`, `orchPublicHref("/pricing")`, etc. — import from **`@era/satellite-kit/ui`** only (not main kit barrel; avoids `node:fs` in client bundles)

Reference: `packages/satellite-kit/src/ui/auth-login-card.tsx`, Finance `apps/web/app/login/page.tsx`.

## Error display (auth + API)

- Mount **`EraToastProvider`** or **`SatelliteAppProviders`** in app layout (Orch: `AppProviders` includes `EraToastProvider`).
- On failed login/register/API calls: **`showApiError(body, fallbackKey)`** — toast **top-right** only.
- Post-login navigation: **`assignNoStoreRedirect(url)`** from `@era/satellite-kit/ui` (not the main kit barrel).
- Do **not** render inline `text-red-600` under auth form fields; `AuthLoginCard` / `AuthRegisterCard` ignore the deprecated `error` prop.

## Scaffold tool

`node tools/apply-satellite-design-shell.mjs` — Tailwind + layout + `*OpsShell` template using `EraAppRouteShell`.
