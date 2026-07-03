-- Plan F: timesheet entries, audit correlation columns

CREATE TYPE "WorkforceTimesheetEntryStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TABLE "workforce_timesheet_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'construction_csv',
    "source_ref" TEXT,
    "status" "WorkforceTimesheetEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workforce_timesheet_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workforce_timesheet_entries_organization_id_employment_id_work_date_idx" ON "workforce_timesheet_entries"("organization_id", "employment_id", "work_date");
CREATE INDEX "workforce_timesheet_entries_organization_id_status_idx" ON "workforce_timesheet_entries"("organization_id", "status");

ALTER TABLE "workforce_timesheet_entries" ADD CONSTRAINT "workforce_timesheet_entries_employment_id_fkey" FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workforce_audit_logs" ADD COLUMN "workforce_scope_id" UUID;
ALTER TABLE "workforce_audit_logs" ADD COLUMN "global_person_id" UUID;
ALTER TABLE "workforce_audit_logs" ADD COLUMN "cp_employment_id" UUID;

CREATE INDEX "workforce_audit_logs_global_person_id_idx" ON "workforce_audit_logs"("global_person_id");
CREATE INDEX "workforce_audit_logs_cp_employment_id_idx" ON "workforce_audit_logs"("cp_employment_id");
