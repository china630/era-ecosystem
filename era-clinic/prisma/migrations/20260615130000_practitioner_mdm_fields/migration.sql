-- Practitioner MDM identity fields (Wave 1a)
ALTER TABLE "Practitioner"
  ADD COLUMN IF NOT EXISTS "fin_code" TEXT,
  ADD COLUMN IF NOT EXISTS "passport_number" TEXT,
  ADD COLUMN IF NOT EXISTS "issuing_country" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT;
