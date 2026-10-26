ALTER TABLE "Tenant" ALTER COLUMN "extra_procedure_route" SET DEFAULT 'PLAN_BEFORE_PAY';

UPDATE "Tenant"
SET "extra_procedure_route" = 'PLAN_BEFORE_PAY'
WHERE "extra_procedure_route" = 'SHOW_ON_PLAN';
