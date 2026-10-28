-- Manual charge/payment flags + reportType for data-driven folio pickers.
ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "allowManualCharge" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "allowManualPayment" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "reportType" TEXT;

-- Lodging nights / city tax are not Extra charge — Qiymətlər / NA / tax post only.
UPDATE "RevenueCode"
SET "allowManualCharge" = false,
    "reportType" = COALESCE("reportType", CASE
      WHEN "systemRole" = 'CITY_TAX' THEN 'TAX'
      ELSE 'LODGING'
    END)
WHERE "systemRole" IN ('ROOM', 'PKG', 'CITY_TAX');
