# DESIGN.md — ERA Ecosystem (Global UI/UX)

**Final single source of truth** for all ERA product UI (umbrella `DESIGN.md`; apps under `era-finance-core`, `era-orchestrator`, and industry satellites). Satellite doc standard: [`docs/SATELLITE_DOCUMENTATION.md`](docs/SATELLITE_DOCUMENTATION.md).

Code tokens: `apps/web/lib/design-system.ts`, `apps/web/lib/form-styles.ts`, `apps/web/lib/form-classes.ts`. New and refactored screens **must** match this document; divergent legacy UI is **debt to remove**, not an alternate standard.

---

## Three-tier design tokens (hybrid)

**Canonical implementation:** `packages/satellite-kit/src/ui/tokens/`  
**ADR (do not delete without replacement):** [`docs/adr/era-design-tokens-3tier.md`](docs/adr/era-design-tokens-3tier.md)

ERA uses a **3-tier Design Tokens** model so authors do not set size/color/placement
per control by hand. Format: **hybrid TypeScript** (L1/L2 values + L3 static
Tailwind class strings for JIT). Not DTCG JSON yet.

| Tier | File | May contain raw hex? | Purpose |
|------|------|----------------------|---------|
| **L1 Primitives** | `tokens/primitives.ts` | **Yes (only here for values)** | Palette, type scale, radii, spacing, field `ch` widths |
| **L2 Semantic** | `tokens/semantic.ts` | **No** | Role aliases: `text.primary`, `surface.card`, `action.fill`, … |
| **L3 Components** | `tokens/components.ts` | Yes, but **must match L1** | Exported `*_CLASS` strings (`PRIMARY_BUTTON_CLASS`, …) |

**Facade:** `packages/satellite-kit/src/ui/design-system.ts` re-exports L3 (no new hex).  
**Import:** `@era/satellite-kit/ui`.

### Automation (data type -> placement)

| API | Role |
|-----|------|
| `resolveField(dataType, elementType?, context?)` | preset, widthClass, align, format, `filterControl` |
| `resolveColumns` / `columnFilters` | table column schema -> cell align + `EraListFilterBar` filter specs |

**Rule:** every list/table screen should expose filters derived from column
`dataType` (search, select, date range, amount range as appropriate) via
`EraListFilterBar` between `PageHeader` and the table.

### Enforcement

```bash
npm run lint:token-layers      # L2 no hex; L3 hex subset of L1; facade clean
npm run lint:design-tokens    # baseline: raw inputs / forbidden radii in apps
```

**Change process:** edit L1 -> L2 aliases -> align L3 class strings -> run both lints
-> rebuild `@era/satellite-kit`. Never emergency-reset the kit to green CI.

---

## Corner radius — modern SaaS (tokens in `apps/web/lib/design-system.ts`)

Use **Tailwind scale radii** for a softer, contemporary shell. **Do not** default to near-square **`rounded-[2px]`** on outer chrome, fields, or buttons.

| Category | Standard | Notes |
|----------|----------|--------|
| **Outer shells** | **`rounded-2xl`** | Modal panels (`role="dialog"` roots, `MODAL_DIALOG_CONTENT_CLASS`), **cards**, **panels**, **dropzones**, **table viewports** (`DATA_TABLE_VIEWPORT_CLASS`). Use **`rounded-xl`** only if `2xl` clips content or breaks a tight layout. |
| **Form controls** | **`rounded-lg`** | **`Input`**, **`<select>`**, **`Select`**, **`Textarea`**, **`DatePicker`** surface, **combobox** triggers, **checkbox** frames — align with tokens (`MODAL_INPUT_CLASS`, `FORM_INPUT_CLASS`, etc.). Use **`rounded-md`** only for documented density exceptions. |
| **Buttons** | **`rounded-lg`** | Primary, outline, ghost, toolbar, modal footer, table row icon hit targets — same family as fields (`PRIMARY_BUTTON_CLASS`, `SECONDARY_BUTTON_CLASS`, `TABLE_ROW_ICON_BTN_CLASS`, `MODAL_FOOTER_BUTTON_CLASS`). **`rounded-md`** allowed if matched to paired inputs in the same row. |

