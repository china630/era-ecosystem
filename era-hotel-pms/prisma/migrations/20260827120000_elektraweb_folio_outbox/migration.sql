-- Dual-run SPA extra outbox + stay-guest RESNAMEID on Reservation
ALTER TABLE "Reservation" ADD COLUMN "elektrawebResNameId" TEXT;
CREATE INDEX "Reservation_elektrawebResNameId_idx" ON "Reservation"("elektrawebResNameId");

CREATE TYPE "ElektrawebOutboxSource" AS ENUM ('CLINIC', 'FNB');
CREATE TYPE "ElektrawebOutboxStatus" AS ENUM ('PENDING', 'SENDING', 'POSTED', 'FAILED', 'CANCELLED');

CREATE TABLE "ElektrawebFolioOutbox" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "source" "ElektrawebOutboxSource" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "patientOrigin" TEXT NOT NULL,
    "reservationId" TEXT,
    "elektrawebResNameId" TEXT NOT NULL,
    "elektrawebResId" TEXT,
    "elektrawebRevId" TEXT NOT NULL,
    "procedureCode" TEXT,
    "procedureName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "insertPayload" JSONB NOT NULL,
    "status" "ElektrawebOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "elektrawebLineId" TEXT,
    "lastError" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElektrawebFolioOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ElektrawebFolioOutbox_organizationId_idempotencyKey_key" ON "ElektrawebFolioOutbox"("organizationId", "idempotencyKey");
CREATE INDEX "ElektrawebFolioOutbox_organizationId_status_createdAt_idx" ON "ElektrawebFolioOutbox"("organizationId", "status", "createdAt");
