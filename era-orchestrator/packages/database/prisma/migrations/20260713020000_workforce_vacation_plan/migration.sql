-- WorkforceVacationPlan + lines (CP master; Finance mirror HEADLESS via event)

DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkforceVacationPlanStatus') THEN
    CREATE TYPE "WorkforceVacationPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
  END IF;
END $migration$;

CREATE TABLE IF NOT EXISTS "workforce_vacation_plans" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "workforce_scope_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "org_unit_id" UUID,
    "status" "WorkforceVacationPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_by_user_id" UUID,
    "approved_by_user_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_vacation_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_vacation_plans_workforce_scope_id_year_org_unit_id_key"
  ON "workforce_vacation_plans"("workforce_scope_id", "year", "org_unit_id");

CREATE INDEX IF NOT EXISTS "workforce_vacation_plans_workforce_scope_id_year_status_idx"
  ON "workforce_vacation_plans"("workforce_scope_id", "year", "status");

DO $migration$ BEGIN
  ALTER TABLE "workforce_vacation_plans"
    ADD CONSTRAINT "workforce_vacation_plans_workforce_scope_id_fkey"
    FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $migration$;

DO $migration$ BEGIN
  ALTER TABLE "workforce_vacation_plans"
    ADD CONSTRAINT "workforce_vacation_plans_org_unit_id_fkey"
    FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $migration$;

CREATE TABLE IF NOT EXISTS "workforce_vacation_plan_lines" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "plan_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_vacation_plan_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workforce_vacation_plan_lines_plan_id_idx"
  ON "workforce_vacation_plan_lines"("plan_id");

CREATE INDEX IF NOT EXISTS "workforce_vacation_plan_lines_employment_id_idx"
  ON "workforce_vacation_plan_lines"("employment_id");

DO $migration$ BEGIN
  ALTER TABLE "workforce_vacation_plan_lines"
    ADD CONSTRAINT "workforce_vacation_plan_lines_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "workforce_vacation_plans"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $migration$;

DO $migration$ BEGIN
  ALTER TABLE "workforce_vacation_plan_lines"
    ADD CONSTRAINT "workforce_vacation_plan_lines_employment_id_fkey"
    FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $migration$;
