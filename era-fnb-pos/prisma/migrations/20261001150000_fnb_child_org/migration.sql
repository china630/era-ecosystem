-- F&B child/line organizationId. Column name matches hotel ("organizationId").
-- Backfill from the parent row (parents still use organization_id); fail if any row stays null.

ALTER TABLE "ticket_lines" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ticket_lines" AS c
SET "organizationId" = p."organization_id"
FROM "tickets" AS p
WHERE c."ticket_id" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ticket_lines" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ticket_lines: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ticket_lines" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ticket_lines_organizationId_idx" ON "ticket_lines"("organizationId");


ALTER TABLE "menu_item_prices" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "menu_item_prices" AS c
SET "organizationId" = p."organization_id"
FROM "menu_items" AS p
WHERE c."menu_item_id" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "menu_item_prices" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'menu_item_prices: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "menu_item_prices" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "menu_item_prices_organizationId_idx" ON "menu_item_prices"("organizationId");


ALTER TABLE "daily_menu_entries" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "daily_menu_entries" AS c
SET "organizationId" = p."organization_id"
FROM "outlets" AS p
WHERE c."outlet_id" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "daily_menu_entries" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'daily_menu_entries: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "daily_menu_entries" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "daily_menu_entries_organizationId_idx" ON "daily_menu_entries"("organizationId");
