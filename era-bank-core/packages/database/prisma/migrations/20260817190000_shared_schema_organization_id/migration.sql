-- SHARED-schema: additive organizationId (CP-TENANT-01 / B7). No SHARED bank pool this edition.
CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);

ALTER TABLE "gl_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gl_accounts' AND column_name = 'bank_org_id') THEN UPDATE "gl_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "gl_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "gl_accounts_organization_id_idx" ON "gl_accounts"("organization_id");

ALTER TABLE "system_gl_configs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_gl_configs' AND column_name = 'bank_org_id') THEN UPDATE "system_gl_configs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "system_gl_configs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "system_gl_configs_organization_id_idx" ON "system_gl_configs"("organization_id");

ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branches' AND column_name = 'bank_org_id') THEN UPDATE "branches" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "branches" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "branches_organization_id_idx" ON "branches"("organization_id");

ALTER TABLE "branch_limits" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branch_limits' AND column_name = 'bank_org_id') THEN UPDATE "branch_limits" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "branch_limits" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "branch_limits_organization_id_idx" ON "branch_limits"("organization_id");

ALTER TABLE "bank_customers" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_customers' AND column_name = 'bank_org_id') THEN UPDATE "bank_customers" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "bank_customers" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "bank_customers_organization_id_idx" ON "bank_customers"("organization_id");

ALTER TABLE "beneficial_owners" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'beneficial_owners' AND column_name = 'bank_org_id') THEN UPDATE "beneficial_owners" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "beneficial_owners" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "beneficial_owners_organization_id_idx" ON "beneficial_owners"("organization_id");

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'bank_org_id') THEN UPDATE "accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "accounts_iban_key";
DROP INDEX IF EXISTS "accounts_iban_key";
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_organization_id_iban_key" ON "accounts"("organization_id", "iban");
CREATE INDEX IF NOT EXISTS "accounts_organization_id_idx" ON "accounts"("organization_id");

ALTER TABLE "account_holds" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'account_holds' AND column_name = 'bank_org_id') THEN UPDATE "account_holds" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "account_holds" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "account_holds_organization_id_idx" ON "account_holds"("organization_id");

ALTER TABLE "journal_transactions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_transactions' AND column_name = 'bank_org_id') THEN UPDATE "journal_transactions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "journal_transactions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "journal_transactions_idempotencyKey_key";
DROP INDEX IF EXISTS "journal_transactions_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "journal_transactions_organization_id_idempotencyKey_key" ON "journal_transactions"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "journal_transactions_organization_id_idx" ON "journal_transactions"("organization_id");

ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'bank_org_id') THEN UPDATE "journal_entries" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "journal_entries" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "journal_entries_organization_id_idx" ON "journal_entries"("organization_id");

ALTER TABLE "product_templates" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_templates' AND column_name = 'bank_org_id') THEN UPDATE "product_templates" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "product_templates" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "product_templates_organization_id_idx" ON "product_templates"("organization_id");

ALTER TABLE "eod_runs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'eod_runs' AND column_name = 'bank_org_id') THEN UPDATE "eod_runs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "eod_runs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "eod_runs_organization_id_idx" ON "eod_runs"("organization_id");

ALTER TABLE "audit_log_entries" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_log_entries' AND column_name = 'bank_org_id') THEN UPDATE "audit_log_entries" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "audit_log_entries" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "audit_log_entries_organization_id_idx" ON "audit_log_entries"("organization_id");

ALTER TABLE "payment_orders" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_orders' AND column_name = 'bank_org_id') THEN UPDATE "payment_orders" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "payment_orders" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "payment_orders_idempotencyKey_key";
DROP INDEX IF EXISTS "payment_orders_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_organization_id_idempotencyKey_key" ON "payment_orders"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "payment_orders_organization_id_idx" ON "payment_orders"("organization_id");

ALTER TABLE "payment_rail_messages" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_rail_messages' AND column_name = 'bank_org_id') THEN UPDATE "payment_rail_messages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "payment_rail_messages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "payment_rail_messages_organization_id_idx" ON "payment_rail_messages"("organization_id");

ALTER TABLE "deposit_contracts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'deposit_contracts' AND column_name = 'bank_org_id') THEN UPDATE "deposit_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "deposit_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "deposit_contracts_organization_id_idx" ON "deposit_contracts"("organization_id");

