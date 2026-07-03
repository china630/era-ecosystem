-- v3 Plan A: CP workforce employment + absence workflow

CREATE TYPE "WorkforceEmploymentStatus" AS ENUM ('ACTIVE', 'TERMINATED');
CREATE TYPE "WorkforceAbsenceKind" AS ENUM ('VACATION', 'SICK', 'UNPAID');
CREATE TYPE "WorkforceAbsenceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "workforce_employments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "global_person_id" UUID NOT NULL,
    "status" "WorkforceEmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "hire_date" DATE NOT NULL,
    "finance_employee_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workforce_employments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_absences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "kind" "WorkforceAbsenceKind" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "WorkforceAbsenceStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "rejected_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "submitted_by_user_id" UUID,
    "approved_by_user_id" UUID,
    "rejected_by_user_id" UUID,
    "cancelled_by_user_id" UUID,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workforce_absences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workforce_audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "payload_json" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workforce_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workforce_employments_org_status_idx" ON "workforce_employments"("organization_id", "status");
CREATE INDEX "workforce_employments_global_person_id_idx" ON "workforce_employments"("global_person_id");

CREATE INDEX "workforce_absences_org_employment_start_idx" ON "workforce_absences"("organization_id", "employment_id", "start_date");
CREATE INDEX "workforce_absences_org_status_idx" ON "workforce_absences"("organization_id", "status");

CREATE INDEX "workforce_audit_logs_org_created_idx" ON "workforce_audit_logs"("organization_id", "created_at");
CREATE INDEX "workforce_audit_logs_entity_idx" ON "workforce_audit_logs"("entity_type", "entity_id");

ALTER TABLE "workforce_employments" ADD CONSTRAINT "workforce_employments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_absences" ADD CONSTRAINT "workforce_absences_employment_id_fkey"
  FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
