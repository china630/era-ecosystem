-- Wave 11: holiday / rest premium rates on work schedules (default ×2, TK AR).

ALTER TABLE "work_schedules"
  ADD COLUMN IF NOT EXISTS "holiday_premium_rate" DECIMAL(8, 4) NOT NULL DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS "rest_premium_rate" DECIMAL(8, 4) NOT NULL DEFAULT 2.0;
