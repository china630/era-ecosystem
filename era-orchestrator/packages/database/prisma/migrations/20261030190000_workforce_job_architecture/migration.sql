-- Job architecture: grades, jobs, position parent, employment managers, unitKind, route kinds.

DO $$ BEGIN
  CREATE TYPE "OrgUnitKind" AS ENUM ('COMPANY', 'DIVISION', 'DEPARTMENT', 'TEAM');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WorkforceApprovalStepKind" ADD VALUE IF NOT EXISTS 'MANAGER_CHAIN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WorkforceApprovalStepKind" ADD VALUE IF NOT EXISTS 'POSITION_HOLDER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WorkforceApprovalStepKind" ADD VALUE IF NOT EXISTS 'MATRIX_MANAGER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "WorkforceApprovalStepKind" ADD VALUE IF NOT EXISTS 'GRADE_AT_LEAST';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "org_units"
  ADD COLUMN IF NOT EXISTS "unit_kind" "OrgUnitKind" NOT NULL DEFAULT 'DEPARTMENT';

CREATE TABLE IF NOT EXISTS "workforce_grades" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workforce_scope_id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "min_salary" DECIMAL(19,4),
  "max_salary" DECIMAL(19,4),
  "status" "OrgUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_grades_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_grades_workforce_scope_id_code_key"
  ON "workforce_grades"("workforce_scope_id", "code");
CREATE INDEX IF NOT EXISTS "workforce_grades_workforce_scope_id_status_idx"
  ON "workforce_grades"("workforce_scope_id", "status");

DO $$ BEGIN
  ALTER TABLE "workforce_grades"
    ADD CONSTRAINT "workforce_grades_workforce_scope_id_fkey"
    FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "workforce_jobs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workforce_scope_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "job_family" TEXT,
  "grade_id" UUID,
  "status" "OrgUnitStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_jobs_workforce_scope_id_name_key"
  ON "workforce_jobs"("workforce_scope_id", "name");
CREATE INDEX IF NOT EXISTS "workforce_jobs_workforce_scope_id_status_idx"
  ON "workforce_jobs"("workforce_scope_id", "status");
CREATE INDEX IF NOT EXISTS "workforce_jobs_grade_id_idx"
  ON "workforce_jobs"("grade_id");

DO $$ BEGIN
  ALTER TABLE "workforce_jobs"
    ADD CONSTRAINT "workforce_jobs_workforce_scope_id_fkey"
    FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_jobs"
    ADD CONSTRAINT "workforce_jobs_grade_id_fkey"
    FOREIGN KEY ("grade_id") REFERENCES "workforce_grades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workforce_positions"
  ADD COLUMN IF NOT EXISTS "job_id" UUID,
  ADD COLUMN IF NOT EXISTS "parent_position_id" UUID;

CREATE INDEX IF NOT EXISTS "workforce_positions_job_id_idx"
  ON "workforce_positions"("job_id");
CREATE INDEX IF NOT EXISTS "workforce_positions_parent_position_id_idx"
  ON "workforce_positions"("parent_position_id");

DO $$ BEGIN
  ALTER TABLE "workforce_positions"
    ADD CONSTRAINT "workforce_positions_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "workforce_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_positions"
    ADD CONSTRAINT "workforce_positions_parent_position_id_fkey"
    FOREIGN KEY ("parent_position_id") REFERENCES "workforce_positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workforce_employments"
  ADD COLUMN IF NOT EXISTS "manager_employment_id" UUID,
  ADD COLUMN IF NOT EXISTS "matrix_manager_employment_id" UUID;

CREATE INDEX IF NOT EXISTS "workforce_employments_manager_employment_id_idx"
  ON "workforce_employments"("manager_employment_id");
CREATE INDEX IF NOT EXISTS "workforce_employments_matrix_manager_employment_id_idx"
  ON "workforce_employments"("matrix_manager_employment_id");

DO $$ BEGIN
  ALTER TABLE "workforce_employments"
    ADD CONSTRAINT "workforce_employments_manager_employment_id_fkey"
    FOREIGN KEY ("manager_employment_id") REFERENCES "workforce_employments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_employments"
    ADD CONSTRAINT "workforce_employments_matrix_manager_employment_id_fkey"
    FOREIGN KEY ("matrix_manager_employment_id") REFERENCES "workforce_employments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workforce_approval_steps"
  ADD COLUMN IF NOT EXISTS "chain_offset" INTEGER,
  ADD COLUMN IF NOT EXISTS "min_grade_level" INTEGER;
