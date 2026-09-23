-- Contact email SoR on the natural person (cipher), parallel to phone_cipher.

ALTER TABLE "global_natural_persons"
  ADD COLUMN IF NOT EXISTS "email_cipher" TEXT;
