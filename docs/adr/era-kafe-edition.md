# ADR: ERA Kafe edition (street F&B on `era-fnb-pos`)

**Status:** Accepted  
**Date:** 2026-09-19  
**Product:** ERA Kafe (commercial brand) · satellite `era-fnb-pos` · billing `industry_fnb_pos`  
**Related:** [era-commercial-catalog.md](./era-commercial-catalog.md) · [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md) · [fb-mixed-settlement-routing.md](./fb-mixed-settlement-routing.md) · [orchestrator-satellite-vs-module.md](./orchestrator-satellite-vs-module.md) · [managed-lists-vs-enums.md](./managed-lists-vs-enums.md) · [deployment-topology.md](./deployment-topology.md) · [platform-trial-hierarchy.md](./platform-trial-hierarchy.md)

## Context

Azerbaijan has on the order of **~24k catering business subjects** (SSC / Turan, early 2023) and **~8–12k in Baku** by count (not GMV). Most micro outlets run a cashier notebook, not iiko/Poster. List price must sit on the frozen palette **19 / 29 / 39 / 99 AZN**.

Today `era-fnb-pos` is a **hotel-attached restaurant** satellite (Nafta: room-charge, banquet BEO, PMS shift, Foundation/GL events). Entitlement is satellite gate `industry_fnb_pos` plus Kafe submodules `fnb_kitchen_kds`, `fnb_waiter_pin`, `fnb_qr_menu` that **do cut routes** when `FnbOrgProfile.edition=kafe`.

Selling that shell as «29 AZN street POS» would bill **Foundation 29 + Gate 29 = 58 AZN**, show hotel chrome, and fail TikTok onboarding.

## Decision

### 1. Brand vs keys

- **Market name:** ERA Kafe (az/ru/en). Not «ERA Kassa» (sounds like KKM / bank / Finance cash).
- **Code stays:** app `era-fnb-pos`, gate `industry_fnb_pos`. No second satellite DB.
- **Edition / signup source:** `kafe` (org flag or `signupSource=kafe`). Hotel F&B orgs stay on the existing Nafta/hotel shell.
- **Control plane:** one orchestrator. Dedicated landing + short onboarding form write the **same** org, subscription, and satellite bind. No parallel identity store.

A later **banquet-hall** SKU is a **third world**, not mixed into Kafe nav and not implied by Nafta banquet BEO.

### 2. Identities: owner login ≠ cashier PIN

They are **two people (or two credentials), never one shared login.**

| Actor | How they enter | What they see |
|-------|----------------|---------------|
| **Owner** (`BUSINESS_OWNER` / local `FB_MANAGER`) | Own **login + password** (or SSO). Not a 4-digit PIN. | Both branches’ Z, voids, discounts, menu, billing, staff PIN admin. May also open the till **on their own session** (manager override). |
| **Cashier** | **PIN** on the device already bound to an outlet. No owner password. | Today’s tables, tap dishes, cash/card, «bitdi»/«var». **No** yesterday’s totals, **no** other outlet, **no** billing. |
| **Waiter** (SKU Зал) | Own **PIN**, pack of 5 per 19 AZN | Own tables / tickets on that outlet. Cannot take payment unless product later allows it (v1: cashier settles). |
| **Kitchen** (SKU Кухня) | KDS screen, role `FB_KITCHEN` | Fire/done only. |

Owner password on the cashier phone is forbidden as the normal till flow (theft + «who voided»). If the owner works the till, they use **manager login** or a **separate cashier PIN** issued to themselves — still not «one login for both roles».

Workforce headcount meters (**2 / 4 AZN per person**) are **off** for this edition. PIN lives in F&B `StaffRoster`.

### 3. Commercial SKUs (palette intact)

Foundation **29 is waived** on the Kafe invoice until the org enables `nas`. TikTok price is Gate **29**, not 58.

| Storefront | Key | AZN/mo | Includes |
|------------|-----|--------|----------|
| **Kassa** (Gate) | `industry_fnb_pos` | **29** | 1 POS (one cash drawer / shift). Tables on **that** screen. Queue/takeaway. Menu admin. Shift X/Z. Owner reports. i18n az-first. |
| **Zal** | `fnb_waiter_pin` (rename: floor/waiter, **strip room-charge from the commercial name**) | **19** | Waiter phones. **5 PINs** included. Next 5 PINs = **+19**. Cashier PIN does not consume the pack. |
| **Mətbəx** | `fnb_kitchen_kds` | **19** | One KDS station (tablet on the wall). No thermal printer in v1. |
| **QR menyu** | `fnb_qr_menu` (new) | **19** | Public read-only menu. XOR with `platform_portal` — do not double-charge. |
| Extra **physical** till or **branch** | capacity `pos` | **+19** | See §4. Waiter phones are not POS. |

