-- CLI-57: PENDING_PAY for paid extras; assignBatchId for package modal aggregates
ALTER TYPE "ProcedureOrderStatus" ADD VALUE 'PENDING_PAY';

ALTER TABLE "ProcedureOrder" ADD COLUMN IF NOT EXISTS "assign_batch_id" TEXT;
CREATE INDEX IF NOT EXISTS "ProcedureOrder_assign_batch_id_idx" ON "ProcedureOrder"("assign_batch_id");
