-- Evrostar Wave 9: floor board - place geofence, punch review, correction journal

DO $$ BEGIN
  CREATE TYPE "WorkforceAttendanceReviewStatus" AS ENUM ('CLEAR', 'SUSPICIOUS', 'ACCEPTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkforceAttendanceReviewReason" AS ENUM ('OUTSIDE_RADIUS', 'OUTSIDE_WINDOW', 'MULTI_PLACE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkforceAttendanceJournalAction" AS ENUM ('ACCEPT', 'NOTE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workforce_places"
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "radius_meters" INTEGER,
  ADD COLUMN IF NOT EXISTS "allow_outside" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "grace_minutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "workforce_attendance_punches"
  ADD COLUMN IF NOT EXISTS "review_status" "WorkforceAttendanceReviewStatus" NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN IF NOT EXISTS "review_reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7);

CREATE INDEX IF NOT EXISTS "workforce_attendance_punches_organization_id_review_status_idx"
  ON "workforce_attendance_punches"("organization_id", "review_status");

CREATE TABLE IF NOT EXISTS "workforce_attendance_punch_journals" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "punch_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" "WorkforceAttendanceJournalAction" NOT NULL,
    "reason" VARCHAR(512) NOT NULL,
    "before_json" JSONB,
    "after_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workforce_attendance_punch_journals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workforce_attendance_punch_journals_org_punch_created_idx"
  ON "workforce_attendance_punch_journals"("organization_id", "punch_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_punch_journals"
    ADD CONSTRAINT "workforce_attendance_punch_journals_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_punch_journals"
    ADD CONSTRAINT "workforce_attendance_punch_journals_punch_id_fkey"
    FOREIGN KEY ("punch_id") REFERENCES "workforce_attendance_punches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