ALTER TABLE "loan_contracts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loan_contracts' AND column_name = 'bank_org_id') THEN UPDATE "loan_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "loan_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "loan_contracts_organization_id_idx" ON "loan_contracts"("organization_id");

ALTER TABLE "loan_schedule_installments" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loan_schedule_installments' AND column_name = 'bank_org_id') THEN UPDATE "loan_schedule_installments" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "loan_schedule_installments" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "loan_schedule_installments_organization_id_idx" ON "loan_schedule_installments"("organization_id");

ALTER TABLE "ecl_calculation_runs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ecl_calculation_runs' AND column_name = 'bank_org_id') THEN UPDATE "ecl_calculation_runs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "ecl_calculation_runs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "ecl_calculation_runs_organization_id_idx" ON "ecl_calculation_runs"("organization_id");

ALTER TABLE "ecl_results" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ecl_results' AND column_name = 'bank_org_id') THEN UPDATE "ecl_results" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "ecl_results" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "ecl_results_organization_id_idx" ON "ecl_results"("organization_id");

ALTER TABLE "rate_index_quotes" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rate_index_quotes' AND column_name = 'bank_org_id') THEN UPDATE "rate_index_quotes" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "rate_index_quotes" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "rate_index_quotes_organization_id_idx" ON "rate_index_quotes"("organization_id");

ALTER TABLE "rwa_snapshots" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rwa_snapshots' AND column_name = 'bank_org_id') THEN UPDATE "rwa_snapshots" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "rwa_snapshots" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "rwa_snapshots_organization_id_idx" ON "rwa_snapshots"("organization_id");

ALTER TABLE "capital_adequacy_snapshots" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'capital_adequacy_snapshots' AND column_name = 'bank_org_id') THEN UPDATE "capital_adequacy_snapshots" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "capital_adequacy_snapshots" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "capital_adequacy_snapshots_organization_id_idx" ON "capital_adequacy_snapshots"("organization_id");

ALTER TABLE "ecl_parameter_sets" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'ecl_parameter_sets' AND column_name = 'bank_org_id') THEN UPDATE "ecl_parameter_sets" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "ecl_parameter_sets" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "ecl_parameter_sets_organization_id_idx" ON "ecl_parameter_sets"("organization_id");

ALTER TABLE "aml_rules" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'aml_rules' AND column_name = 'bank_org_id') THEN UPDATE "aml_rules" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "aml_rules" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "aml_rules_organization_id_idx" ON "aml_rules"("organization_id");

ALTER TABLE "aml_alerts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'aml_alerts' AND column_name = 'bank_org_id') THEN UPDATE "aml_alerts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "aml_alerts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "aml_alerts_organization_id_idx" ON "aml_alerts"("organization_id");

ALTER TABLE "aml_screening_hits" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'aml_screening_hits' AND column_name = 'bank_org_id') THEN UPDATE "aml_screening_hits" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "aml_screening_hits" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "aml_screening_hits_organization_id_idx" ON "aml_screening_hits"("organization_id");

ALTER TABLE "fmn_reports" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fmn_reports' AND column_name = 'bank_org_id') THEN UPDATE "fmn_reports" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "fmn_reports" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "fmn_reports_organization_id_idx" ON "fmn_reports"("organization_id");

ALTER TABLE "reg_report_runs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reg_report_runs' AND column_name = 'bank_org_id') THEN UPDATE "reg_report_runs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "reg_report_runs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "reg_report_runs_organization_id_idx" ON "reg_report_runs"("organization_id");

ALTER TABLE "fatca_crs_classifications" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fatca_crs_classifications' AND column_name = 'bank_org_id') THEN UPDATE "fatca_crs_classifications" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "fatca_crs_classifications" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "fatca_crs_classifications_organization_id_idx" ON "fatca_crs_classifications"("organization_id");

ALTER TABLE "dbo_customer_credentials" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dbo_customer_credentials' AND column_name = 'bank_org_id') THEN UPDATE "dbo_customer_credentials" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "dbo_customer_credentials" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "dbo_customer_credentials_organization_id_idx" ON "dbo_customer_credentials"("organization_id");