Not in v1 storefront: `fnb_recipes_bom` (39), `fnb_delivery_hub` (29), `inventory`, `nas`, `platform_delivery`, SMS/WA packs, platform acquiring **1.5%**. Guest card pay = **their** bank terminal; ERA does not sell KKM.

**QR (19):** same `MenuItem` prices as POS. Guest **cannot place an order**. No cart. Table-scoped QR (`masa=4`) is allowed as display hint for the waiter, not a guest checkout. Stop-list (§5) applies to QR.

Land-and-expand: Gate includes the **table map on one device** so cashier pain sells Zal. Gate does **not** include a second device ordering.

### 4. Branch = second outlet, same firm

One VOEN → one org → **N `Outlet` rows**. Yasamal + Nərimanov = two outlets, **not** two orgs.

- Billable POS count = outlets that run a till (open shift), **+19** each after the first included in Gate.
- Zal / KDS / QR attach **per outlet** (or org-level entitlement with per-outlet enable — implementation may start org-level flags, but stop-list and shift are per outlet).
- Creating a branch **copies** menu + default tables from outlet 1; prices may diverge later.
- **Device bind:** cashier tablet stores `outletId` after owner confirms «bu Yasamal-dır?». Changing outlet = owner only.
- **PIN:** `StaffRoster` must become **outlet-scoped** (or clock-in selects outlet). A Nərimanov PIN must not open Yasamal tables.
- Owner login sees **all** outlets; cashiers never pick the other branch.

Aligns with [tenancy-and-outlet-boundaries.md](./tenancy-and-outlet-boundaries.md): Outlet = POS axis, not DEPARTMENT/STANDALONE.

`CAPACITY_DRIVERS` already: `industry_fnb_pos`, `includedInGate: 1`, `unitAzn: 19`, `unit: "pos"`. Waiter packs are a **new** driver (5 PINs / 19 AZN), not extra `pos`.

### 5. Stop-list without stock

v1 does **not** ship inventory, recipes, or kg of meat.

Cashier tile **«bitdi» / «var»** sets a flag `(outletId, menuItemId)` until end of Baku day or until «var». POS tiles and QR hide `bitdi` items. This is not `MenuItem.active` (retire from catalog) and not daily-menu whitelist.

### 6. Offline

IndexedDB queue exists (`offline-queue.ts`) but is **not** wired to pay/fire UI.

v1: tablet on **its own 4G**, not café Wi-Fi. Cache menu + tables. Buffer **15–30 min** of open tickets / lines; replay with conflict «masa doludur». **Online-only:** Z-close, outlet switch, bitdi, final pay ack, QR page. Multi-hour outage → paper, not fake local ledger.

### 7. Alcohol

Software only. Pivəxana template may list beer. Licence/excise is the owner’s. One sentence in the offer.

### 8. Two F&B worlds (then three)

| World | Shell | Hotel APIs |
|-------|-------|------------|
| Hotel / Nafta F&B | Current nav (room-charge, banquet, calendar, import) | On |
| **ERA Kafe** | Narrow nav: floor, orders, menu, shift, optional KDS/QR | `HOTEL_MODE_OFF` → 403 on room-charge, in-house, BEO, PMS NA |
| Banquet halls | Future SKU | Not Kafe v1 |

Kafe must not emit `SATELLITE_FB_SALE_COMPLETED` / stock events until `nas` is on.

### 9. Support and field visit

First remote onboarding (template + WhatsApp) is inside **29**. Later **on-site visit = 19 AZN** one-shot (palette), not a subscription module. Menu typing for the customer is a paid visit, not infinite chat.

### 10. Sell motion

**No free customer pilot.** Direct paid sale. Internal lab UAT still required before claiming UI SHOW / GA. Edition stays `mvp` until Product-Readiness Pilot field is real — paid customers are not a licence to write `ga`.

### 11. Menu constructor + Excel exit

- **Export:** Excel of menu, tables, shifts, and **price history** (owner exit / accountant). Current price alone is not enough.
- **Entry:** not free-text as the primary control. Autocomplete from a **canonical az dish lexicon** (`CatalogFieldKind.SEARCHABLE`). Normalize on blur: `doner` / `donar` / `döner` / `шаурма` → **Dönər**. New names allowed with explicit «yeni məhsul».
- Format **templates** (dönər, çayxana, kabab, xəngəl, pivəxana, …) are a follow-up pack; this ADR only requires the constructor rules and Excel. Prices in templates are starter AZN, editable.

### 16. Selling-price history from day one (mandatory)