**Graphic exceptions:** non-interactive **status dots** or **avatars** may use **`rounded-full`**. **Pills / micro-badges** may use **`rounded-md`**–**`rounded-lg`**; avoid arbitrary one-off radii unless TZ documents them.

---

## Color palette

- **Primary**: #34495E (Slate Blue) — long-session UI text and titles.
- **Secondary**: #7F8C8D (Asbestos) — secondary text, modal close icon.
- **Background**: #EBEDF0 (System gray) — app shell background.
- **Action**: #2980B9 (Strong Blue) — primary actions, focus rings on controls.
- **Border (muted)**: #D5DADF — cards, fields, dividers on `#EBEDF0` (avoid low-contrast `slate-100`-only borders).

---

## Form elements & inputs

Applies to all single-line and multi-line **data entry** controls unless TZ states otherwise.

- **Radius:** **`rounded-lg`** (see § Corner radius).
- **Border:** **`border` `border-[#D5DADF]`** at rest.
- **Focus:** **`focus:outline-none`** + **`focus:ring-1`** + **`focus:ring-[#2980B9]`**.
- **Height (single-line):** **`h-9`**, **`min-h-9`**, **`box-border`**.
- **Typography:** values and placeholders **`text-[13px]`**; placeholder color **`#7F8C8D`**.
- **Background:** **`bg-white`**; disabled: muted fill per tokens (e.g. `#F4F5F7`).

**Multiline** (`Textarea`): same radius, border, and focus; height follows content (`min-h` per token), not forced `h-9`.

**Dates (canonical):** use **`DatePicker`** from `@era/satellite-kit/ui` — **not** a bare native `<input type="date">` as the only control. Chromium has no `az` locale for the native date placeholder and falls back to Russian glyphs. Rules:

- Form **value** is always ISO **`YYYY-MM-DD`** (empty string when unset).
- **Display** is **`DD.MM.YYYY`**; **placeholder** comes from i18n (`common.datePlaceholder`, e.g. `gg.aa.iiii` / `дд.мм.гггг` / `dd.mm.yyyy`).
- Optional calendar affordance may open a native picker for selection only; the visible field remains the i18n text control.
- Do not rely on browser/`lang` for date placeholder text.

---

## Buttons (global)

- **Radius:** **`rounded-lg`** for every button (see § Corner radius).
- **Label size:** **`text-[13px]`** on button labels unless TZ requires a one-off (e.g. legal microcopy).
- **Heights:** Toolbar / dense toolbar actions **`h-8`** (`PRIMARY_BUTTON_CLASS` / `SECONDARY_BUTTON_CLASS` in design-system). **Modal footers** and **form-aligned** primary/cancel pairs **`h-9`** with **`text-[13px]`** — same vertical rhythm as fields.
- **Primary:** fill **`#2980B9`**, hover per token sheet.
- **Outline / cancel:** white fill, border **`#D5DADF`**, **`variant="outline"`** where using the shared `Button` component.

---

## Modal & dialog standards

Applies to **`role="dialog"`**, Radix **`Dialog`**, and full-viewport overlays that behave as modals.

### Shell

- **Outer panel:** **`rounded-2xl`** border **`#D5DADF`**, white background (see § Corner radius; **`rounded-xl`** if layout requires).

### Header

- **Left:** Title (`DialogTitle` or equivalent) — **`text-lg`**, **`font-semibold`**, **`#34495E`**.
- **Right (mandatory):** Close control — **Lucide `X`**, **`variant="ghost"`**, hit area **`h-8 w-8`**, icon color **`#7F8C8D`**, **`aria-label`** from i18n `common.close` (or equivalent).
- **No** redundant header close affordances (e.g. text «Bağla» in the header row) when **`X`** is present.

### Body

- **Padding:** main content area **`p-6`** (24px).
- **Scroll:** scroll the body; keep header (and footer if present) structurally outside the scrolling region when possible.

### Footer

