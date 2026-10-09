-- Sellable Finance SKU. recipe_sku stays the local recipe identity.

ALTER TABLE "menu_items" ADD COLUMN "finance_sku" TEXT;