ALTER TABLE "dbo_otp_challenges" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dbo_otp_challenges' AND column_name = 'bank_org_id') THEN UPDATE "dbo_otp_challenges" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "dbo_otp_challenges" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "dbo_otp_challenges_organization_id_idx" ON "dbo_otp_challenges"("organization_id");

ALTER TABLE "corporate_signatories" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'corporate_signatories' AND column_name = 'bank_org_id') THEN UPDATE "corporate_signatories" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "corporate_signatories" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "corporate_signatories_organization_id_idx" ON "corporate_signatories"("organization_id");

ALTER TABLE "card_products" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'card_products' AND column_name = 'bank_org_id') THEN UPDATE "card_products" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "card_products" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "card_products_productTemplateId_key";
DROP INDEX IF EXISTS "card_products_product_template_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "card_products_organization_id_productTemplateId_key" ON "card_products"("organization_id", "product_template_id");
CREATE INDEX IF NOT EXISTS "card_products_organization_id_idx" ON "card_products"("organization_id");

ALTER TABLE "cards" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cards' AND column_name = 'bank_org_id') THEN UPDATE "cards" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "cards" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "cards_cardToken_key";
DROP INDEX IF EXISTS "cards_card_token_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cards_organization_id_cardToken_key" ON "cards"("organization_id", "card_token");
CREATE INDEX IF NOT EXISTS "cards_organization_id_idx" ON "cards"("organization_id");

ALTER TABLE "card_transactions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'card_transactions' AND column_name = 'bank_org_id') THEN UPDATE "card_transactions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "card_transactions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "card_transactions_processorRef_key";
DROP INDEX IF EXISTS "card_transactions_processor_ref_key";
CREATE UNIQUE INDEX IF NOT EXISTS "card_transactions_organization_id_processorRef_key" ON "card_transactions"("organization_id", "processor_ref");
CREATE INDEX IF NOT EXISTS "card_transactions_organization_id_idx" ON "card_transactions"("organization_id");

ALTER TABLE "card_processor_messages" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'card_processor_messages' AND column_name = 'bank_org_id') THEN UPDATE "card_processor_messages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "card_processor_messages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "card_processor_messages_organization_id_idx" ON "card_processor_messages"("organization_id");

ALTER TABLE "treasury_counterparties" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'treasury_counterparties' AND column_name = 'bank_org_id') THEN UPDATE "treasury_counterparties" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "treasury_counterparties" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "treasury_counterparties_organization_id_idx" ON "treasury_counterparties"("organization_id");

ALTER TABLE "nostro_vostro_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'nostro_vostro_accounts' AND column_name = 'bank_org_id') THEN UPDATE "nostro_vostro_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "nostro_vostro_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "nostro_vostro_accounts_iban_key";
DROP INDEX IF EXISTS "nostro_vostro_accounts_iban_key";
CREATE UNIQUE INDEX IF NOT EXISTS "nostro_vostro_accounts_organization_id_iban_key" ON "nostro_vostro_accounts"("organization_id", "iban");
CREATE INDEX IF NOT EXISTS "nostro_vostro_accounts_organization_id_idx" ON "nostro_vostro_accounts"("organization_id");

ALTER TABLE "fx_deals" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fx_deals' AND column_name = 'bank_org_id') THEN UPDATE "fx_deals" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "fx_deals" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "fx_deals_idempotencyKey_key";
DROP INDEX IF EXISTS "fx_deals_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "fx_deals_organization_id_idempotencyKey_key" ON "fx_deals"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "fx_deals_organization_id_idx" ON "fx_deals"("organization_id");

ALTER TABLE "interbank_placements" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'interbank_placements' AND column_name = 'bank_org_id') THEN UPDATE "interbank_placements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "interbank_placements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "interbank_placements_organization_id_idx" ON "interbank_placements"("organization_id");

ALTER TABLE "gov_security_positions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'gov_security_positions' AND column_name = 'bank_org_id') THEN UPDATE "gov_security_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "gov_security_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "gov_security_positions_organization_id_idx" ON "gov_security_positions"("organization_id");

