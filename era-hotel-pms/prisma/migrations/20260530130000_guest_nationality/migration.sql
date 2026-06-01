-- Guest identification: nationality-aware FIN / passport (P0 Electraweb parity)

ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "nationality" TEXT NOT NULL DEFAULT 'AZ';
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "nationalIdFin" TEXT;

ALTER TABLE "Guest" ALTER COLUMN "passportNumber" DROP NOT NULL;
ALTER TABLE "Guest" ALTER COLUMN "phone" DROP NOT NULL;
