-- Kafe / SHARED per-org profile, stop-list, PIN role, public QR slug
ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "public_slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "outlets_public_slug_key"
  ON "outlets" ("public_slug");

CREATE TABLE IF NOT EXISTS "menu_item_sold_out" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "menu_item_id" TEXT NOT NULL,
  "outlet_id" TEXT NOT NULL,
  "sold_out" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "menu_item_sold_out_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "menu_item_sold_out_org_item_outlet_key"
  ON "menu_item_sold_out" ("organization_id", "menu_item_id", "outlet_id");
CREATE INDEX IF NOT EXISTS "menu_item_sold_out_organization_id_idx"
  ON "menu_item_sold_out" ("organization_id");
ALTER TABLE "menu_item_sold_out"
  ADD CONSTRAINT "menu_item_sold_out_menu_item_id_fkey"
  FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "menu_item_sold_out"
  ADD CONSTRAINT "menu_item_sold_out_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "fnb_org_profiles" (
  "organization_id" TEXT NOT NULL,
  "edition" TEXT NOT NULL DEFAULT 'hotel',
  "hotel_mode" BOOLEAN NOT NULL DEFAULT true,
  "waiter_pin_packs" INTEGER NOT NULL DEFAULT 1,
  "active_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fnb_org_profiles_pkey" PRIMARY KEY ("organization_id")
);

ALTER TABLE "staff_rosters" ADD COLUMN IF NOT EXISTS "pin_role" TEXT NOT NULL DEFAULT 'CASHIER';
ALTER TABLE "staff_rosters" ADD COLUMN IF NOT EXISTS "outlet_id" TEXT;
ALTER TABLE "staff_rosters"
  ADD CONSTRAINT "staff_rosters_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
