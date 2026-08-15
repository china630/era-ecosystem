-- CreateEnum (idempotent: type may already exist from partial apply)
DO $$ BEGIN
  CREATE TYPE "HotelLookupKind" AS ENUM (
    'MARKET',
    'SEGMENT',
    'VIP_TYPE',
    'LOYALTY_TIER',
    'VISA_TYPE',
    'TITLE',
    'GENDER',
    'MARITAL_STATUS',
    'TRIP_REASON',
    'ACCOM_TYPE',
    'RECORD_TYPE',
    'SPECIAL_STATE',
    'VERIFICATION_STATUS'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "HotelLookup" (
    "id" TEXT NOT NULL,
    "kind" "HotelLookupKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelLookup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HotelLookup_kind_code_key" ON "HotelLookup"("kind", "code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HotelLookup_kind_active_sortOrder_idx" ON "HotelLookup"("kind", "active", "sortOrder");
