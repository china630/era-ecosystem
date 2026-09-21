-- W1: LabOrderItem / VisitServiceLine burn package entitlement balances
ALTER TABLE "VisitServiceLine" ADD COLUMN IF NOT EXISTS "in_package" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VisitServiceLine" ADD COLUMN IF NOT EXISTS "package_quota_code" TEXT;

ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "in_package" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LabOrderItem" ADD COLUMN IF NOT EXISTS "package_quota_code" TEXT;

CREATE INDEX IF NOT EXISTS "VisitServiceLine_package_quota_code_idx" ON "VisitServiceLine"("package_quota_code");
CREATE INDEX IF NOT EXISTS "VisitServiceLine_in_package_idx" ON "VisitServiceLine"("in_package");
CREATE INDEX IF NOT EXISTS "LabOrderItem_package_quota_code_idx" ON "LabOrderItem"("package_quota_code");
CREATE INDEX IF NOT EXISTS "LabOrderItem_in_package_idx" ON "LabOrderItem"("in_package");
