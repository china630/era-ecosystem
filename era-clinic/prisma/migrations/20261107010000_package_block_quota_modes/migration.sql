-- Per-block quota modes on dynamic packages + fractional daily rate + weekly rate.
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "block_quota_mode" TEXT;
ALTER TABLE "ProgramTemplateProcedure" ADD COLUMN IF NOT EXISTS "quota_per_week" INTEGER;

-- Int → Decimal(8,4) for fractional quotaPerNight (0.55 massage, 0.5 ozone).
ALTER TABLE "ProgramTemplateProcedure"
  ALTER COLUMN "quota_per_night" TYPE DECIMAL(8,4)
  USING (
    CASE
      WHEN "quota_per_night" IS NULL THEN NULL
      ELSE "quota_per_night"::DECIMAL(8,4)
    END
  );