ALTER TABLE "liquidity_gap_snapshots" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'liquidity_gap_snapshots' AND column_name = 'bank_org_id') THEN UPDATE "liquidity_gap_snapshots" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "liquidity_gap_snapshots" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "liquidity_gap_snapshots_organization_id_idx" ON "liquidity_gap_snapshots"("organization_id");

ALTER TABLE "fee_tariffs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fee_tariffs' AND column_name = 'bank_org_id') THEN UPDATE "fee_tariffs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "fee_tariffs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "fee_tariffs_organization_id_idx" ON "fee_tariffs"("organization_id");

ALTER TABLE "relationship_packages" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'relationship_packages' AND column_name = 'bank_org_id') THEN UPDATE "relationship_packages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "relationship_packages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "relationship_packages_organization_id_idx" ON "relationship_packages"("organization_id");

ALTER TABLE "relationship_package_tariffs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'relationship_package_tariffs' AND column_name = 'bank_org_id') THEN UPDATE "relationship_package_tariffs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "relationship_package_tariffs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "relationship_package_tariffs_organization_id_idx" ON "relationship_package_tariffs"("organization_id");

ALTER TABLE "relationship_package_links" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'relationship_package_links' AND column_name = 'bank_org_id') THEN UPDATE "relationship_package_links" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "relationship_package_links" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "relationship_package_links_organization_id_idx" ON "relationship_package_links"("organization_id");

ALTER TABLE "safe_deposit_boxes" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'safe_deposit_boxes' AND column_name = 'bank_org_id') THEN UPDATE "safe_deposit_boxes" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "safe_deposit_boxes" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "safe_deposit_boxes_organization_id_idx" ON "safe_deposit_boxes"("organization_id");

ALTER TABLE "cash_movements" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cash_movements' AND column_name = 'bank_org_id') THEN UPDATE "cash_movements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "cash_movements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "cash_movements_idempotencyKey_key";
DROP INDEX IF EXISTS "cash_movements_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cash_movements_organization_id_idempotencyKey_key" ON "cash_movements"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "cash_movements_organization_id_idx" ON "cash_movements"("organization_id");

ALTER TABLE "inventory_items" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'bank_org_id') THEN UPDATE "inventory_items" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "inventory_items" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "inventory_items_organization_id_idx" ON "inventory_items"("organization_id");

ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory_movements' AND column_name = 'bank_org_id') THEN UPDATE "inventory_movements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "inventory_movements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "inventory_movements_organization_id_idx" ON "inventory_movements"("organization_id");

ALTER TABLE "branch_queue_tickets" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'branch_queue_tickets' AND column_name = 'bank_org_id') THEN UPDATE "branch_queue_tickets" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "branch_queue_tickets" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "branch_queue_tickets_organization_id_idx" ON "branch_queue_tickets"("organization_id");

ALTER TABLE "collateral_valuations" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collateral_valuations' AND column_name = 'bank_org_id') THEN UPDATE "collateral_valuations" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "collateral_valuations" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "collateral_valuations_organization_id_idx" ON "collateral_valuations"("organization_id");

ALTER TABLE "lien_registers" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'lien_registers' AND column_name = 'bank_org_id') THEN UPDATE "lien_registers" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "lien_registers" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "lien_registers_organization_id_idx" ON "lien_registers"("organization_id");

ALTER TABLE "credit_decision_requests" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_decision_requests' AND column_name = 'bank_org_id') THEN UPDATE "credit_decision_requests" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "credit_decision_requests" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "credit_decision_requests_organization_id_idx" ON "credit_decision_requests"("organization_id");

ALTER TABLE "loan_applications" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loan_applications' AND column_name = 'bank_org_id') THEN UPDATE "loan_applications" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "loan_applications" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "loan_applications_organization_id_idx" ON "loan_applications"("organization_id");

ALTER TABLE "credit_policy_rules" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_policy_rules' AND column_name = 'bank_org_id') THEN UPDATE "credit_policy_rules" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "credit_policy_rules" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "credit_policy_rules_organization_id_idx" ON "credit_policy_rules"("organization_id");

ALTER TABLE "credit_lines" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_lines' AND column_name = 'bank_org_id') THEN UPDATE "credit_lines" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "credit_lines" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "credit_lines_organization_id_idx" ON "credit_lines"("organization_id");

