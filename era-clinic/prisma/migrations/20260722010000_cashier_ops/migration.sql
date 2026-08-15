-- Clinic cashier ops (CLI-33): channels, split payments, charge log
CREATE TYPE "ClinicReceiptChannel" AS ENUM ('LOCAL', 'FINANCE', 'HOTEL_FOLIO', 'SETTLEMENT_HUB');
CREATE TYPE "ClinicReceiptLineSource" AS ENUM ('VISIT_LINE', 'LAB_ITEM', 'PROCEDURE', 'MANUAL');

ALTER TABLE "ClinicShift" ADD COLUMN IF NOT EXISTS "opened_by_user_id" TEXT;
ALTER TABLE "ClinicShift" ADD COLUMN IF NOT EXISTS "closed_by_user_id" TEXT;
ALTER TABLE "ClinicShift" ADD COLUMN IF NOT EXISTS "z_report_json" TEXT;

ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "patient_ref_id" TEXT;
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "channel" "ClinicReceiptChannel" NOT NULL DEFAULT 'LOCAL';
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "amount_gross" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMP(3);
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "void_reason" TEXT;
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "voided_by_user_id" TEXT;
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "reprint_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "settlement_pending_id" TEXT;
ALTER TABLE "ClinicReceipt" ADD COLUMN IF NOT EXISTS "folio_charge_ref" TEXT;

ALTER TABLE "ClinicReceiptLine" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "ClinicReceiptLine" ADD COLUMN IF NOT EXISTS "source_type" "ClinicReceiptLineSource" NOT NULL DEFAULT 'VISIT_LINE';
ALTER TABLE "ClinicReceiptLine" ADD COLUMN IF NOT EXISTS "source_id" TEXT;

CREATE TABLE IF NOT EXISTS "ClinicReceiptPayment" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "fiscal_receipt_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicReceiptPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProcedureChargeLog" (
    "id" TEXT NOT NULL,
    "procedure_order_id" TEXT NOT NULL,
    "patient_ref_id" TEXT NOT NULL,
    "reservation_id" TEXT,
    "procedure_code" TEXT NOT NULL,
    "procedure_name" TEXT NOT NULL,
    "amount_net" DECIMAL(12,2) NOT NULL,
    "over_quota" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL,
    "external_ticket_id" TEXT,
    "settled_locally" BOOLEAN NOT NULL DEFAULT false,
    "receipt_id" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcedureChargeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ClinicReceipt_createdAt_idx" ON "ClinicReceipt"("createdAt");
CREATE INDEX IF NOT EXISTS "ClinicReceipt_patient_ref_id_idx" ON "ClinicReceipt"("patient_ref_id");
CREATE INDEX IF NOT EXISTS "ClinicReceipt_status_createdAt_idx" ON "ClinicReceipt"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ClinicReceiptPayment_receiptId_idx" ON "ClinicReceiptPayment"("receiptId");
CREATE INDEX IF NOT EXISTS "ProcedureChargeLog_createdAt_idx" ON "ProcedureChargeLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ProcedureChargeLog_patient_ref_id_idx" ON "ProcedureChargeLog"("patient_ref_id");
CREATE INDEX IF NOT EXISTS "ProcedureChargeLog_settled_locally_over_quota_idx" ON "ProcedureChargeLog"("settled_locally", "over_quota");
CREATE INDEX IF NOT EXISTS "ProcedureChargeLog_procedure_order_id_idx" ON "ProcedureChargeLog"("procedure_order_id");

DO $$ BEGIN
  ALTER TABLE "ClinicReceipt" ADD CONSTRAINT "ClinicReceipt_patient_ref_id_fkey" FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ClinicReceiptPayment" ADD CONSTRAINT "ClinicReceiptPayment_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ClinicReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ProcedureChargeLog" ADD CONSTRAINT "ProcedureChargeLog_patient_ref_id_fkey" FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE "ClinicReceipt" SET "amount_gross" = "amountNet" WHERE "amount_gross" = 0 AND "amountNet" > 0;
