-- Night audit selects folio tenders by the cashier business day, not createdAt.
ALTER TABLE "FolioPayment" ADD COLUMN "businessDate" DATE;

UPDATE "FolioPayment"
SET "businessDate" = ("createdAt" AT TIME ZONE 'UTC')::date
WHERE "businessDate" IS NULL;

ALTER TABLE "FolioPayment" ALTER COLUMN "businessDate" SET NOT NULL;
ALTER TABLE "FolioPayment" ALTER COLUMN "businessDate" SET DEFAULT CURRENT_DATE;
