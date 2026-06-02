-- Wave E: reservation CSV fields, daily rate columns, attachments, folio charge cols, pax fields

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "preferredLocation" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "preferredBed" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "givenRoomTypeId" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "contractRef" TEXT;

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_givenRoomTypeId_fkey"
  FOREIGN KEY ("givenRoomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Reservation_givenRoomTypeId_idx" ON "Reservation"("givenRoomTypeId");

ALTER TABLE "ReservationDailyRate" ADD COLUMN IF NOT EXISTS "currencyCode" TEXT NOT NULL DEFAULT 'AZN';
ALTER TABLE "ReservationDailyRate" ADD COLUMN IF NOT EXISTS "fixPrice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ReservationDailyRate" ADD COLUMN IF NOT EXISTS "discountPct" DECIMAL(5,2);

CREATE TABLE IF NOT EXISTS "ReservationAttachment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ReservationAttachment_reservationId_idx" ON "ReservationAttachment"("reservationId");
ALTER TABLE "ReservationAttachment" ADD CONSTRAINT "ReservationAttachment_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReservationGuest" ADD COLUMN IF NOT EXISTS "memberNo" TEXT;
ALTER TABLE "ReservationGuest" ADD COLUMN IF NOT EXISTS "payStatus" TEXT;
ALTER TABLE "ReservationGuest" ADD COLUMN IF NOT EXISTS "externalResId" TEXT;
ALTER TABLE "ReservationGuest" ADD COLUMN IF NOT EXISTS "guestState" TEXT;

ALTER TABLE "FolioCharge" ADD COLUMN IF NOT EXISTS "paxNo" INTEGER;
ALTER TABLE "FolioCharge" ADD COLUMN IF NOT EXISTS "invoiceRef" TEXT;
