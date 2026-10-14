-- Wave 2: position tariff and leadership, route audience, advance pay day.

DO $$ BEGIN
  CREATE TYPE "WorkforceApprovalStepAudience" AS ENUM ('ALWAYS', 'LEADERSHIP', 'ORDINARY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "workforce_positions"
  ADD COLUMN IF NOT EXISTS "leadership" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tariff_azn" DECIMAL(19,4),
  ADD COLUMN IF NOT EXISTS "default_work_regime" "WorkforceWorkRegime",
  ADD COLUMN IF NOT EXISTS "weekly_hours" DECIMAL(6,2);

ALTER TABLE "workforce_org_settings"
  ADD COLUMN IF NOT EXISTS "advance_pay_day" INTEGER,
  ADD COLUMN IF NOT EXISTS "allow_employee_submit" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allow_manager_submit" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "workforce_approval_steps"
  ADD COLUMN IF NOT EXISTS "applies_to" "WorkforceApprovalStepAudience" NOT NULL DEFAULT 'ALWAYS',
  ADD COLUMN IF NOT EXISTS "can_exceed_advance_cap" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "workforce_advance_requests"
  ADD COLUMN IF NOT EXISTS "exceeds_limit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "planned_pay_date" DATE;
