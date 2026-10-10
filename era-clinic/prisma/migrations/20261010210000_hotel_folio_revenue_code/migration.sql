-- Clinic folio charges send this hotel RevenueCode.code (Nafta live catalog: 23 AMBULATOR).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "hotel_folio_revenue_code" TEXT DEFAULT '23';
UPDATE "Tenant" SET "hotel_folio_revenue_code" = '23' WHERE "hotel_folio_revenue_code" IS NULL;
