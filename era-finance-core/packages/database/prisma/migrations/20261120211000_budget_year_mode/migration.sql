-- Commercial management budget mode on BudgetYear (FIN-BUDGET-COMM-01)
ALTER TABLE "budget_years" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'GOV';
CREATE INDEX IF NOT EXISTS "budget_years_organization_id_mode_idx" ON "budget_years"("organization_id", "mode");
