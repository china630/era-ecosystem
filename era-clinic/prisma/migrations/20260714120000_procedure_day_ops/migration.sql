-- Wave A: procedure day-ops statuses + attendance audit + check-in grace
CREATE TYPE "ProcedureCheckInChannel" AS ENUM ('QR', 'OVERRIDE');

CREATE TYPE "ProcedureOrderStatus_new" AS ENUM (
  'SCHEDULED',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
  'CANCELLED'
);

ALTER TABLE "ProcedureOrder" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "ProcedureOrder"
  ALTER COLUMN "status" TYPE TEXT USING (
    CASE "status"::text
      WHEN 'IN_PROGRESS' THEN 'CHECKED_IN'
      ELSE "status"::text
    END
  );

ALTER TABLE "ProcedureOrder"
  ALTER COLUMN "status" TYPE "ProcedureOrderStatus_new"
  USING ("status"::"ProcedureOrderStatus_new");

DROP TYPE "ProcedureOrderStatus";
ALTER TYPE "ProcedureOrderStatus_new" RENAME TO "ProcedureOrderStatus";

ALTER TABLE "ProcedureOrder" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"ProcedureOrderStatus";

ALTER TABLE "ProcedureOrder"
  ADD COLUMN IF NOT EXISTS "manually_adjusted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checked_in_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "check_in_channel" "ProcedureCheckInChannel",
  ADD COLUMN IF NOT EXISTS "check_in_override_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completed_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "no_show_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "no_show_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;

CREATE INDEX IF NOT EXISTS "ProcedureOrder_status_scheduledAt_idx"
  ON "ProcedureOrder"("status", "scheduledAt");

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "procedure_check_in_grace_before_min" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "procedure_check_in_grace_after_min" INTEGER NOT NULL DEFAULT 15;
