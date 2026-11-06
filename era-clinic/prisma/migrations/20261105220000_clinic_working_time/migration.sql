-- Short-day start hour (Saturday / country shortened use short hours).
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "shortened_day_start_hour" INTEGER NOT NULL DEFAULT 9;

-- Procedure / resource peak start (optional earlier open).
ALTER TABLE "ProcedureType" ADD COLUMN IF NOT EXISTS "extended_start_hour" INTEGER;
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "extended_start_hour" INTEGER;

-- Clinic day override: kind + start hour.
DO $$ BEGIN
  CREATE TYPE "ClinicDayKind" AS ENUM ('WORKING', 'SHORT', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "clinic_day_override" ADD COLUMN IF NOT EXISTS "day_kind" "ClinicDayKind";
ALTER TABLE "clinic_day_override" ADD COLUMN IF NOT EXISTS "start_hour" INTEGER;

UPDATE "clinic_day_override"
SET "day_kind" = CASE WHEN "closed" THEN 'CLOSED'::"ClinicDayKind" ELSE 'WORKING'::"ClinicDayKind" END
WHERE "day_kind" IS NULL;

ALTER TABLE "clinic_day_override" ALTER COLUMN "day_kind" SET DEFAULT 'WORKING'::"ClinicDayKind";
ALTER TABLE "clinic_day_override" ALTER COLUMN "day_kind" SET NOT NULL;

-- Peak journal.
DO $$ BEGIN
  CREATE TYPE "PeakDayKind" AS ENUM ('WORKING', 'SHORT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PeakScope" AS ENUM ('OWN_ONLY', 'EMPTY_DEFAULT', 'CLINIC_WIDE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "clinic_peak_rule" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "from_ymd" TEXT NOT NULL,
  "to_ymd" TEXT NOT NULL,
  "day_kind" "PeakDayKind" NOT NULL,
  "scope" "PeakScope" NOT NULL,
  "start_hour" INTEGER,
  "end_hour" INTEGER,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clinic_peak_rule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "clinic_peak_rule_organizationId_from_ymd_to_ymd_idx"
  ON "clinic_peak_rule"("organizationId", "from_ymd", "to_ymd");
CREATE INDEX IF NOT EXISTS "clinic_peak_rule_organizationId_day_kind_idx"
  ON "clinic_peak_rule"("organizationId", "day_kind");