ALTER TABLE "credit_line_drawdowns" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'credit_line_drawdowns' AND column_name = 'bank_org_id') THEN UPDATE "credit_line_drawdowns" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "credit_line_drawdowns" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "credit_line_drawdowns_idempotencyKey_key";
DROP INDEX IF EXISTS "credit_line_drawdowns_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "credit_line_drawdowns_organization_id_idempotencyKey_key" ON "credit_line_drawdowns"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "credit_line_drawdowns_organization_id_idx" ON "credit_line_drawdowns"("organization_id");

ALTER TABLE "collection_cases" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collection_cases' AND column_name = 'bank_org_id') THEN UPDATE "collection_cases" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "collection_cases" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "collection_cases_organization_id_idx" ON "collection_cases"("organization_id");

ALTER TABLE "collection_promises_to_pay" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'collection_promises_to_pay' AND column_name = 'bank_org_id') THEN UPDATE "collection_promises_to_pay" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "collection_promises_to_pay" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "collection_promises_to_pay_organization_id_idx" ON "collection_promises_to_pay"("organization_id");

ALTER TABLE "standing_orders" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'standing_orders' AND column_name = 'bank_org_id') THEN UPDATE "standing_orders" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "standing_orders" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "standing_orders_idempotencyKey_key";
DROP INDEX IF EXISTS "standing_orders_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "standing_orders_organization_id_idempotencyKey_key" ON "standing_orders"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "standing_orders_organization_id_idx" ON "standing_orders"("organization_id");

ALTER TABLE "direct_debit_mandates" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'direct_debit_mandates' AND column_name = 'bank_org_id') THEN UPDATE "direct_debit_mandates" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "direct_debit_mandates" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "direct_debit_mandates_organization_id_idx" ON "direct_debit_mandates"("organization_id");

ALTER TABLE "virtual_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'virtual_accounts' AND column_name = 'bank_org_id') THEN UPDATE "virtual_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "virtual_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "virtual_accounts_organization_id_idx" ON "virtual_accounts"("organization_id");

ALTER TABLE "cash_pool_sweep_rules" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cash_pool_sweep_rules' AND column_name = 'bank_org_id') THEN UPDATE "cash_pool_sweep_rules" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "cash_pool_sweep_rules" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "cash_pool_sweep_rules_organization_id_idx" ON "cash_pool_sweep_rules"("organization_id");

ALTER TABLE "cheque_instruments" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cheque_instruments' AND column_name = 'bank_org_id') THEN UPDATE "cheque_instruments" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "cheque_instruments" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "cheque_instruments_organization_id_idx" ON "cheque_instruments"("organization_id");

ALTER TABLE "letters_of_credit" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'letters_of_credit' AND column_name = 'bank_org_id') THEN UPDATE "letters_of_credit" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "letters_of_credit" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "letters_of_credit_organization_id_idx" ON "letters_of_credit"("organization_id");

ALTER TABLE "trade_lc_amendments" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trade_lc_amendments' AND column_name = 'bank_org_id') THEN UPDATE "trade_lc_amendments" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "trade_lc_amendments" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "trade_lc_amendments_organization_id_idx" ON "trade_lc_amendments"("organization_id");

ALTER TABLE "bank_guarantees" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bank_guarantees' AND column_name = 'bank_org_id') THEN UPDATE "bank_guarantees" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "bank_guarantees" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "bank_guarantees_organization_id_idx" ON "bank_guarantees"("organization_id");

ALTER TABLE "documentary_collections" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documentary_collections' AND column_name = 'bank_org_id') THEN UPDATE "documentary_collections" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "documentary_collections" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "documentary_collections_organization_id_idx" ON "documentary_collections"("organization_id");

ALTER TABLE "scf_programs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scf_programs' AND column_name = 'bank_org_id') THEN UPDATE "scf_programs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "scf_programs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "scf_programs_organization_id_idx" ON "scf_programs"("organization_id");

ALTER TABLE "money_market_placements" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'money_market_placements' AND column_name = 'bank_org_id') THEN UPDATE "money_market_placements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "money_market_placements" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
DROP INDEX IF EXISTS "money_market_placements_idempotencyKey_key";
DROP INDEX IF EXISTS "money_market_placements_idempotency_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "money_market_placements_organization_id_idempotencyKey_key" ON "money_market_placements"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "money_market_placements_organization_id_idx" ON "money_market_placements"("organization_id");

