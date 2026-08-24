ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "discountPercent" DECIMAL(5,2);

DO $$ BEGIN
  CREATE TYPE "RoomChangeKind" AS ENUM ('OCCURRED', 'SCHEDULED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "RoomChangePlan" ADD COLUMN IF NOT EXISTS "kind" "RoomChangeKind" NOT NULL DEFAULT 'OCCURRED';
ALTER TABLE "RoomChangePlan" ADD COLUMN IF NOT EXISTS "reasonCode" TEXT;
ALTER TABLE "RoomChangePlan" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
ALTER TABLE "RoomChangePlan" ALTER COLUMN "status" SET DEFAULT 'APPLIED';

CREATE TABLE IF NOT EXISTS "ReservationStaySlice" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationStaySlice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReservationStaySlice_reservationId_fromDate_idx"
  ON "ReservationStaySlice"("reservationId", "fromDate");

DO $$ BEGIN
  ALTER TABLE "ReservationStaySlice" ADD CONSTRAINT "ReservationStaySlice_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ReservationStaySlice" ADD CONSTRAINT "ReservationStaySlice_roomTypeId_fkey"
    FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ReservationStaySlice" ADD CONSTRAINT "ReservationStaySlice_ratePlanId_fkey"
    FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "ReservationStaySlice" ("id", "reservationId", "fromDate", "toDate", "roomTypeId", "ratePlanId")
SELECT r."id" || '-slice0', r."id", r."checkInDate"::date, r."checkOutDate"::date, r."roomTypeId", r."ratePlanId"
FROM "Reservation" r
WHERE NOT EXISTS (
  SELECT 1 FROM "ReservationStaySlice" s WHERE s."reservationId" = r."id"
);
