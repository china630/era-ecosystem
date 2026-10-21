-- Citizenship is explicit. An omitted value must not become AZ.
ALTER TABLE "Guest" ALTER COLUMN "nationality" DROP DEFAULT;
ALTER TABLE "Guest" ALTER COLUMN "nationality" DROP NOT NULL;
