-- Stage 17: fb-pos bridge (shifts, room-charge idempotency)

CREATE TYPE "PosBridgeShiftStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "PosBridgeShift" (
    "id" TEXT NOT NULL,
    "externalShiftId" TEXT NOT NULL,
    "outletCode" TEXT NOT NULL,
    "propertyCode" TEXT,
    "status" "PosBridgeShiftStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PosBridgeShift_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosBridgeShift_outletCode_externalShiftId_key" ON "PosBridgeShift"("outletCode", "externalShiftId");
CREATE INDEX "PosBridgeShift_status_idx" ON "PosBridgeShift"("status");

CREATE TABLE "PosRoomChargeIdempotency" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "folioChargeId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosRoomChargeIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosRoomChargeIdempotency_idempotencyKey_key" ON "PosRoomChargeIdempotency"("idempotencyKey");
CREATE UNIQUE INDEX "PosRoomChargeIdempotency_folioChargeId_key" ON "PosRoomChargeIdempotency"("folioChargeId");
CREATE INDEX "PosRoomChargeIdempotency_reservationId_idx" ON "PosRoomChargeIdempotency"("reservationId");
