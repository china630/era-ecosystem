CREATE TYPE "ExtraProcedureRoute" AS ENUM ('SHOW_ON_PLAN', 'HOLD_UNTIL_PAY');

ALTER TABLE "Tenant" ADD COLUMN "extra_procedure_route" "ExtraProcedureRoute" NOT NULL DEFAULT 'SHOW_ON_PLAN';
