-- Evrostar Wave 6: attendance devices, identity map, immutable punches

CREATE TYPE "WorkforceAttendanceDeviceStatus" AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE "WorkforceAttendanceDirection" AS ENUM ('IN', 'OUT');
CREATE TYPE "WorkforceAttendancePunchStatus" AS ENUM ('UNMAPPED', 'MAPPED', 'OPEN', 'PAIRED', 'REJECTED');

CREATE TABLE IF NOT EXISTS "workforce_attendance_devices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "place_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "code" VARCHAR(64),
    "token_hash" VARCHAR(128) NOT NULL,
    "hmac_secret_hash" VARCHAR(128),
    "status" "WorkforceAttendanceDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workforce_attendance_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_attendance_devices_organization_id_token_hash_key"
  ON "workforce_attendance_devices"("organization_id", "token_hash");
CREATE INDEX IF NOT EXISTS "workforce_attendance_devices_organization_id_status_idx"
  ON "workforce_attendance_devices"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "workforce_attendance_devices_place_id_idx"
  ON "workforce_attendance_devices"("place_id");

CREATE TABLE IF NOT EXISTS "workforce_attendance_identities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "person_ref" VARCHAR(128) NOT NULL,
    "employment_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workforce_attendance_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_attendance_identities_organization_id_person_ref_key"
  ON "workforce_attendance_identities"("organization_id", "person_ref");
CREATE INDEX IF NOT EXISTS "workforce_attendance_identities_organization_id_employment_id_idx"
  ON "workforce_attendance_identities"("organization_id", "employment_id");

CREATE TABLE IF NOT EXISTS "workforce_attendance_punches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "place_id" UUID NOT NULL,
    "employment_id" UUID,
    "person_ref" VARCHAR(128) NOT NULL,
    "direction" "WorkforceAttendanceDirection" NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "external_id" VARCHAR(128),
    "status" "WorkforceAttendancePunchStatus" NOT NULL DEFAULT 'UNMAPPED',
    "place_mismatch" BOOLEAN NOT NULL DEFAULT false,
    "pair_id" UUID,
    "hours_attributed" DECIMAL(10,2),
    "work_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workforce_attendance_punches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_attendance_punches_device_id_external_id_key"
  ON "workforce_attendance_punches"("device_id", "external_id");
CREATE INDEX IF NOT EXISTS "workforce_attendance_punches_organization_id_occurred_at_idx"
  ON "workforce_attendance_punches"("organization_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "workforce_attendance_punches_organization_id_status_idx"
  ON "workforce_attendance_punches"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "workforce_attendance_punches_org_emp_occurred_idx"
  ON "workforce_attendance_punches"("organization_id", "employment_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "workforce_attendance_punches_pair_id_idx"
  ON "workforce_attendance_punches"("pair_id");

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_devices"
    ADD CONSTRAINT "workforce_attendance_devices_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_devices"
    ADD CONSTRAINT "workforce_attendance_devices_place_id_fkey"
    FOREIGN KEY ("place_id") REFERENCES "workforce_places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_identities"
    ADD CONSTRAINT "workforce_attendance_identities_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_identities"
    ADD CONSTRAINT "workforce_attendance_identities_employment_id_fkey"
    FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_punches"
    ADD CONSTRAINT "workforce_attendance_punches_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_punches"
    ADD CONSTRAINT "workforce_attendance_punches_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "workforce_attendance_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_punches"
    ADD CONSTRAINT "workforce_attendance_punches_place_id_fkey"
    FOREIGN KEY ("place_id") REFERENCES "workforce_places"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_attendance_punches"
    ADD CONSTRAINT "workforce_attendance_punches_employment_id_fkey"
    FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
