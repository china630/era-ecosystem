-- Sell seasons. Package and daily cells point at a season; moving the season moves the cells.

CREATE TABLE "PriceSeason" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startsOn" DATE NOT NULL,
  "endsOn" DATE NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceSeason_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PriceSeason_organizationId_code_key" ON "PriceSeason"("organizationId", "code");
CREATE INDEX "PriceSeason_organizationId_idx" ON "PriceSeason"("organizationId");

ALTER TABLE "RatePlanSellVersion" ADD COLUMN "seasonId" TEXT;

ALTER TABLE "RatePlanSellVersion"
  ADD CONSTRAINT "RatePlanSellVersion_seasonId_fkey"
  FOREIGN KEY ("seasonId") REFERENCES "PriceSeason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RatePlanSellVersion_seasonId_idx" ON "RatePlanSellVersion"("seasonId");

-- One high and one low season per org that already has rate plans.
INSERT INTO "PriceSeason" ("id", "organizationId", "code", "name", "startsOn", "endsOn", "sortOrder")
SELECT gen_random_uuid()::text, org."organizationId", 'HIGH', 'High season', DATE '2026-05-01', DATE '2026-10-31', 1
FROM (SELECT DISTINCT "organizationId" FROM "RatePlan") org;

INSERT INTO "PriceSeason" ("id", "organizationId", "code", "name", "startsOn", "endsOn", "sortOrder")
SELECT gen_random_uuid()::text, org."organizationId", 'LOW', 'Low season', DATE '2026-11-01', DATE '2027-04-30', 2
FROM (SELECT DISTINCT "organizationId" FROM "RatePlan") org;

-- Link the loaded matrix windows. The earlier low window (Jan–Apr 2026) stays dated and unlinked.
UPDATE "RatePlanSellVersion" sv
SET "seasonId" = s.id
FROM "PriceSeason" s
WHERE s."organizationId" = sv."organizationId"
  AND s.code = 'HIGH'
  AND sv."effectiveFrom"::date = DATE '2026-05-01'
  AND sv."effectiveTo"::date = DATE '2026-10-31';

UPDATE "RatePlanSellVersion" sv
SET "seasonId" = s.id
FROM "PriceSeason" s
WHERE s."organizationId" = sv."organizationId"
  AND s.code = 'LOW'
  AND sv."effectiveFrom"::date = DATE '2026-11-01'
  AND sv."effectiveTo"::date = DATE '2027-04-30';
