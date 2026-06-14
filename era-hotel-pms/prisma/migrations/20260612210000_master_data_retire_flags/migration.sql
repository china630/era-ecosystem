-- Retire flags for master dictionaries (no hard delete policy)

ALTER TABLE "RevenueCode" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "BedType" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RoomView" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RoomType" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "RevenueCode_active_idx" ON "RevenueCode"("active");
CREATE INDEX "BedType_active_idx" ON "BedType"("active");
CREATE INDEX "RoomView_active_idx" ON "RoomView"("active");
CREATE INDEX "RoomType_active_idx" ON "RoomType"("active");
CREATE INDEX "Room_deleted_disabled_idx" ON "Room"("deleted", "disabled");
