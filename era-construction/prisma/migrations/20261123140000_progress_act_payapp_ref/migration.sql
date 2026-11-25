-- Soft ref: Construction act → Finance PayApplication (ops only; no ledger here).
ALTER TABLE "ProgressAct" ADD COLUMN IF NOT EXISTS "finance_pay_app_id" TEXT;
