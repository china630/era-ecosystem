-- Revenue article on each clinical service. Drop the hardcoded folio fallback 23.
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "hotel_revenue_code" TEXT;
ALTER TABLE "DiagnosticService" ADD COLUMN IF NOT EXISTS "hotel_revenue_code" TEXT;
ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "hotel_revenue_code" TEXT;

ALTER TABLE "Tenant" ALTER COLUMN "hotel_folio_revenue_code" DROP DEFAULT;
UPDATE "Tenant" SET "hotel_folio_revenue_code" = NULL WHERE "hotel_folio_revenue_code" = '23';
