-- Plan C: role templates, bindings, manual grants, seat allocations; WorkforceAssignment cpEmploymentId key

CREATE TYPE "RoleBindingSource" AS ENUM ('TEMPLATE', 'MANUAL_GRANT', 'HIRE_DEFAULT');
CREATE TYPE "RoleBindingStatus" AS ENUM ('ACTIVE', 'REVOKED');

ALTER TABLE "workforce_assignments" ADD COLUMN IF NOT EXISTS "cp_employment_id" UUID;

DROP INDEX IF EXISTS "workforce_assignments_organization_id_satellite_key_finance_employee_id_key";
CREATE UNIQUE INDEX "workforce_assignments_organization_id_satellite_key_cp_employment_id_key"
  ON "workforce_assignments"("organization_id", "satellite_key", "cp_employment_id");

CREATE TABLE "satellite_role_templates" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workforce_scope_id" UUID NOT NULL,
  "position_id" UUID NOT NULL,
  "satellite_key" TEXT NOT NULL,
  "satellite_role" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "satellite_role_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_manual_grants" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "employment_id" UUID NOT NULL,
  "satellite_key" TEXT NOT NULL,
  "satellite_role" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "granted_by_user_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workforce_manual_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_role_bindings" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "employment_id" UUID NOT NULL,
  "satellite_key" TEXT NOT NULL,
  "satellite_role" TEXT NOT NULL,
  "source" "RoleBindingSource" NOT NULL,
  "manual_grant_id" UUID,
  "status" "RoleBindingStatus" NOT NULL DEFAULT 'ACTIVE',
  "satellite_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_role_bindings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_seat_allocations" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workforce_scope_id" UUID NOT NULL,
  "global_person_id" UUID NOT NULL,
  "employment_id" UUID NOT NULL,
  "status" "RoleBindingStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workforce_seat_allocations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "satellite_role_templates_position_id_satellite_key_satellite_role_key"
  ON "satellite_role_templates"("position_id", "satellite_key", "satellite_role");
CREATE INDEX "satellite_role_templates_workforce_scope_id_satellite_key_idx"
  ON "satellite_role_templates"("workforce_scope_id", "satellite_key");

CREATE UNIQUE INDEX "workforce_role_bindings_employment_id_satellite_key_satellite_role_key"
  ON "workforce_role_bindings"("employment_id", "satellite_key", "satellite_role");
CREATE INDEX "workforce_role_bindings_employment_id_status_idx"
  ON "workforce_role_bindings"("employment_id", "status");

CREATE UNIQUE INDEX "workforce_seat_allocations_employment_id_key"
  ON "workforce_seat_allocations"("employment_id");
CREATE UNIQUE INDEX "workforce_seat_allocations_workforce_scope_id_global_person_id_key"
  ON "workforce_seat_allocations"("workforce_scope_id", "global_person_id");

ALTER TABLE "satellite_role_templates"
  ADD CONSTRAINT "satellite_role_templates_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "workforce_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_manual_grants"
  ADD CONSTRAINT "workforce_manual_grants_employment_id_fkey"
  FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_role_bindings"
  ADD CONSTRAINT "workforce_role_bindings_employment_id_fkey"
  FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_role_bindings"
  ADD CONSTRAINT "workforce_role_bindings_manual_grant_id_fkey"
  FOREIGN KEY ("manual_grant_id") REFERENCES "workforce_manual_grants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workforce_seat_allocations"
  ADD CONSTRAINT "workforce_seat_allocations_workforce_scope_id_fkey"
  FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_seat_allocations"
  ADD CONSTRAINT "workforce_seat_allocations_employment_id_fkey"
  FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
