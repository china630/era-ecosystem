ALTER TABLE "RoomType" ADD COLUMN "overbookAllowance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "HotelProfile" ADD COLUMN "houseOverbookAllowance" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "QuotaChangeScope" AS ENUM ('ROOM_TYPE', 'HOUSE');
CREATE TYPE "QuotaChangeField" AS ENUM ('BASE_QUOTA', 'OVERBOOK', 'HOUSE_OVERBOOK');

CREATE TABLE "QuotaChange" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "scope" "QuotaChangeScope" NOT NULL,
  "roomTypeId" TEXT,
  "field" "QuotaChangeField" NOT NULL,
  "oldValue" INTEGER NOT NULL,
  "newValue" INTEGER NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuotaChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QuotaChange_organizationId_createdAt_idx" ON "QuotaChange"("organizationId", "createdAt");
