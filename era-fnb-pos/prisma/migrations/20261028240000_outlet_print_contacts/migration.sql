-- CP-ORG-PROFILE-01 Track C: outlet operational contact overlay for receipt chrome
ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "website" TEXT;
