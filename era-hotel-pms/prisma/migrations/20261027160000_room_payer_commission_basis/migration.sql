-- Room payer + commission basis (agency stays / sales contracts)

CREATE TYPE "RoomPayer" AS ENUM ('GUEST', 'AGENCY', 'COMPANY');
CREATE TYPE "CommissionBasis" AS ENUM ('GROSS', 'NET');

ALTER TABLE "SalesContract" ADD COLUMN "commissionBasis" "CommissionBasis" NOT NULL DEFAULT 'GROSS';

ALTER TABLE "Reservation" ADD COLUMN "roomPayer" "RoomPayer" NOT NULL DEFAULT 'GUEST';
ALTER TABLE "Reservation" ADD COLUMN "commissionBasis" "CommissionBasis" NOT NULL DEFAULT 'GROSS';

-- Existing stays with a company: company pays the room (matches prior resolveRoutedFolioType default).
UPDATE "Reservation" SET "roomPayer" = 'COMPANY' WHERE "companyId" IS NOT NULL;

CREATE TABLE "ReservationCommercialPeriod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE,
    "roomPayer" "RoomPayer" NOT NULL,
    "commissionBasis" "CommissionBasis" NOT NULL DEFAULT 'GROSS',
    "agencyId" TEXT,
    "companyId" TEXT,
    "salesContractId" TEXT,
    "commissionPercent" DECIMAL(5,2),
    "movePostedNights" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationCommercialPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReservationCommercialPeriod_reservationId_fromDate_idx" ON "ReservationCommercialPeriod"("reservationId", "fromDate");
CREATE INDEX "ReservationCommercialPeriod_organizationId_idx" ON "ReservationCommercialPeriod"("organizationId");

ALTER TABLE "ReservationCommercialPeriod" ADD CONSTRAINT "ReservationCommercialPeriod_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
