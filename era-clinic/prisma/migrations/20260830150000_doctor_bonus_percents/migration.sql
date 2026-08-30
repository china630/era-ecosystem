-- Wave D: doctor bonus percent settings (IN_HOUSE / WALK_IN extras buckets)
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "doctor_bonus_percent_in_house" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "doctor_bonus_percent_walk_in" DOUBLE PRECISION NOT NULL DEFAULT 0;
