-- Wave 13: employment-scoped fitness files (health / narcology / criminal-record)

DO $$ BEGIN
  CREATE TYPE "WorkforceFitnessKind" AS ENUM ('HEALTH', 'NARCOLOGY', 'CRIMINAL_RECORD');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workforce_fitness_records" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "employment_id" UUID NOT NULL,
  "kind" "WorkforceFitnessKind" NOT NULL,
  "issued_on" DATE NOT NULL,
  "valid_until" DATE,
  "storage_key" VARCHAR(512) NOT NULL,
  "content_type" VARCHAR(128) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "attached_by_user_id" UUID NOT NULL,
  "attached_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_fitness_records_employment_id_fkey"
    FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workforce_fitness_records_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_fitness_records_employment_id_kind_key"
  ON "workforce_fitness_records"("employment_id", "kind");

CREATE INDEX IF NOT EXISTS "workforce_fitness_records_organization_id_employment_id_idx"
  ON "workforce_fitness_records"("organization_id", "employment_id");
