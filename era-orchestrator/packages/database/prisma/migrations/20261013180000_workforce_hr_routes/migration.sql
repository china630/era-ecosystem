-- HR cadre fields, org-structure approval routes, vacation plan cancel/revision.
ALTER TYPE "WorkforceAbsenceStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
ALTER TYPE "WorkforceVacationPlanStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $migration$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkforceWorkRegime') THEN
    CREATE TYPE "WorkforceWorkRegime" AS ENUM ('FIVE_DAY', 'SIX_DAY', 'MEDICAL', 'CUSTOM');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkforceApprovalRequestKind') THEN
    CREATE TYPE "WorkforceApprovalRequestKind" AS ENUM ('FULL_DAY', 'HOURLY', 'ADVANCE', 'VACATION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkforceApprovalStepKind') THEN
    CREATE TYPE "WorkforceApprovalStepKind" AS ENUM ('REQUESTER_MANAGER', 'ORG_UNIT_HEAD', 'POSITION_IN_UNIT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkforceApprovalOutcome') THEN
    CREATE TYPE "WorkforceApprovalOutcome" AS ENUM ('APPROVED', 'REJECTED', 'CANCELLED', 'CORRECTION');
  END IF;
END $migration$;

ALTER TABLE "workforce_employments"
  ADD COLUMN IF NOT EXISTS "contract_end_date" DATE,
  ADD COLUMN IF NOT EXISTS "work_regime" "WorkforceWorkRegime";

ALTER TABLE "workforce_absences"
  ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "correction_of_id" UUID,
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;

ALTER TABLE "workforce_hourly_leave_requests"
  ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "workforce_advance_requests"
  ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "workforce_vacation_plans"
  ADD COLUMN IF NOT EXISTS "current_step_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;

CREATE TABLE IF NOT EXISTS "workforce_org_settings" (
  "organization_id" UUID NOT NULL,
  "five_day_weekly_hours" DECIMAL(6,2),
  "six_day_weekly_hours" DECIMAL(6,2),
  "medical_weekly_hours" DECIMAL(6,2),
  "custom_weekly_hours" DECIMAL(6,2),
  "advance_max_percent" DECIMAL(6,2),
  "advance_max_amount" DECIMAL(19,4),
  "advance_max_open" INTEGER,
  "advance_allow_hr_proxy" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_org_settings_pkey" PRIMARY KEY ("organization_id")
);

CREATE TABLE IF NOT EXISTS "workforce_approval_routes" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "kind" "WorkforceApprovalRequestKind" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_approval_routes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_approval_routes_organization_id_kind_key"
  ON "workforce_approval_routes"("organization_id", "kind");

CREATE TABLE IF NOT EXISTS "workforce_approval_steps" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "route_id" UUID NOT NULL,
  "step_order" INTEGER NOT NULL,
  "kind" "WorkforceApprovalStepKind" NOT NULL,
  "org_unit_id" UUID,
  "position_id" UUID,
  CONSTRAINT "workforce_approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workforce_approval_steps_route_id_step_order_key"
  ON "workforce_approval_steps"("route_id", "step_order");
CREATE INDEX IF NOT EXISTS "workforce_approval_steps_org_unit_id_idx"
  ON "workforce_approval_steps"("org_unit_id");

CREATE TABLE IF NOT EXISTS "workforce_approval_decisions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "entity_type" VARCHAR(32) NOT NULL,
  "entity_id" UUID NOT NULL,
  "step_order" INTEGER NOT NULL,
  "step_kind" "WorkforceApprovalStepKind",
  "org_unit_id" UUID,
  "org_unit_name" VARCHAR(255),
  "outcome" "WorkforceApprovalOutcome" NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workforce_approval_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workforce_approval_decisions_organization_id_created_at_idx"
  ON "workforce_approval_decisions"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "workforce_approval_decisions_organization_id_entity_type_entity_id_idx"
  ON "workforce_approval_decisions"("organization_id", "entity_type", "entity_id");

CREATE TABLE IF NOT EXISTS "workforce_vacation_plan_revisions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "plan_id" UUID NOT NULL,
  "snapshot_json" JSONB NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workforce_vacation_plan_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workforce_vacation_plan_revisions_plan_id_created_at_idx"
  ON "workforce_vacation_plan_revisions"("plan_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "workforce_org_settings"
    ADD CONSTRAINT "workforce_org_settings_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_approval_routes"
    ADD CONSTRAINT "workforce_approval_routes_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_approval_steps"
    ADD CONSTRAINT "workforce_approval_steps_route_id_fkey"
    FOREIGN KEY ("route_id") REFERENCES "workforce_approval_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_approval_steps"
    ADD CONSTRAINT "workforce_approval_steps_org_unit_id_fkey"
    FOREIGN KEY ("org_unit_id") REFERENCES "org_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_approval_steps"
    ADD CONSTRAINT "workforce_approval_steps_position_id_fkey"
    FOREIGN KEY ("position_id") REFERENCES "workforce_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_approval_decisions"
    ADD CONSTRAINT "workforce_approval_decisions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "workforce_vacation_plan_revisions"
    ADD CONSTRAINT "workforce_vacation_plan_revisions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "workforce_vacation_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
