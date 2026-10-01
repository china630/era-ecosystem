-- Hotel child/line organizationId. Backfill from the parent row; fail if any row stays null.

ALTER TABLE "FiscalDocument" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "FiscalDocument" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FiscalDocument" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'FiscalDocument: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "FiscalDocument" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "FiscalDocument_organizationId_idx" ON "FiscalDocument"("organizationId");

ALTER TABLE "ReservationFolioRoutingOverride" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "ReservationFolioRoutingOverride" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "ReservationFolioRoutingOverride" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'ReservationFolioRoutingOverride: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "ReservationFolioRoutingOverride" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "ReservationFolioRoutingOverride_organizationId_idx" ON "ReservationFolioRoutingOverride"("organizationId");

ALTER TABLE "FolioRoutingRule" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "FolioRoutingRule" AS c
SET "organizationId" = p."organizationId"
FROM "RevenueCode" AS p
WHERE c."revenueCodeId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FolioRoutingRule" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'FolioRoutingRule: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "FolioRoutingRule" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "FolioRoutingRule_organizationId_idx" ON "FolioRoutingRule"("organizationId");

ALTER TABLE "FolioCharge" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "FolioCharge" AS c
SET "organizationId" = p."organizationId"
FROM "Folio" AS p
WHERE c."folioId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FolioCharge" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'FolioCharge: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "FolioCharge" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "FolioCharge_organizationId_idx" ON "FolioCharge"("organizationId");

ALTER TABLE "FolioCharge" DROP CONSTRAINT IF EXISTS "FolioCharge_externalRef_key";
DROP INDEX IF EXISTS "FolioCharge_externalRef_key";
CREATE UNIQUE INDEX IF NOT EXISTS "FolioCharge_organizationId_externalRef_key"
  ON "FolioCharge"("organizationId", "externalRef");

ALTER TABLE "FolioPayment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "FolioPayment" AS c
SET "organizationId" = p."organizationId"
FROM "Folio" AS p
WHERE c."folioId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FolioPayment" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'FolioPayment: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "FolioPayment" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "FolioPayment_organizationId_idx" ON "FolioPayment"("organizationId");

ALTER TABLE "FolioPaymentAllocation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "FolioPaymentAllocation" AS c
SET "organizationId" = p."organizationId"
FROM "FolioPayment" AS p
WHERE c."paymentId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FolioPaymentAllocation" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'FolioPaymentAllocation: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "FolioPaymentAllocation" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "FolioPaymentAllocation_organizationId_idx" ON "FolioPaymentAllocation"("organizationId");

ALTER TABLE "FolioSettlement" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "FolioSettlement" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FolioSettlement" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'FolioSettlement: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "FolioSettlement" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "FolioSettlement_organizationId_idx" ON "FolioSettlement"("organizationId");

ALTER TABLE "FolioDeposit" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "FolioDeposit" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "FolioDeposit" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'FolioDeposit: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "FolioDeposit" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "FolioDeposit_organizationId_idx" ON "FolioDeposit"("organizationId");

ALTER TABLE "CardAuthorization" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "CardAuthorization" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "CardAuthorization" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'CardAuthorization: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "CardAuthorization" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "CardAuthorization_organizationId_idx" ON "CardAuthorization"("organizationId");
ALTER TABLE "SettlementPendingCharge" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

UPDATE "SettlementPendingCharge" AS c
SET "organizationId" = p."organizationId"
FROM "Reservation" AS p
WHERE c."reservationId" = p.id
  AND c."organizationId" IS NULL;

UPDATE "SettlementPendingCharge" AS c
SET "organizationId" = p."organizationId"
FROM "CashShift" AS p
WHERE c."cashShiftId" = p.id
  AND c."organizationId" IS NULL;

DO $$
DECLARE
  n int;
  org text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "SettlementPendingCharge" WHERE "organizationId" IS NULL) THEN
    RETURN;
  END IF;
  SELECT COUNT(DISTINCT "organizationId") INTO n FROM "HotelProfile";
  IF n = 1 THEN
    SELECT "organizationId" INTO org FROM "HotelProfile" LIMIT 1;
    UPDATE "SettlementPendingCharge" SET "organizationId" = org WHERE "organizationId" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM "SettlementPendingCharge" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'SettlementPendingCharge: organizationId backfill left null rows';
  END IF;
END $$;

ALTER TABLE "SettlementPendingCharge" ALTER COLUMN "organizationId" SET NOT NULL;
CREATE INDEX IF NOT EXISTS "SettlementPendingCharge_organizationId_idx" ON "SettlementPendingCharge"("organizationId");

ALTER TABLE "SettlementPendingCharge" DROP CONSTRAINT IF EXISTS "SettlementPendingCharge_idempotencyKey_key";
DROP INDEX IF EXISTS "SettlementPendingCharge_idempotencyKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SettlementPendingCharge_organizationId_idempotencyKey_key"
  ON "SettlementPendingCharge"("organizationId", "idempotencyKey");
