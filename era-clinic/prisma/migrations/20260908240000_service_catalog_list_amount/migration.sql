-- W3: retail list price on service catalog (package amount may stay 0)
ALTER TABLE "ServiceCatalogCache" ADD COLUMN IF NOT EXISTS "list_amount" DECIMAL(12,2);