ALTER TABLE "acquiring_merchants" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'acquiring_merchants' AND column_name = 'bank_org_id') THEN UPDATE "acquiring_merchants" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "acquiring_merchants" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "acquiring_merchants_organization_id_idx" ON "acquiring_merchants"("organization_id");

ALTER TABLE "trade_swift_messages" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trade_swift_messages' AND column_name = 'bank_org_id') THEN UPDATE "trade_swift_messages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "trade_swift_messages" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "trade_swift_messages_organization_id_idx" ON "trade_swift_messages"("organization_id");

ALTER TABLE "card_dispute_cases" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'card_dispute_cases' AND column_name = 'bank_org_id') THEN UPDATE "card_dispute_cases" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "card_dispute_cases" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "card_dispute_cases_organization_id_idx" ON "card_dispute_cases"("organization_id");

ALTER TABLE "three_ds_challenges" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'three_ds_challenges' AND column_name = 'bank_org_id') THEN UPDATE "three_ds_challenges" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "three_ds_challenges" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "three_ds_challenges_organization_id_idx" ON "three_ds_challenges"("organization_id");

ALTER TABLE "safekeeping_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'safekeeping_accounts' AND column_name = 'bank_org_id') THEN UPDATE "safekeeping_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "safekeeping_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "safekeeping_accounts_organization_id_idx" ON "safekeeping_accounts"("organization_id");

ALTER TABLE "custody_positions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'custody_positions' AND column_name = 'bank_org_id') THEN UPDATE "custody_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "custody_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "custody_positions_organization_id_idx" ON "custody_positions"("organization_id");

ALTER TABLE "custody_position_ledger" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'custody_position_ledger' AND column_name = 'bank_org_id') THEN UPDATE "custody_position_ledger" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "custody_position_ledger" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "custody_position_ledger_organization_id_idx" ON "custody_position_ledger"("organization_id");

ALTER TABLE "insurance_products" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_products' AND column_name = 'bank_org_id') THEN UPDATE "insurance_products" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "insurance_products" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "insurance_products_organization_id_idx" ON "insurance_products"("organization_id");

ALTER TABLE "insurance_policy_links" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_policy_links' AND column_name = 'bank_org_id') THEN UPDATE "insurance_policy_links" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "insurance_policy_links" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "insurance_policy_links_organization_id_idx" ON "insurance_policy_links"("organization_id");

ALTER TABLE "islamic_contracts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'islamic_contracts' AND column_name = 'bank_org_id') THEN UPDATE "islamic_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "islamic_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "islamic_contracts_organization_id_idx" ON "islamic_contracts"("organization_id");

ALTER TABLE "dbo_h2h_file_jobs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dbo_h2h_file_jobs' AND column_name = 'bank_org_id') THEN UPDATE "dbo_h2h_file_jobs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "dbo_h2h_file_jobs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "dbo_h2h_file_jobs_organization_id_idx" ON "dbo_h2h_file_jobs"("organization_id");

ALTER TABLE "open_banking_consents" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'open_banking_consents' AND column_name = 'bank_org_id') THEN UPDATE "open_banking_consents" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "open_banking_consents" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "open_banking_consents_organization_id_idx" ON "open_banking_consents"("organization_id");

ALTER TABLE "aml_cases" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'aml_cases' AND column_name = 'bank_org_id') THEN UPDATE "aml_cases" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "aml_cases" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "aml_cases_organization_id_idx" ON "aml_cases"("organization_id");

ALTER TABLE "fraud_score_requests" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fraud_score_requests' AND column_name = 'bank_org_id') THEN UPDATE "fraud_score_requests" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "fraud_score_requests" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "fraud_score_requests_organization_id_idx" ON "fraud_score_requests"("organization_id");

ALTER TABLE "irrbb_inputs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'irrbb_inputs' AND column_name = 'bank_org_id') THEN UPDATE "irrbb_inputs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "irrbb_inputs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "irrbb_inputs_organization_id_idx" ON "irrbb_inputs"("organization_id");

