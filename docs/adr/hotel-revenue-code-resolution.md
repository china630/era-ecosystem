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

Revenue codes are numeric `BOCC`: business line (1 hotel, 2 clinic, 3 retail, 4 F&B), outlet digit (F&B: 1 Naftani, 2 disco bar, 3 Xudmani; `0` elsewhere), two-digit category. `99` is the discount of that line or outlet; `1098` is city tax. Each code maps through `HotelRevenueGlMapping` to one finance NAS leaf: `601.BB.CCC` for revenue (`601.01` hotel, `601.02` clinic, `601.03` retail, `601.04` F&B) and `521.01` for city tax (no VAT). Several F&B codes can share one leaf (all outlets' food credit `601.04.001`).

The hotel looks codes up in two ways and never by name text:

- **System role.** `RevenueCode.systemRole` (unique per org, list in `src/lib/revenue-code-match.ts`) is the code the hotel posts by itself: room night, board, package, treatment, rate adjustment, early/late, minibar, laundry, transfer, tour, banquet, concierge food, medical, discount, city tax. A missing role refuses the post (`REVENUE_ROLE_MISSING`); there is no silent fallback to the room code. The role is set per code in Settings → Integration → GL.
- **Exact code.** A satellite (clinic, F&B, retail) sends the numeric code; `findRevenueCodeByCode` matches it strictly on active codes.

Elektraweb text codes and the name/token matchers are removed. The Elektraweb importer stays as a one-off migration tool. Nafta data: `era-hotel-pms/scripts/ops/nafta-revenue-codes-2026-10.sql`, `era-finance-core/packages/database/prisma/scripts/ops/nafta-revenue-subaccounts-2026-10.sql`, clinic and F&B `scripts/ops/nafta-revenue-codes-2026-10.sql`.

## Consequences

- A new outlet keeps the schema default `revenueCenterCode = FOOD`; in department mode the hotel refuses it until an admin sets a numeric code.
- Retail stores the category on `ProductCategory`. The product card does not carry a revenue code. Charge uses the category, then the outlet code.
- Clinic charge lookup uses the department (procedures and catalog rows) or the diagnostic modality, then `Tenant.hotelFolioRevenueCode`.
- F&B room charge and reception defer use the menu category, then `Outlet.revenueCenterCode`. A ticket discount is spread across the lines; quantity stays even when the amount is 0.
- A night audit posts one journal. `documentVersion: 2` sends `moneyLines` (gross, VAT rate from the revenue code `taxTag`, city tax rate 0) and `qtyLines` (sku, quantity, warehouse, purpose). Amount 0 is omitted from money and kept on quantity. A house-use offset has stock quantity 0, so the bottle is written off once. VAT is computed on the article total. Deposit cash-in debits cash and credits the deposit; a carry does not post. Quantity debits cost of sales, house use, complimentary, or operating expense. A missing average or a negative balance is journaled as uncosted and posted on a later night. A service recipe is not exploded. Department clinic consumables go to the hotel `InternalConsumption` journal (`POST /api/internal/v1/consumption`) and retry from `consumption_outbox`. A group account (`601.04`) is rejected; a new subaccount must hang off its immediate parent.
- Hotel `StockMovement` is not a stock book. Finance warehouses hold the quantity.
- F&B menu import (`era-fnb-pos/scripts/ops/import-menu-cards.ts`) writes the revenue group onto the category. Laundry and clinic cards are skipped. A portion stores `recipeSku` of the bottle; the pour size stays on the finance recipe.
