-- Plan clock stays on scheduledAt/endsAt; check-in writes factual occupancy here.
ALTER TABLE "ProcedureOrder"
ADD COLUMN "actual_starts_at" TIMESTAMP(3),
ADD COLUMN "actual_ends_at" TIMESTAMP(3);

CREATE INDEX "ProcedureOrder_actual_starts_at_idx" ON "ProcedureOrder"("actual_starts_at");
