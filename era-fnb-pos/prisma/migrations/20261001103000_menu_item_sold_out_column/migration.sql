ALTER TABLE "menu_item_sold_out"
  ADD COLUMN IF NOT EXISTS "sold_out" BOOLEAN NOT NULL DEFAULT true;
