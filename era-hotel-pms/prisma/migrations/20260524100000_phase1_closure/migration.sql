-- AlterEnum
ALTER TYPE "OutboundEventStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "HotelProfile" ADD COLUMN "integrationSettingsJson" TEXT;

-- CreateTable
CREATE TABLE "ChannelStopSell" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "roomTypeId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelStopSell_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelStopSell_date_roomTypeId_key" ON "ChannelStopSell"("date", "roomTypeId");

-- AddForeignKey
ALTER TABLE "ChannelStopSell" ADD CONSTRAINT "ChannelStopSell_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
