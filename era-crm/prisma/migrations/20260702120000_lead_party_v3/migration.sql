-- CRM v3.0: party model + import batch

DO $PartyKind$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PartyKind') THEN
    CREATE TYPE "PartyKind" AS ENUM ('INDIVIDUAL', 'LEGAL_ENTITY');
  END IF;
END $PartyKind$;

DO $ProspectType$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProspectType') THEN
    CREATE TYPE "ProspectType" AS ENUM ('CUSTOMER', 'PARTNER', 'OTHER');
  END IF;
END $ProspectType$;

DO $ImportBatchStatus$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImportBatchStatus') THEN
    CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
  END IF;
END $ImportBatchStatus$;

CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "createdBy" TEXT,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
  "reportJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "partyKind" "PartyKind" NOT NULL DEFAULT 'LEGAL_ENTITY';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "taxId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "companyName" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "globalPersonId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "activitySector" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "prospectType" "ProspectType" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "addressLabel" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;

CREATE INDEX IF NOT EXISTS "Lead_taxId_idx" ON "Lead"("taxId");
CREATE INDEX IF NOT EXISTS "Lead_prospectType_idx" ON "Lead"("prospectType");
CREATE INDEX IF NOT EXISTS "Lead_importBatchId_idx" ON "Lead"("importBatchId");
CREATE INDEX IF NOT EXISTS "Lead_contactPhone_idx" ON "Lead"("contactPhone");

DO $fk$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Lead_importBatchId_fkey'
  ) THEN
    ALTER TABLE "Lead"
      ADD CONSTRAINT "Lead_importBatchId_fkey"
      FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $fk$;