- **`border-t` on the footer is forbidden.** No tinted footer band; separation from the form is **`margin` only** (typically **`mt-6`** above the action row).
- **Layout:** **`flex justify-end gap-2`**.
- **Cancel:** **`variant="outline"`**, white background, gray border **`#D5DADF`**.
- **Primary action:** **`variant="primary"`**, **`#2980B9`**.
- Footer buttons **`h-9`** and **`text-[13px]`** to align with § Form elements.

---

## Layout spacing (forms)

- **Label → field:** **`space-y-1.5`**, or **`mb-1.5`** on the label immediately before the control.
- **Between field groups (vertical):** **`space-y-4`**.
- **Form root inside a modal:** prefer **`space-y-4`**; use **`space-y-3`** only if TZ mandates tighter density.

---

## Field width taxonomy (shipped)

Semantic widths live in `@era/satellite-kit/ui` — **`field-presets.ts`** (`FIELD_WIDTH`, `fieldWidthClass`) and field primitives in **`field.tsx`**.

| Preset | Use case | Tailwind |
|--------|----------|----------|
| `count` | Adults, children, nights, qty | `w-[6ch]` |
| `time` | Check-in/out time | `w-[7ch]` |
| `date` | ISO date fields | `w-[10ch]` |
| `amount` | Money, rates | `w-[12ch]` + tabular-nums |
| `voen` | VÖEN (10 digits) | `w-[11ch] min-w-[9.5rem]` |
| `fin` | FIN (7 chars) | `w-[9ch]` |
| `phone` | +994 phone | `w-[13ch]` |
| `code` | Short codes, refs | `w-[14ch]` |
| `shortText` | Names, labels | `w-[24ch]` |
| `longText` / `selectWide` / `textarea` | Full rail width | `w-full` |
| `select` | Compact dropdown | `w-[20ch]` |

**Components (required for new modal CRUD):**

- **`Field`**, **`FieldSelect`**, **`FieldTextarea`** — label + `MODAL_*` tokens + explicit **`preset`**
- **`FieldRow`** — responsive grid (`cols` 2|3|4|6); `data-testid="field-row"`
- **`FieldSection`** — collapsible dense-form sections (legend + chevron)

**Deprecated in new code:** raw `<input>` / `<select>` with only `MODAL_INPUT_CLASS` and `w-full` on scalar fields. Ops canvases (POS floor, chessboard) are exempt.

**Enforcement:** `npm run lint:design-tokens` (baseline mode in CI packages job). Modal migration waves: `docs/FIELD_SYSTEM_MODAL_WAVES.md`. After full satellite sweep, new modal CRUD under `era-*/src/components/**` must use `Field*` (ops canvases exempt).

---

## Typography

- **System fonts:** SF Pro, Segoe UI, sans-serif stack.
- **Base UI size:** **13px** — fields, buttons (see § Buttons), dense tables.
- **Modal / page titles in chrome:** **`text-lg`** (18px) where specified in § Modal & Dialog Standards.

---

## Page chrome & navigation

- **App main content padding (canonical):** under the fixed header, every shell uses **`APP_MAIN_CONTENT_PADDED_CLASS`** from `@era/satellite-kit/ui` (`px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:px-8 lg:pb-8`). Orchestrator and Finance wrap with **`APP_MAIN_CONTENT_CLASS`** (`app-shell-main` + padded); satellites use **`EraOpsContent`** (same padded token). **Do not** invent alternate top padding per app.
- **`PageHeader`** (`@era/satellite-kit/ui` / Finance `page-header.tsx`) is for **full pages only** — title (line 1, left), optional subtitle, **`PageHeader.actions`** inline on the same row (primary actions such as `+ Add`). **Do not** use `PageHeader` inside modals; modals follow § Modal & dialog standards.
- **Cross-module / in-app section links:** **sidebar only** — do not duplicate left-nav destinations as `PageHeader` buttons (Home, sibling boards).
- **List filters (canonical):**
  - **1–3 compact toggles** (period, grouping, horizon): `FilterMenuButton` / compact controls in **`PageHeader.actions`** or an ops toolbar.
  - **2+ fields** (search, selects, ranges): **`EraListFilterBar`** from `@era/satellite-kit/ui` — separate card **between** `PageHeader` and the table. Labels **on top** via `Field` / `FieldSelect` only. **Instant apply** (selects/dates on change; text search via `useDebouncedValue(..., 300)`). **Reset** on the same row as fields — **no Apply button**.
  - **Do not** put bare `<input type="search">` or left-of-field labels on list screens.
