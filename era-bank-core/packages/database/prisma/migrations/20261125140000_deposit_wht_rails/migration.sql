-- Deposit interest withholding tax accrual + monthly interest tracker for WHT
ALTER TABLE "deposit_contracts" ADD COLUMN "tax_accrued_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "deposit_contracts" ADD COLUMN "month_interest_accrued_minor" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "deposit_contracts" ADD COLUMN "interest_accrual_month" TEXT;