Do **not** ship Kafe with a single mutable `MenuItem.priceAzn` and no journal. Later NAS / food-cost / «what did dönər cost in March» cannot be reconstructed from tickets alone if catalog overwrites are lost, and tickets do not explain *why* the list price moved.

Two layers, both v1 (already in `era-fnb-pos`; Kafe shell must **keep** them, not hide with hotel chrome):

| Layer | Where | Rule |
|-------|--------|------|
| **Catalog journal** | `MenuItemPrice` (`effectiveFrom` / `effectiveTo`, amount, optional reason, `createdBy`) | Every create (template, autocomplete, Excel import) writes the first open row. Every price change **closes** the previous row and opens a new one. No silent overwrite. Owner UI: existing `/admin/menu` history modal. |
| **Sale snapshot** | `TicketLine.unitPriceAzn` | Line stores the price at tap. Z and Excel of sales use the snapshot, not «today’s list price». |

QR and POS always read the **open** catalog row for the outlet. Stop-list (`bitdi`) does not create a price row. Branch copy of menu copies **current** price and starts a new journal on the new outlet items (do not share `menuItemId` across outlets).

Forbidden: Kafe v1 that updates `priceAzn` in place without `MenuItemPrice`. Forbidden: dropping history from Excel export.

### 12. KKM and guest acquiring

v1 storefront: ERA does not sell KKM or bank hardware; Kafe records cash vs card as **facts** when the org has no devices. **Do not fork the pay path off `@era/fiscal`.** Empty catalog is allowed; attaching Omnitech / a bank POS later uses the same kit ([era-fiscal-kkm-kit.md](./era-fiscal-kkm-kit.md)).

### 13. How they pay ERA

Subscription collection: **Cib Pay** (to be contracted) plus M10 / card / annual **10×29 = 290 AZN** (two months free). Guest acquiring is not this rail. Do not block engineering on the Cib contract — annual card is enough to sell.

### 14. Hardware

No 58 mm printer in v1. Kitchen = KDS tablet. Receipt = show totals on cashier screen.

### 15. Entitlement to implement (gap vs today)

| Surface | Required key / mode |
|---------|---------------------|
| Queue/tables/pay/shift/menu | `industry_fnb_pos` |
| Waiter device + `/floor` multi-PIN | `fnb_waiter_pin` |
| `/kds` | `fnb_kitchen_kds` |
| Public `/m/{slug}` | `fnb_qr_menu` |
| Room-charge, in-house, banquet, calendar, Nafta import | hotel-mode only |
| GL events | `nas` on |

Rename seed display name of `fnb_waiter_pin` off «room-charge».

## Consequences

- Kafe orgs: Foundation line **0** while `nas` is off; catalog freeze otherwise unchanged (no 9 AZN QR).
- Same binary as hotel F&B; **shell + guards + billing waiver** distinguish editions.
- SHARED pool still **not sellable** ([deployment-topology.md](./deployment-topology.md)); Kafe GTM at 29 AZN will need that pool later — out of this ADR’s v1 POS slice.
- Product-Readiness / `docs/editions/fnb.yaml` stay `mvp` / `pilot_ready: false` until UI/Demo/field columns move; this ADR is not a sell-green.
- F&B PRD v1 out-of-scope (dark kitchen, full iiko clone) remains; Kafe is a **thinner** edition, not a wider one.

## v1 in / out

**In:** identities §2, SKUs §3, outlets §4, bitdi §5, short offline §6, Kafe shell, landing→CP, Excel + autocomplete, **price journal + ticket snapshots §16**, Cib/annual billing rails as they land.

**Out:** stock/BOM, Wolt, modifiers beyond v1 if not needed, split-bill marketing, thermal printers, real NBC KKM, free pilots, banquet SKU, Foundation on the Kafe invoice, workforce seat meters.

## References

- App: `era-fnb-pos` (`/floor`, `/orders`, `/kds`, `/admin/menu` + price history, `/admin/tables`)
- Price journal: `MenuItemPrice` + `TicketLine.unitPriceAzn` (`prisma/schema.prisma`)  
- Gate: `era-fnb-pos/src/lib/fnb-module-gate.ts`  
- Seed SKUs: `era-orchestrator/packages/database/prisma/lib/core/pricing-module-seed.ts`  
- Capacity: `CAPACITY_DRIVERS` in `pricing-catalog-canon.ts`  
- Fiscal kit (not a SKU): [era-fiscal-kkm-kit.md](./era-fiscal-kkm-kit.md)  
- Readiness: `docs/acceptance/Fnb-Product-Readiness-Matrix.md` · `docs/editions/fnb.yaml`
