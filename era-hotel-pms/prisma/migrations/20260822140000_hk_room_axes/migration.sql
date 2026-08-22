-- Wave 0: HK cleanliness + inventory axes (ADR hotel-housekeeping-nafta-ops)

CREATE TYPE "RoomHkCondition" AS ENUM ('DIRTY', 'PICKUP', 'CLEAN', 'INSPECTED');
CREATE TYPE "RoomInventoryStatus" AS ENUM ('IN_SERVICE', 'OOS', 'OOO');
CREATE TYPE "HkJobType" AS ENUM ('DEPARTURE', 'STAYOVER', 'ARRIVAL_PREP', 'NSR', 'OTHER');
CREATE TYPE "HkVisitOutcome" AS ENUM ('V', 'VC', 'OK', 'REFUSED', 'DND', 'SO');
CREATE TYPE "HkDepartment" AS ENUM ('ROOMS', 'PUBLIC_AREA', 'LAUNDRY');
CREATE TYPE "HkRosterCellKind" AS ENUM ('E', 'L', 'N', 'OFF', 'EG', 'CUSTOM');

ALTER TABLE "Room" ADD COLUMN "hkCondition" "RoomHkCondition" NOT NULL DEFAULT 'CLEAN';
ALTER TABLE "Room" ADD COLUMN "inventoryStatus" "RoomInventoryStatus" NOT NULL DEFAULT 'IN_SERVICE';
ALTER TABLE "Room" ADD COLUMN "inventoryReason" TEXT;

UPDATE "Room" SET
  "inventoryStatus" = CASE
    WHEN "status" = 'OOO' THEN 'OOO'::"RoomInventoryStatus"
    WHEN "status" IN ('OOS', 'MAINTENANCE') THEN 'OOS'::"RoomInventoryStatus"
    ELSE 'IN_SERVICE'::"RoomInventoryStatus"
  END,
  "hkCondition" = CASE
    WHEN "status" = 'DIRTY' THEN 'DIRTY'::"RoomHkCondition"
    WHEN "status" = 'INSPECTED' THEN 'INSPECTED'::"RoomHkCondition"
    WHEN "status" IN ('OOO', 'OOS', 'MAINTENANCE') THEN 'DIRTY'::"RoomHkCondition"
    ELSE 'CLEAN'::"RoomHkCondition"
  END,
  "inventoryReason" = CASE WHEN "status" = 'MAINTENANCE' THEN 'MAINTENANCE' ELSE "inventoryReason" END;

ALTER TABLE "HousekeepingTask" ADD COLUMN "businessDate" DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE "HousekeepingTask" ADD COLUMN "jobType" "HkJobType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "HousekeepingTask" ADD COLUMN "visitOutcome" "HkVisitOutcome";
ALTER TABLE "HousekeepingTask" ADD COLUMN "neededByAt" TIMESTAMP(3);

CREATE INDEX "HousekeepingTask_organizationId_businessDate_idx" ON "HousekeepingTask"("organizationId", "businessDate");
