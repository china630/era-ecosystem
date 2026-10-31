-- LabOrder / Visit money fields for paid diagnostics (no PENDING_PAY status).
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "in_package" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "package_quota_code" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "prescribed_by_practitioner_id" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "payment_receipt_ref" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "reservation_id" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "room_number" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN IF NOT EXISTS "patient_origin" "PatientOrigin" NOT NULL DEFAULT 'WALK_IN';
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "payment_receipt_ref" TEXT;

CREATE INDEX IF NOT EXISTS "LabOrder_in_package_idx" ON "LabOrder"("in_package");
CREATE INDEX IF NOT EXISTS "LabOrder_settled_at_idx" ON "LabOrder"("settled_at");
CREATE INDEX IF NOT EXISTS "LabOrder_prescribed_by_practitioner_id_idx" ON "LabOrder"("prescribed_by_practitioner_id");

DO $$ BEGIN
  ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_prescribed_by_practitioner_id_fkey"
    FOREIGN KEY ("prescribed_by_practitioner_id") REFERENCES "Practitioner"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Header mirror: package items already stamped on LabOrderItem.
UPDATE "LabOrder" lo
SET "in_package" = true,
    "package_quota_code" = sub."package_quota_code"
FROM (
  SELECT "lab_order_id",
         MIN("package_quota_code") FILTER (WHERE "package_quota_code" IS NOT NULL) AS "package_quota_code"
  FROM "LabOrderItem"
  WHERE "in_package" = true
  GROUP BY "lab_order_id"
) sub
WHERE lo.id = sub."lab_order_id";
