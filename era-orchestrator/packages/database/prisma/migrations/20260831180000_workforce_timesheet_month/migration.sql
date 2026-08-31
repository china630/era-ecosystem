-- CP month timesheet header + cell types (attendance SoR)
CREATE TYPE "WorkforceTimesheetStatus" AS ENUM ('DRAFT', 'APPROVED');
CREATE TYPE "WorkforceTimesheetEntryType" AS ENUM ('WORK', 'VACATION', 'SICK', 'OFF', 'BUSINESS_TRIP');

CREATE TABLE "workforce_timesheets" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "status" "WorkforceTimesheetStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_timesheets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workforce_timesheets_organization_id_year_month_key"
  ON "workforce_timesheets"("organization_id", "year", "month");
CREATE INDEX "workforce_timesheets_organization_id_status_idx"
  ON "workforce_timesheets"("organization_id", "status");

ALTER TABLE "workforce_timesheets" ADD CONSTRAINT "workforce_timesheets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop duplicate construction rows before unique (keep earliest)
DELETE FROM "workforce_timesheet_entries" a
USING "workforce_timesheet_entries" b
WHERE a."employment_id" = b."employment_id"
  AND a."work_date" = b."work_date"
  AND a."organization_id" = b."organization_id"
  AND a."id" > b."id";

INSERT INTO "workforce_timesheets" ("id", "organization_id", "year", "month", "status", "created_at", "updated_at")
SELECT uuid_generate_v4(), e."organization_id",
       EXTRACT(YEAR FROM e."work_date")::int,
       EXTRACT(MONTH FROM e."work_date")::int,
       'DRAFT'::"WorkforceTimesheetStatus",
       NOW(), NOW()
FROM "workforce_timesheet_entries" e
GROUP BY e."organization_id", EXTRACT(YEAR FROM e."work_date"), EXTRACT(MONTH FROM e."work_date");

ALTER TABLE "workforce_timesheet_entries"
  ADD COLUMN "timesheet_id" UUID,
  ADD COLUMN "type" "WorkforceTimesheetEntryType" NOT NULL DEFAULT 'WORK',
  ADD COLUMN "locked_from_absence" BOOLEAN NOT NULL DEFAULT false;

UPDATE "workforce_timesheet_entries" e
SET "timesheet_id" = t."id"
FROM "workforce_timesheets" t
WHERE e."organization_id" = t."organization_id"
  AND EXTRACT(YEAR FROM e."work_date")::int = t."year"
  AND EXTRACT(MONTH FROM e."work_date")::int = t."month";

ALTER TABLE "workforce_timesheet_entries"
  ALTER COLUMN "timesheet_id" SET NOT NULL,
  ALTER COLUMN "hours" SET DEFAULT 8,
  ALTER COLUMN "source" SET DEFAULT 'ops_grid';

ALTER TABLE "workforce_timesheet_entries" ADD CONSTRAINT "workforce_timesheet_entries_timesheet_id_fkey"
  FOREIGN KEY ("timesheet_id") REFERENCES "workforce_timesheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "workforce_timesheet_entries_timesheet_id_employment_id_work_date_key"
  ON "workforce_timesheet_entries"("timesheet_id", "employment_id", "work_date");
