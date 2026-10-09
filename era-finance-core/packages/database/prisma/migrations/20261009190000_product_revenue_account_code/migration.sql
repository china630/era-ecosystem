-- Sellable SKU carries its NAS revenue account. Ingredients may leave it empty.

ALTER TABLE "products" ADD COLUMN "revenue_account_code" TEXT;
