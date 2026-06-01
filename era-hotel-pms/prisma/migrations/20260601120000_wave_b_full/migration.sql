-- Wave B: FO parity models

ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "commissionPercent" DECIMAL(5,2);
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "RoomChangeStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED');
CREATE TYPE "LostFoundStatus" AS ENUM ('OPEN', 'RETURNED', 'DISPOSED');

CREATE TABLE "ReservationDailyRate" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "stayDate" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "manualFlag" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ReservationDailyRate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReservationDailyRate_reservationId_stayDate_key" ON "ReservationDailyRate"("reservationId", "stayDate");
CREATE INDEX "ReservationDailyRate_reservationId_idx" ON "ReservationDailyRate"("reservationId");
ALTER TABLE "ReservationDailyRate" ADD CONSTRAINT "ReservationDailyRate_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RoomChangePlan" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromRoomId" TEXT,
    "toRoomId" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "status" "RoomChangeStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomChangePlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoomChangePlan_reservationId_idx" ON "RoomChangePlan"("reservationId");
CREATE INDEX "RoomChangePlan_effectiveAt_idx" ON "RoomChangePlan"("effectiveAt");
ALTER TABLE "RoomChangePlan" ADD CONSTRAINT "RoomChangePlan_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoomChangePlan" ADD CONSTRAINT "RoomChangePlan_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoomChangePlan" ADD CONSTRAINT "RoomChangePlan_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GuestDocument" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestDocument_guestId_idx" ON "GuestDocument"("guestId");
ALTER TABLE "GuestDocument" ADD CONSTRAINT "GuestDocument_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuestContact" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GuestContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestContact_guestId_idx" ON "GuestContact"("guestId");
ALTER TABLE "GuestContact" ADD CONSTRAINT "GuestContact_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GuestAddress" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT,
    "country" TEXT,
    CONSTRAINT "GuestAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "GuestAddress_guestId_idx" ON "GuestAddress"("guestId");
ALTER TABLE "GuestAddress" ADD CONSTRAINT "GuestAddress_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PromotionCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromotionCode_code_key" ON "PromotionCode"("code");

CREATE TABLE "ChildPricingMatrix" (
    "id" TEXT NOT NULL,
    "ageFrom" INTEGER NOT NULL,
    "ageTo" INTEGER NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChildPricingMatrix_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoomClosure" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoomClosure_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoomClosure_roomId_idx" ON "RoomClosure"("roomId");
ALTER TABLE "RoomClosure" ADD CONSTRAINT "RoomClosure_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Housekeeper" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Housekeeper_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Housekeeper_code_key" ON "Housekeeper"("code");

ALTER TABLE "HousekeepingTask" ADD COLUMN IF NOT EXISTS "housekeeperId" TEXT;
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_housekeeperId_fkey" FOREIGN KEY ("housekeeperId") REFERENCES "Housekeeper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MinibarItem" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MinibarItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MinibarItem_code_key" ON "MinibarItem"("code");

CREATE TABLE "MinibarPosting" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "reservationId" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MinibarPosting_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MinibarPosting_roomId_idx" ON "MinibarPosting"("roomId");
ALTER TABLE "MinibarPosting" ADD CONSTRAINT "MinibarPosting_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MinibarPosting" ADD CONSTRAINT "MinibarPosting_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MinibarItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "LostFoundItem" (
    "id" TEXT NOT NULL,
    "foundDate" DATE NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'OPEN',
    "guestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LostFoundItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "LostFoundItem" ADD CONSTRAINT "LostFoundItem_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SpaPlace" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpaPlace_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpaPlace_code_key" ON "SpaPlace"("code");

CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Channel_code_key" ON "Channel"("code");

CREATE TABLE "ChannelRoomMapping" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "otaRoomCode" TEXT NOT NULL,
    CONSTRAINT "ChannelRoomMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelRoomMapping_channelId_roomTypeId_key" ON "ChannelRoomMapping"("channelId", "roomTypeId");
ALTER TABLE "ChannelRoomMapping" ADD CONSTRAINT "ChannelRoomMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelRoomMapping" ADD CONSTRAINT "ChannelRoomMapping_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChannelRateMapping" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "otaRateCode" TEXT NOT NULL,
    CONSTRAINT "ChannelRateMapping_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChannelRateMapping_channelId_ratePlanId_key" ON "ChannelRateMapping"("channelId", "ratePlanId");
ALTER TABLE "ChannelRateMapping" ADD CONSTRAINT "ChannelRateMapping_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelRateMapping" ADD CONSTRAINT "ChannelRateMapping_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
