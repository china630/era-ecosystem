-- AlterEnum → text for payroll component codes (ADR managed-lists A6)
ALTER TABLE "payroll_components" ALTER COLUMN "code" TYPE TEXT USING ("code"::text);
ALTER TABLE "payroll_slip_lines" ALTER COLUMN "code" TYPE TEXT USING ("code"::text);
DROP TYPE IF EXISTS "PayrollComponentCode";
