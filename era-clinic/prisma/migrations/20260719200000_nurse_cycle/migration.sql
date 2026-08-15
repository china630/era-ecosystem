-- Nurse procedure cycle rework: MANUAL check-in channel + tenant flags.

-- Add MANUAL to the check-in channel enum (idempotent).
ALTER TYPE "ProcedureCheckInChannel" ADD VALUE IF NOT EXISTS 'MANUAL';

-- Tenant: allow MANUAL check-in (QR not required) and optional auto-no-show cutoff.
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "check_in_requires_qr" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "auto_no_show_after_min" INTEGER;
