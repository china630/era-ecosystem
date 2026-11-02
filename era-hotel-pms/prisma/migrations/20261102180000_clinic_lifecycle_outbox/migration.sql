CREATE TABLE "clinic_lifecycle_outbox" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "paxKey" TEXT NOT NULL DEFAULT '',
  "correlationId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "ackedAt" TIMESTAMP(3),
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_lifecycle_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinic_lifecycle_outbox_organizationId_dedupeKey_key"
  ON "clinic_lifecycle_outbox"("organizationId", "dedupeKey");

CREATE INDEX "clinic_lifecycle_outbox_ackedAt_nextAttemptAt_idx"
  ON "clinic_lifecycle_outbox"("ackedAt", "nextAttemptAt");
