-- Citizenship is explicit. An omitted value must not become AZ.
ALTER TABLE "global_natural_persons" ALTER COLUMN "nationality" DROP DEFAULT;
