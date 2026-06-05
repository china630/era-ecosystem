-- Service module: extend maintenance work orders + recurring schedules (idempotent)

DO $$ BEGIN
  CREATE TYPE "ServicePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceRequestSource" AS ENUM ('GUEST', 'STAFF', 'RECURRING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceWorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'DATE', 'EVENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MigrationRegistrationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "priority" "ServicePriority" NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "source" "ServiceRequestSource" NOT NULL DEFAULT 'STAFF';
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;
ALTER TABLE "MaintenanceWorkOrder" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "RecurringServiceSchedule" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "cadence" "ServiceCadence" NOT NULL,
    "anchorDate" TIMESTAMP(3),
    "eventKey" TEXT,
    "roomId" TEXT,
    "location" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringServiceSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RecurringServiceSchedule_nextDueAt_idx" ON "RecurringServiceSchedule"("nextDueAt");
CREATE INDEX IF NOT EXISTS "RecurringServiceSchedule_enabled_idx" ON "RecurringServiceSchedule"("enabled");

CREATE TABLE IF NOT EXISTS "MigrationRegistration" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "reservationId" TEXT,
    "status" "MigrationRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" TEXT,
    "submittedAt" TIMESTAMP(3),
    "responseNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MigrationRegistration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MigrationRegistration_guestId_idx" ON "MigrationRegistration"("guestId");
CREATE INDEX IF NOT EXISTS "MigrationRegistration_status_idx" ON "MigrationRegistration"("status");

DO $$ BEGIN
  ALTER TABLE "MigrationRegistration" ADD CONSTRAINT "MigrationRegistration_guestId_fkey"
    FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
