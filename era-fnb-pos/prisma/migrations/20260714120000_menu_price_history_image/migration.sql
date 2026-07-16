-- Wave 2: selling price history · Wave 5: optional dish image URL
ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "image_url" TEXT;

CREATE TABLE IF NOT EXISTS "menu_item_prices" (
    "id" TEXT NOT NULL,
    "menu_item_id" TEXT NOT NULL,
    "price_azn" DECIMAL(12,2) NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "menu_item_prices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "menu_item_prices_menu_item_id_effective_from_idx"
  ON "menu_item_prices"("menu_item_id", "effective_from");

DO $$ BEGIN
  ALTER TABLE "menu_item_prices"
    ADD CONSTRAINT "menu_item_prices_menu_item_id_fkey"
    FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill one open price row per existing menu item
INSERT INTO "menu_item_prices" ("id", "menu_item_id", "price_azn", "effective_from", "created_at")
SELECT
  'mip_' || replace(gen_random_uuid()::text, '-', ''),
  mi.id,
  mi.price_azn,
  NOW(),
  NOW()
FROM "menu_items" mi
WHERE NOT EXISTS (
  SELECT 1 FROM "menu_item_prices" p WHERE p.menu_item_id = mi.id
);
