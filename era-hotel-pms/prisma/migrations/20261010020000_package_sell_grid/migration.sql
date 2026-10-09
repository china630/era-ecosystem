-- Sellable adult ceiling stays on adultCapacity. standardAdults keeps the made-up bed count.
ALTER TABLE "RoomType" ADD COLUMN "standardAdults" INTEGER NOT NULL DEFAULT 2;

-- Existing adultCapacity was both bedding and ceiling. Copy it before raising standard.
UPDATE "RoomType" SET "standardAdults" = "adultCapacity";

-- Standard sheet has a third adult price. Do not raise triple, junior, or deluxe.
UPDATE "RoomType"
SET "adultCapacity" = 3
WHERE "adultCapacity" < 3
  AND (
    upper("code") IN ('STWN', 'SDBL', 'STD', 'STANDARD', 'STANDART')
  )
  AND upper("code") NOT LIKE '%TRIP%'
  AND upper("code") NOT LIKE '%STRP%'
  AND upper("code") NOT LIKE '%DLX%'
  AND upper("code") NOT LIKE '%JSUIT%'
  AND upper("code") NOT LIKE '%SUITE%';

ALTER TABLE "RatePlanSellVersion" ADD COLUMN "roomTypeId" TEXT;
ALTER TABLE "RatePlanSellVersion" ADD COLUMN "mealPlanId" TEXT;

ALTER TABLE "RatePlanSellVersion"
  ADD CONSTRAINT "RatePlanSellVersion_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RatePlanSellVersion"
  ADD CONSTRAINT "RatePlanSellVersion_mealPlanId_fkey"
  FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "RatePlanSellVersion_ratePlanId_roomTypeId_mealPlanId_occupancy_effectiveFrom_key"
  ON "RatePlanSellVersion"("ratePlanId", "roomTypeId", "mealPlanId", "occupancy", "effectiveFrom");

CREATE INDEX "RatePlanSellVersion_roomTypeId_idx" ON "RatePlanSellVersion"("roomTypeId");
CREATE INDEX "RatePlanSellVersion_mealPlanId_idx" ON "RatePlanSellVersion"("mealPlanId");