- **Cross-module links:** **sidebar only** (PRD §10.1) — no horizontal “app switcher” strip above content.
- **Headings:** page titles **`#34495E`**; primary actions **`#2980B9`**.
- **Contrast:** controls must read clearly on `#EBEDF0`.
- **Sidebar:** every item has a **Lucide** icon.
- **Empty states:** `EmptyState` — centered icon, title, optional description.

---

## Grid

- **Baseline:** strict **4px** grid for spacing and alignment.

---

## Data tables (v1.0)

- **Header:** background `#F8FAFC`, text `#475569` (**11–12px** bold in header cells only — table chrome, not form controls), bottom border `#D5DADF`, **sticky** on long lists.
- **Rows:** white base, hover `#F1F5F9`.
- **Cell data:** **`text-[13px]`** (`text-[13px]` / token equivalents).
- **Alignment:** text left; amounts/dates right (`text-right`), monospace for digits where practical; status centered.
- **Borders:** horizontal **`border-b`** `#D5DADF` only — no vertical grid lines.
- **Density:** `py-2 px-4` (compact).

### Table footer — pagination

- **Placement:** directly **below** the table viewport (same horizontal padding as the table container), **outside** the scrollable `<tbody>` region.
- **Row height:** controls **`h-8`** (32px) to match compact toolbar buttons; vertical gap **`mt-2`** or **`mt-3`** from the table bottom border.
- **Copy:** page indicator **`text-[12px] text-[#7F8C8D]`** (e.g. “Page X of Y” / localized equivalent); numeric page values may use **`font-mono`** for alignment with amounts elsewhere.
- **Controls:** prev/next use the same **ghost / secondary** affordance as table toolbars (`rounded-lg`, **13px** label); rows-per-page selector matches **form** input height (`h-8`, bordered `#D5DADF`).

---

## Table actions & icons

Row actions live in the **last** column (e.g. **`w-[120px]`**). **Lucide** icons.

- **Control shape:** ghost-style hit targets, **`rounded-lg`**, **28×28** or **32×32** px per density token.
- **Icons:** View `Eye` `#2980B9`; Edit `Pencil`/`Edit3` `#7F8C8D`; Send `Send`/`Share2` `#2980B9`; Delete `Trash2` `#E74C3C`; Archive/Lock `#BDC3C7`.
- **Tooltips:** required (AZ/RU action name).

---

## CRUD pattern — modal-only (industry satellites)

- **Index screens:** table or card grid + toolbar; **Add** opens a modal (never a dedicated create route).
- **Edit / delete:** row action → modal confirmation or edit modal.
- **Master data:** `EraDataGrid` in `@era/satellite-kit/ui` — modal CRUD hooks; inline edit only for trivial fields.
- **Exceptions (operational canvases):** POS floor, KDS, Room Plan Gantt, Room Rack — full-viewport layouts; not full-page CRUD forms.
- **Reservation Card (hotel):** large modal ~90% viewport (`max-w-[min(90vw,1400px)]`) with tabs (Guests · Pricing · Folio · Notes) — ElectraWeb parity; see `ReservationCardModal`.

---

## Ops shell — full viewport (`EraAppShellLayout`)

Authenticated satellite routes use **`EraAppRouteShell`** / **`EraAppShellLayout`** from `@era/satellite-kit/ui` (Finance reference: `era-finance-core/apps/web/app/app-shell.tsx`):

