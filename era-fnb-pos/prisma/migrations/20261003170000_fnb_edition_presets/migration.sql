-- Edition, preset, and hotel mode become three separate fields.
ALTER TABLE "fnb_org_profiles" ADD COLUMN "enabled_presets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Street café: edition kafe or hotel mode already off.
UPDATE "fnb_org_profiles"
SET "edition" = 'kafe',
    "hotel_mode" = false,
    "enabled_presets" = ARRAY['cafe']::TEXT[]
WHERE lower(btrim("edition")) = 'kafe' OR "hotel_mode" = false;

-- Everyone else is full F&B with the restaurant hall; hotel mode stays as it was.
UPDATE "fnb_org_profiles"
SET "edition" = 'fnb',
    "enabled_presets" = ARRAY['restaurant']::TEXT[]
WHERE lower(btrim("edition")) <> 'kafe';

ALTER TABLE "fnb_org_profiles" ALTER COLUMN "edition" SET DEFAULT 'fnb';
