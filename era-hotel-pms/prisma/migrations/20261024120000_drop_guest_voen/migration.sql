-- Company tax id does not belong on a guest. Company and agency keep their own VÖEN.
ALTER TABLE "Guest" DROP COLUMN IF EXISTS "voen";
