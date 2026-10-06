-- Report letterhead and optional bed capacity on the hotel profile.
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "bedCapacity" INTEGER;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "printName" TEXT;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "HotelProfile" ADD COLUMN IF NOT EXISTS "logoPath" TEXT;
