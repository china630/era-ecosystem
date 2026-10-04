ALTER TABLE "menu_categories" ADD COLUMN "code" TEXT;

UPDATE "menu_categories"
SET "code" = 'C' || substr("id", 1, 8)
WHERE "code" IS NULL OR btrim("code") = '';

ALTER TABLE "menu_categories" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "menu_categories_outlet_id_code_key" ON "menu_categories"("outlet_id", "code");

ALTER TABLE "fnb_org_profiles" ADD COLUMN "business_day_start" TEXT NOT NULL DEFAULT '05:00';