ALTER TABLE "oprisk_loss_events" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'oprisk_loss_events' AND column_name = 'bank_org_id') THEN UPDATE "oprisk_loss_events" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "oprisk_loss_events" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "oprisk_loss_events_organization_id_idx" ON "oprisk_loss_events"("organization_id");

ALTER TABLE "insurance_affiliate_commissions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'insurance_affiliate_commissions' AND column_name = 'bank_org_id') THEN UPDATE "insurance_affiliate_commissions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "insurance_affiliate_commissions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "insurance_affiliate_commissions_organization_id_idx" ON "insurance_affiliate_commissions"("organization_id");

ALTER TABLE "atm_terminals" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'atm_terminals' AND column_name = 'bank_org_id') THEN UPDATE "atm_terminals" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "atm_terminals" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "atm_terminals_organization_id_idx" ON "atm_terminals"("organization_id");

ALTER TABLE "atm_txns" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'atm_txns' AND column_name = 'bank_org_id') THEN UPDATE "atm_txns" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "atm_txns" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "atm_txns_organization_id_idx" ON "atm_txns"("organization_id");

ALTER TABLE "scheme_message_outbox" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'scheme_message_outbox' AND column_name = 'bank_org_id') THEN UPDATE "scheme_message_outbox" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "scheme_message_outbox" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "scheme_message_outbox_organization_id_idx" ON "scheme_message_outbox"("organization_id");

ALTER TABLE "derivative_contracts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'derivative_contracts' AND column_name = 'bank_org_id') THEN UPDATE "derivative_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "derivative_contracts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "derivative_contracts_organization_id_idx" ON "derivative_contracts"("organization_id");

ALTER TABLE "bond_positions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bond_positions' AND column_name = 'bank_org_id') THEN UPDATE "bond_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "bond_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "bond_positions_organization_id_idx" ON "bond_positions"("organization_id");

ALTER TABLE "csd_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'csd_accounts' AND column_name = 'bank_org_id') THEN UPDATE "csd_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "csd_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "csd_accounts_organization_id_idx" ON "csd_accounts"("organization_id");

ALTER TABLE "brokerage_orders" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'brokerage_orders' AND column_name = 'bank_org_id') THEN UPDATE "brokerage_orders" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "brokerage_orders" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "brokerage_orders_organization_id_idx" ON "brokerage_orders"("organization_id");

ALTER TABLE "metal_positions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'metal_positions' AND column_name = 'bank_org_id') THEN UPDATE "metal_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "metal_positions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "metal_positions_organization_id_idx" ON "metal_positions"("organization_id");

ALTER TABLE "pension_contributions" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pension_contributions' AND column_name = 'bank_org_id') THEN UPDATE "pension_contributions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "pension_contributions" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "pension_contributions_organization_id_idx" ON "pension_contributions"("organization_id");

ALTER TABLE "psa_tsa_accounts" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'psa_tsa_accounts' AND column_name = 'bank_org_id') THEN UPDATE "psa_tsa_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "psa_tsa_accounts" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "psa_tsa_accounts_organization_id_idx" ON "psa_tsa_accounts"("organization_id");

ALTER TABLE "agency_links" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'agency_links' AND column_name = 'bank_org_id') THEN UPDATE "agency_links" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "agency_links" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "agency_links_organization_id_idx" ON "agency_links"("organization_id");

ALTER TABLE "mis_report_jobs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'mis_report_jobs' AND column_name = 'bank_org_id') THEN UPDATE "mis_report_jobs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "mis_report_jobs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "mis_report_jobs_organization_id_idx" ON "mis_report_jobs"("organization_id");

ALTER TABLE "bpm_process_stubs" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bpm_process_stubs' AND column_name = 'bank_org_id') THEN UPDATE "bpm_process_stubs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "bpm_process_stubs" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "bpm_process_stubs_organization_id_idx" ON "bpm_process_stubs"("organization_id");

ALTER TABLE "dms_document_meta" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'dms_document_meta' AND column_name = 'bank_org_id') THEN UPDATE "dms_document_meta" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ELSE UPDATE "dms_document_meta" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; END IF; END $$;
CREATE INDEX IF NOT EXISTS "dms_document_meta_organization_id_idx" ON "dms_document_meta"("organization_id");

