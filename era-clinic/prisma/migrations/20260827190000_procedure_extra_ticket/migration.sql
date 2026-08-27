-- Dual-run extra SPA ticket (issue at print, not COMPLETED)
ALTER TABLE "ProcedureOrder" ADD COLUMN "extra_ticket_issued_at" TIMESTAMP(3);
ALTER TABLE "ProcedureOrder" ADD COLUMN "extra_ticket_id" TEXT;
CREATE INDEX "ProcedureOrder_extra_ticket_id_idx" ON "ProcedureOrder"("extra_ticket_id");
