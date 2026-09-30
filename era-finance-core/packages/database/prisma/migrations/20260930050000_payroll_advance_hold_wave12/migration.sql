-- Wave 12: hold ADVANCE lines until a DRAFT payroll run exists (never POSTED here)

CREATE TABLE IF NOT EXISTS "payroll_advance_holds" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "employee_id" UUID NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" DECIMAL(19, 4) NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "applied_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "payroll_advance_holds_org_period_idx"
  ON "payroll_advance_holds"("organization_id", "year", "month", "applied_at");
