-- Employee HR reminder fields (contract end, birthday)
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "date_of_birth" DATE;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "contract_end_date" DATE;
