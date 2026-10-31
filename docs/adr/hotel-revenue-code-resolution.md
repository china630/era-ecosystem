# ADR: Hotel revenue code resolution

**Status:** Accepted  
**Date:** 2026-10-15

## Decision

Clinic, F&B, and retail post a hotel folio line with one resolution order:

1. The category (clinic department or diagnostic modality, menu category, retail product category).
2. Otherwise the satellite default (clinic tenant, F&B outlet revenue center, retail outlet).

Both empty refuses the post. The category is read at charge time. A code stored on the dish, procedure, diagnostic service, catalog row, or retail product is not read and is not copied onto a new card.

The picker is `GET /api/admin/hotel-revenue-codes` on the satellite that owns the card. The door is the shared rule in `packages/satellite-kit/src/integration/hotel-revenue-route.ts`: that exact path requires `api:hotel.revenue_codes`. A blanket `/api/admin/**` grant does not open it. The handler does not choose a different key.

`listHotelRevenueCodes` returns active codes, or throws when the hotel organization, service token, or hotel call fails. An empty active catalog is `{ "codes": [] }`, not a swallowed error.

System roles `CLINIC_ADMIN`, `FB_MANAGER`, and `OUTLET_ADMIN` receive `api:hotel.revenue_codes` on the next role ensure when their stored list is non-empty and missing the key. Any other customized role does not, until an admin grants it or resets the role. The signed session picks the new key up after the next login.

## Code numbering and system roles

Revenue codes are numeric by business line (1 hotel, 2 clinic, 3 retail, 4 F&B). Discount suffixes use `99` / `1099` / `2099` / `3099` / `4007`; `1098` is city tax. Each code maps through `HotelRevenueGlMapping` to one finance NAS leaf: `601.BB.CCC` (`601.01` hotel, `601.02` clinic, `601.03` retail, `601.04` F&B) and `521.01` for city tax. F&B uses **one code per category** (4001–4007); outlet is analytics on the posting, not a separate revenue code. Several outlets share one leaf (all food credits `601.04.001`).

**Property template:** the platform keeps a full `REVENUE_CODE_ROLES` list (including `BOARD`, `TELECOM`, `RESORT_FEE` for leisure hotels). A Nafta edition activates only the Nafta subset — no BOARD/TREATMENT in-rate splits on the guest folio, no clinic inpatient/sanatorium program codes.

**Nafta lodging law:** medical / PKG-* nights post **PKG** only; BAR / leisure nights post **ROOM** only. Package component lines are not separate guest-folio articles. Manual Extra charge uses `allowManualCharge`; Accept payment uses `allowManualPayment` (ROOM/PKG/CITY_TAX are pay-yes / charge-no).

The hotel looks codes up in two ways and never by name text:

- **System role.** `RevenueCode.systemRole` (unique per org, list in `src/lib/revenue-code-match.ts`). A missing role refuses the post (`REVENUE_ROLE_MISSING`). Clinic a-la-carte uses `PROCEDURE` (not `MEDICAL`). F&B category roles: `FOOD`, `BEVERAGE`, `ALCOHOL`, `TOBACCO`, `HALL`, `ENTERTAINMENT`, `FB_DISCOUNT`.
- **Exact code.** A satellite sends the numeric code; `findRevenueCodeByCode` matches active codes.

The one-shot Nafta densify scripts are gone. Live revenue codes and their NAS accounts stay on the hotel revenue-code screen. Finance keeps the leaf that code already points at.

Elektraweb text codes and name/token matchers stay import-only.

## Consequences

- A new outlet keeps the schema default `revenueCenterCode = FOOD`; in department mode the hotel refuses it until an admin sets a numeric code.
- Retail stores the category on `ProductCategory`. The product card does not carry a revenue code. Charge uses the category, then the outlet code.
- Clinic charge lookup uses the department (procedures and catalog rows) or the diagnostic modality, then `Tenant.hotelFolioRevenueCode`.
- F&B room charge and reception defer use the menu category, then `Outlet.revenueCenterCode`. A ticket discount is spread across the lines; quantity stays even when the amount is 0.
- A night audit posts one journal. `documentVersion: 2` sends `moneyLines` (gross, VAT rate from the revenue code `taxTag`, city tax rate 0) and `qtyLines` (sku, quantity, warehouse, purpose). Amount 0 is omitted from money and kept on quantity. A house-use offset has stock quantity 0, so the bottle is written off once. VAT is computed on the article total. Deposit cash-in debits cash and credits the deposit; a carry does not post. Quantity debits cost of sales, house use, complimentary, or operating expense. A missing average or a negative balance is journaled as uncosted and posted on a later night. A service recipe is not exploded. Department clinic consumables go to the hotel `InternalConsumption` journal (`POST /api/internal/v1/consumption`) and retry from `consumption_outbox`. A group account (`601.04`) is rejected; a new subaccount must hang off its immediate parent.
- Hotel `StockMovement` is not a stock book. Finance warehouses hold the quantity.
- F&B menu import (`era-fnb-pos/scripts/ops/import-menu-cards.ts`) writes the revenue group onto the category. Laundry and clinic cards are skipped. A portion stores `recipeSku` of the bottle; the pour size stays on the finance recipe.
