CREATE TYPE "WorkforceAssignmentStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "workforce_assignments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "global_person_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "satellite_key" TEXT NOT NULL,
  "satellite_user_id" TEXT,
  "finance_employee_id" UUID,
  "role" TEXT NOT NULL,
  "status" "WorkforceAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "workforce_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workforce_assignments_org_satellite_employee_uidx"
  ON "workforce_assignments" ("organization_id", "satellite_key", "finance_employee_id");
CREATE INDEX "workforce_assignments_global_person_id_idx" ON "workforce_assignments" ("global_person_id");
CREATE INDEX "workforce_assignments_org_status_idx" ON "workforce_assignments" ("organization_id", "status");

ALTER TABLE "workforce_assignments"
  ADD CONSTRAINT "workforce_assignments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