- **Fixed header** (`EraAppHeader`) + **left sidebar** (`EraAppSidebar`, width **`17.5rem`** / `w-[17.5rem]`; collapsed rail **`4.5rem`** on `lg+`).
- Sidebar: **`overflow-x-hidden`**, sub-item labels **`truncate`** — vertical scroll only.
- **No `max-w-*`** on authenticated content — only `/login`, `/help`, marketing may constrain width.
- **Do not** put locale toggle, user name, or logout in the **sidebar footer** — they belong in the global header.
- **Do not** put create/add actions (`+`, «New …», modal openers) in the **sidebar** — primary **Add** belongs on the index screen toolbar (`PageHeader.actions` / grid toolbar). Header **left** quick links (Finance-style) may open frequent flows; sidebar links are **navigation only** (`href` routes).

### Header — right cluster (left → right)

| Order | Element | Finance | Satellites |
|-------|---------|---------|------------|
| 1 | Locale | `LanguageSwitcher` / `SatelliteHeaderLocale` | **`SatelliteHeaderLocale`** — buttons **AZ**, **RU**, **EN** |
| 2 | Organization | **`OrgSwitcher`** dropdown (holdings, switch org) | **Static label** (`HeaderOrganization variant="label"`) from platform session |
| 3 | Notifications | `InAppNotificationBell` | `SatelliteNotificationBell` |
| 4 | Profile menu | Avatar icon → Profile, Settings, Logout | `HeaderProfileMenu` (avatar only in bar) |
| 5 | Tier usage | `HeaderTierUsageBar` (quota % bars) | `useControlPlaneSubscription` or app snapshot; hidden without org |

Kit exports: `EraAppHeader`, `EraAppSidebar`, `EraAppShellLayout`, `EraAppRouteShell`, `HeaderProfileMenu`, `HeaderOrganization`, `HeaderTierUsageBar`, `useControlPlaneSubscription`. Details: [`UI_PLAYBOOK_SATELLITES.md`](docs/UI_PLAYBOOK_SATELLITES.md).

### Tier bar colors

Quota fill percentage: **&lt;70%** sky/blue, **70–90%** amber, **≥90%** red. Tooltip shows tier id and current/max per meter.

---

## Legacy ops shell (`EraOpsShell`)

**Deprecated for new work.** Existing `EraOpsRouteShell` without fixed header is replaced by `EraAppRouteShell`. Operational canvases (POS floor, KDS, Room Rack) remain full-viewport inside the shell main area.

---

## Special instructions

- Desktop tables: prefer horizontal layout.
- **Numeric data:** right-aligned.

---

## Public auth pages (`/login`, `/register`)

Applies to Orchestrator, Finance, and all industry satellites.

- **Background:** `#EBEDF0` (Light Tech Canvas) — full viewport center card.
- **Card:** `CARD_CONTAINER_CLASS` / `rounded-2xl`, white surface, muted border `#D5DADF`.
- **Header row:** page title (left, `#34495E`) + **locale toggle** (right) on the same line.
- **Fields:** single credential input (login, email, or phone) + password; `FORM_INPUT_CLASS` / `rounded-lg`, `h-9`, focus ring `#2980B9`.
- **Primary action:** full-width submit button, `#2980B9`.
- **Links below submit (order):** need account → register organization → view pricing → FAQ; separate block for user agreement (→ Orchestrator `/terms`).
- **Implementation:** `@era/satellite-kit/ui` → `AuthLoginCard`; copy from `@era/i18n-common` `auth.*`; cross-app URLs via `orchPublicHref()`.

Do **not** duplicate one-off login layouts per satellite — extend `AuthLoginCard` props for product-specific titles only.

---

## Treasury (Bank və Kassa) — v7.1

- Sidebar: `nav.sectionTreasury`, icon **Landmark**.
- **`/banking`:** account cards (101* cash + 221–224 bank) → statement import (dropzone, BANK/CASH) → operations registry (All / Bank / Cash).
- Registry **Mənbə / Источник:** `origin` on lines (import, sync, invoice mirror, manual cash-out).
- **Nəqd məxaric:** `POST /api/banking/cash-out` (731 / 101.01 + registry line).
- **Enterprise:** `SubscriptionAccessService` bypass for `ENTERPRISE` where implemented server-side.
