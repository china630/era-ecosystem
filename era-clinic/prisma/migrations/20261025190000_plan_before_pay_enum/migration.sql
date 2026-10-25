-- New values cannot be used until the next migration commits.
ALTER TYPE "ExtraProcedureRoute" ADD VALUE 'PLAN_BEFORE_PAY';
ALTER TYPE "ProcedureOrderStatus" ADD VALUE 'UNPAID_MISSED';
