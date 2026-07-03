-- v3 Plan B: Finance CostCenter mirror from CP org structure

CREATE TYPE "DepartmentSource" AS ENUM ('CP_EVENT', 'LEGACY_MANUAL');

ALTER TABLE "departments"
  ADD COLUMN "cp_org_unit_id" UUID,
  ADD COLUMN "cost_center_code" TEXT,
  ADD COLUMN "manager_employment_id" UUID,
  ADD COLUMN "source" "DepartmentSource" NOT NULL DEFAULT 'CP_EVENT';

CREATE UNIQUE INDEX "departments_cp_org_unit_id_key" ON "departments"("cp_org_unit_id");

ALTER TABLE "job_positions"
  ADD COLUMN "cp_position_id" UUID,
  ADD COLUMN "source" "DepartmentSource" NOT NULL DEFAULT 'CP_EVENT';

CREATE UNIQUE INDEX "job_positions_cp_position_id_key" ON "job_positions"("cp_position_id");

ALTER TABLE "employees"
  ADD COLUMN "cp_employment_id" UUID;

CREATE UNIQUE INDEX "employees_cp_employment_id_key" ON "employees"("cp_employment_id");
