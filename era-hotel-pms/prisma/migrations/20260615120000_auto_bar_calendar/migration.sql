-- Auto-BAR production calendar integration (M24)
CREATE TYPE "RoomTypeRateSource" AS ENUM ('AUTO', 'MANUAL');

ALTER TABLE "RoomTypeRate"
  ADD COLUMN "source" "RoomTypeRateSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "locked_at" TIMESTAMP(3);
