-- Cash drawer on a department, business day on deposits and guest-debt payments,
-- and the hotel operational year seal (not the finance GL close).

ALTER TABLE "Department" ADD COLUMN "cashPoint" TEXT;

CREATE UNIQUE INDEX "Department_organizationId_cashPoint_key"
  ON "Department"("organizationId", "cashPoint");

UPDATE "Department" SET "cashPoint" = 'HOTEL' WHERE code = 'HOTEL' AND "cashPoint" IS NULL;
UPDATE "Department" SET "cashPoint" = 'FNB_POS' WHERE code = 'REST' AND "cashPoint" IS NULL;
UPDATE "Department" SET "cashPoint" = 'CLINIC' WHERE code = 'CLINIC' AND "cashPoint" IS NULL;
UPDATE "Department" SET "cashPoint" = 'RETAIL' WHERE code = 'RETAIL' AND "cashPoint" IS NULL;

INSERT INTO "Department" ("id", "organizationId", "code", "name", "cashPoint")
SELECT gen_random_uuid()::text, hp."organizationId", 'HOTEL', 'Hotel', 'HOTEL'
FROM "HotelProfile" hp
WHERE NOT EXISTS (
  SELECT 1 FROM "Department" d
  WHERE d."organizationId" = hp."organizationId" AND (d.code = 'HOTEL' OR d."cashPoint" = 'HOTEL')
);

INSERT INTO "Department" ("id", "organizationId", "code", "name", "cashPoint")
SELECT gen_random_uuid()::text, hp."organizationId", 'CLINIC', 'Clinic', 'CLINIC'
FROM "HotelProfile" hp
WHERE NOT EXISTS (
  SELECT 1 FROM "Department" d
  WHERE d."organizationId" = hp."organizationId" AND (d.code = 'CLINIC' OR d."cashPoint" = 'CLINIC')
);

INSERT INTO "Department" ("id", "organizationId", "code", "name", "cashPoint")
SELECT gen_random_uuid()::text, hp."organizationId", 'RETAIL', 'Retail', 'RETAIL'
FROM "HotelProfile" hp
WHERE NOT EXISTS (
  SELECT 1 FROM "Department" d
  WHERE d."organizationId" = hp."organizationId" AND (d.code = 'RETAIL' OR d."cashPoint" = 'RETAIL')
);

ALTER TABLE "GuestDebtPayment" ADD COLUMN "businessDate" DATE;
UPDATE "GuestDebtPayment"
SET "businessDate" = (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Baku')::date
WHERE "businessDate" IS NULL;
ALTER TABLE "GuestDebtPayment" ALTER COLUMN "businessDate" SET NOT NULL;
CREATE INDEX "GuestDebtPayment_organizationId_businessDate_idx"
  ON "GuestDebtPayment"("organizationId", "businessDate");

ALTER TABLE "FolioDeposit" ADD COLUMN "businessDate" DATE;
UPDATE "FolioDeposit"
SET "businessDate" = (("heldAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Baku')::date
WHERE "businessDate" IS NULL;
ALTER TABLE "FolioDeposit" ALTER COLUMN "businessDate" SET NOT NULL;
CREATE INDEX "FolioDeposit_organizationId_businessDate_idx"
  ON "FolioDeposit"("organizationId", "businessDate");

CREATE TABLE "HotelYearBoundary" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelYearBoundary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelYearBoundary_organizationId_year_kind_key"
  ON "HotelYearBoundary"("organizationId", "year", "kind");
CREATE INDEX "HotelYearBoundary_organizationId_idx" ON "HotelYearBoundary"("organizationId");
