-- WS1: Payroll depth (schedules, slip lines, seniority, per-diem, business trips)
DO $do_WorkScheduleKind$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkScheduleKind') THEN
    CREATE TYPE "WorkScheduleKind" AS ENUM ('FIVE_DAY', 'SIX_DAY', 'TWO_SHIFT');
  END IF;
END
$do_WorkScheduleKind$;
DO $do_PayrollComponentKind$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollComponentKind') THEN
    CREATE TYPE "PayrollComponentKind" AS ENUM ('EARNING', 'DEDUCTION');
  END IF;
END
$do_PayrollComponentKind$;
DO $do_PayrollComponentCode$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PayrollComponentCode') THEN
    CREATE TYPE "PayrollComponentCode" AS ENUM (
  'BONUS', 'MATERIAL_AID', 'ALIMONY', 'EXECUTION_SHEET', 'LOAN', 'ADVANCE',
  'UNION_DUE', 'INCOME_TAX_RELIEF', 'NIGHT_PREMIUM', 'EVENING_PREMIUM',
  'OVERTIME_PREMIUM', 'BASE_SALARY'
);
  END IF;
END
$do_PayrollComponentCode$;
DO $do_BusinessTripKind$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BusinessTripKind') THEN
    CREATE TYPE "BusinessTripKind" AS ENUM ('DOMESTIC', 'FOREIGN');
  END IF;
END
$do_BusinessTripKind$;

CREATE TABLE IF NOT EXISTS "work_schedules" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "WorkScheduleKind" NOT NULL,
  "day_hours" DECIMAL(8,2) NOT NULL DEFAULT 8,
  "night_premium_rate" DECIMAL(8,4) NOT NULL DEFAULT 1.5,
  "evening_premium_rate" DECIMAL(8,4) NOT NULL DEFAULT 1.2,
  "overtime_premium_rate" DECIMAL(8,4) NOT NULL DEFAULT 2.0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "work_schedules_organization_id_idx" ON "work_schedules"("organization_id");
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "tariff_salary" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "supplement_salary" DECIMAL(19,4) NOT NULL DEFAULT 0;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "work_schedule_id" UUID;
UPDATE "employees" SET "tariff_salary" = "salary" WHERE "tariff_salary" = 0 AND "salary" IS NOT NULL;
ALTER TABLE "employees" ADD CONSTRAINT "employees_work_schedule_id_fkey"
  FOREIGN KEY ("work_schedule_id") REFERENCES "work_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "timesheet_entries" ADD COLUMN IF NOT EXISTS "night_hours" DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE "timesheet_entries" ADD COLUMN IF NOT EXISTS "evening_hours" DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE "timesheet_entries" ADD COLUMN IF NOT EXISTS "overtime_hours" DECIMAL(8,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "payroll_components" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "code" "PayrollComponentCode" NOT NULL,
  "kind" "PayrollComponentKind" NOT NULL,
  "name_az" TEXT NOT NULL,
  "name_ru" TEXT NOT NULL,
  "name_en" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_components_organization_id_code_key" ON "payroll_components"("organization_id", "code");
CREATE INDEX IF NOT EXISTS "payroll_components_organization_id_is_active_idx" ON "payroll_components"("organization_id", "is_active");
ALTER TABLE "payroll_components" ADD CONSTRAINT "payroll_components_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "payroll_slip_lines" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "payroll_slip_id" UUID NOT NULL,
  "component_id" UUID,
  "code" "PayrollComponentCode" NOT NULL,
  "kind" "PayrollComponentKind" NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_slip_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payroll_slip_lines_organization_id_payroll_slip_id_idx" ON "payroll_slip_lines"("organization_id", "payroll_slip_id");
CREATE INDEX IF NOT EXISTS "payroll_slip_lines_payroll_slip_id_idx" ON "payroll_slip_lines"("payroll_slip_id");
ALTER TABLE "payroll_slip_lines" ADD CONSTRAINT "payroll_slip_lines_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_slip_lines" ADD CONSTRAINT "payroll_slip_lines_payroll_slip_id_fkey"
  FOREIGN KEY ("payroll_slip_id") REFERENCES "payroll_slips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_slip_lines" ADD CONSTRAINT "payroll_slip_lines_component_id_fkey"
  FOREIGN KEY ("component_id") REFERENCES "payroll_components"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "vacation_seniority_rules" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "years_from" INTEGER NOT NULL,
  "extra_days" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vacation_seniority_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "vacation_seniority_rules_organization_id_years_from_key" ON "vacation_seniority_rules"("organization_id", "years_from");
ALTER TABLE "vacation_seniority_rules" ADD CONSTRAINT "vacation_seniority_rules_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "per_diem_norms" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "region_code" TEXT NOT NULL,
  "region_name" TEXT NOT NULL,
  "daily_azn_domestic" DECIMAL(19,4) NOT NULL,
  "foreign_factor" DECIMAL(8,4) NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "per_diem_norms_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "per_diem_norms_organization_id_region_code_key" ON "per_diem_norms"("organization_id", "region_code");
ALTER TABLE "per_diem_norms" ADD CONSTRAINT "per_diem_norms_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "business_trips" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "kind" "BusinessTripKind" NOT NULL,
  "region_code" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT '',
  "per_diem_total" DECIMAL(19,4),
  "advance_report_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_trips_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "business_trips_organization_id_employee_id_idx" ON "business_trips"("organization_id", "employee_id");
CREATE INDEX IF NOT EXISTS "business_trips_organization_id_status_idx" ON "business_trips"("organization_id", "status");
ALTER TABLE "business_trips" ADD CONSTRAINT "business_trips_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_trips" ADD CONSTRAINT "business_trips_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
