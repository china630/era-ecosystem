CREATE TABLE IF NOT EXISTS "GuestDedupDismissal" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "guestIdLow" TEXT NOT NULL,
    "guestIdHigh" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestDedupDismissal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuestDedupDismissal_organizationId_guestIdLow_guestIdHigh_key"
  ON "GuestDedupDismissal"("organizationId", "guestIdLow", "guestIdHigh");

CREATE INDEX IF NOT EXISTS "GuestDedupDismissal_organizationId_idx"
  ON "GuestDedupDismissal"("organizationId");
