-- Wave 12: employee phone cabinet — hourly leave, advance, announcements, paid hourly flag

CREATE TYPE "WorkforceSelfRequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

ALTER TABLE "workforce_timesheet_entries"
  ADD COLUMN IF NOT EXISTS "hourly_leave_paid" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "workforce_hourly_leave_requests" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "employment_id" UUID NOT NULL,
  "work_date" DATE NOT NULL,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT NOT NULL DEFAULT '',
  "status" "WorkforceSelfRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "submitted_by_user_id" UUID NOT NULL,
  "decided_at" TIMESTAMPTZ(6),
  "decided_by_user_id" UUID,
  "rejection_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workforce_hourly_leave_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workforce_hourly_leave_requests_employment_id_fkey"
    FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "workforce_hourly_leave_requests_organization_id_status_idx"
  ON "workforce_hourly_leave_requests"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "workforce_hourly_leave_requests_org_emp_date_idx"
  ON "workforce_hourly_leave_requests"("organization_id", "employment_id", "work_date");

CREATE TABLE IF NOT EXISTS "workforce_advance_requests" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "employment_id" UUID NOT NULL,
  "amount_azn" DECIMAL(19, 4) NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "status" "WorkforceSelfRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "submitted_by_user_id" UUID NOT NULL,
  "decided_at" TIMESTAMPTZ(6),
  "decided_by_user_id" UUID,
  "rejection_reason" TEXT,
  "finance_queued_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workforce_advance_requests_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workforce_advance_requests_employment_id_fkey"
    FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "workforce_advance_requests_organization_id_status_idx"
  ON "workforce_advance_requests"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "workforce_advance_requests_organization_id_employment_id_idx"
  ON "workforce_advance_requests"("organization_id", "employment_id");

CREATE TABLE IF NOT EXISTS "workforce_announcements" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "published_by_user_id" UUID NOT NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workforce_announcements_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "workforce_announcements_organization_id_published_at_idx"
  ON "workforce_announcements"("organization_id", "published_at");

CREATE TABLE IF NOT EXISTS "workforce_announcement_reads" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "announcement_id" UUID NOT NULL,
  "employment_id" UUID NOT NULL,
  "read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "workforce_announcement_reads_announcement_id_fkey"
    FOREIGN KEY ("announcement_id") REFERENCES "workforce_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workforce_announcement_reads_employment_id_fkey"
    FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_announcement_reads_announcement_id_employment_id_key"
  ON "workforce_announcement_reads"("announcement_id", "employment_id");
CREATE INDEX IF NOT EXISTS "workforce_announcement_reads_organization_id_employment_id_idx"
  ON "workforce_announcement_reads"("organization_id", "employment_id");

CREATE INDEX IF NOT EXISTS "workforce_employments_platform_user_id_idx"
  ON "workforce_employments"("platform_user_id");
