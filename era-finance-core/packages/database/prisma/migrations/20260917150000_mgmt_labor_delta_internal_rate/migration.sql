-- Wave 5: Employee.internalRate + MgmtLaborDelta (MGMT labor cost only)

ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "internal_rate" DECIMAL(19,4);

CREATE TABLE IF NOT EXISTS "mgmt_labor_deltas" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_hours" DECIMAL(19,4) NOT NULL,
    "month_norm_hours" DECIMAL(19,4) NOT NULL,
    "mgmt_gross" DECIMAL(19,4) NOT NULL,
    "stat_gross" DECIMAL(19,4) NOT NULL,
    "delta" DECIMAL(19,4) NOT NULL,
    "accounting_book_id" UUID NOT NULL,
    "transaction_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mgmt_labor_deltas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mgmt_labor_deltas_org_ym_emp_uidx"
  ON "mgmt_labor_deltas"("organization_id", "year", "month", "employee_id");

CREATE INDEX IF NOT EXISTS "mgmt_labor_deltas_organization_id_year_month_idx"
  ON "mgmt_labor_deltas"("organization_id", "year", "month");

DO $$ BEGIN
  ALTER TABLE "mgmt_labor_deltas"
    ADD CONSTRAINT "mgmt_labor_deltas_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "mgmt_labor_deltas"
    ADD CONSTRAINT "mgmt_labor_deltas_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
