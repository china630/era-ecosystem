-- Outlet operational capabilities + kill inventing RESTAURANT (app-side).
-- shape_hint: cafe | restaurant | buffet_kitchen | disco | null

ALTER TABLE "outlets"
  ADD COLUMN IF NOT EXISTS "cap_till" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cap_tables" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cap_buffet_planner" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "shape_hint" TEXT;

-- Nafta-ish codes: buffet-capable Naftani; café Xudmani without buffet by default
UPDATE "outlets" SET "cap_buffet_planner" = true, "shape_hint" = 'restaurant'
 WHERE "code" IN ('NAFTANI', 'RESTAURANT') AND ("shape_hint" IS NULL OR "shape_hint" = '');

UPDATE "outlets" SET "cap_buffet_planner" = false, "shape_hint" = 'cafe'
 WHERE "code" IN ('XUDMANI', 'KAFE', 'HOODMANI', 'HUDMANI') AND ("shape_hint" IS NULL OR "shape_hint" = '');

UPDATE "outlets" SET "cap_till" = false, "cap_tables" = false, "cap_buffet_planner" = true, "shape_hint" = 'buffet_kitchen'
 WHERE "code" = 'BUFFET' AND ("shape_hint" IS NULL OR "shape_hint" = '');
