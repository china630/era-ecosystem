ALTER TABLE "pos_shifts" ADD COLUMN "counted_cash" DECIMAL(12,2);
ALTER TABLE "pos_shifts" ADD COLUMN "expected_cash" DECIMAL(12,2);
ALTER TABLE "pos_shifts" ADD COLUMN "cash_variance" DECIMAL(12,2);

CREATE TABLE "pos_cash_drops" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "shift_id" TEXT NOT NULL,
  "amount_azn" DECIMAL(12,2) NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_cash_drops_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_cash_drops_shift_id_idx" ON "pos_cash_drops"("shift_id");
CREATE INDEX "pos_cash_drops_organizationId_idx" ON "pos_cash_drops"("organizationId");

ALTER TABLE "pos_cash_drops"
  ADD CONSTRAINT "pos_cash_drops_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
