-- F&B WEEK_PERSON cədvəl (person × day). StaffRoster PIN table unchanged.
CREATE TYPE "FnbDutyWeekStatus" AS ENUM ('DRAFT', 'APPROVED');

CREATE TABLE "fnb_duty_shift_codes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fnb_duty_shift_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fnb_duty_shift_codes_organization_id_code_key" ON "fnb_duty_shift_codes"("organization_id", "code");
CREATE INDEX "fnb_duty_shift_codes_organization_id_idx" ON "fnb_duty_shift_codes"("organization_id");

CREATE TABLE "fnb_duty_schedule_bindings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "org_unit_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "outlet_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fnb_duty_schedule_bindings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fnb_duty_schedule_bindings_organization_id_key" ON "fnb_duty_schedule_bindings"("organization_id");

CREATE TABLE "fnb_duty_schedule_weeks" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "status" "FnbDutyWeekStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fnb_duty_schedule_weeks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fnb_duty_schedule_weeks_organization_id_week_start_key" ON "fnb_duty_schedule_weeks"("organization_id", "week_start");
CREATE INDEX "fnb_duty_schedule_weeks_organization_id_idx" ON "fnb_duty_schedule_weeks"("organization_id");

CREATE TABLE "fnb_duty_schedule_cells" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "week_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "global_person_id" TEXT NOT NULL,
    "person_name" TEXT NOT NULL,
    "position_name" TEXT,
    "org_unit_id" TEXT,
    "org_unit_name" TEXT,
    "position_id" TEXT,
    "outlet_id" TEXT,
    "outlet_name" TEXT,
    "shift_code" TEXT NOT NULL,
    "orphaned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fnb_duty_schedule_cells_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fnb_duty_schedule_cells_week_id_work_date_global_person_id_key" ON "fnb_duty_schedule_cells"("week_id", "work_date", "global_person_id");
CREATE INDEX "fnb_duty_schedule_cells_organization_id_week_id_idx" ON "fnb_duty_schedule_cells"("organization_id", "week_id");

ALTER TABLE "fnb_duty_schedule_cells" ADD CONSTRAINT "fnb_duty_schedule_cells_week_id_fkey" FOREIGN KEY ("week_id") REFERENCES "fnb_duty_schedule_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
