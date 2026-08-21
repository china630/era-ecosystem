-- W1 (CLI-43): tenant default appointment slot length
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "default_appointment_slot_minutes" INTEGER NOT NULL DEFAULT 30;

