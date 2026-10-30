-- CLI-62: open attendance + same-day check-in window (ADR clinic-open-attendance)

CREATE TYPE "ProcedureCheckInWindowMode" AS ENUM ('STRICT', 'SAME_DAY');
CREATE TYPE "ProcedureSchedulingMode" AS ENUM ('FIXED', 'OPEN');

ALTER TABLE "Tenant"
  ADD COLUMN "procedure_check_in_window" "ProcedureCheckInWindowMode" NOT NULL DEFAULT 'STRICT',
  ADD COLUMN "procedure_check_in_same_day_until" TIMESTAMP(3);

ALTER TABLE "ProcedureType"
  ADD COLUMN "open_attendance" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ProcedureOrder"
  ADD COLUMN "scheduling_mode" "ProcedureSchedulingMode" NOT NULL DEFAULT 'FIXED';

CREATE INDEX "ProcedureOrder_scheduling_mode_scheduledAt_idx"
  ON "ProcedureOrder"("scheduling_mode", "scheduledAt");
