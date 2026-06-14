-- ProcedureCompatibilityRule for Nafta sanatorium protocol pack (H-BL-28)

CREATE TYPE "ProcedureCompatibilityRuleType" AS ENUM ('FORBID_SAME_DAY', 'MIN_HOURS_GAP', 'FORBID_SEQUENCE');

CREATE TABLE "ProcedureCompatibilityRule" (
    "id" TEXT NOT NULL,
    "procedureCodeA" TEXT NOT NULL,
    "procedureCodeB" TEXT NOT NULL,
    "ruleType" "ProcedureCompatibilityRuleType" NOT NULL,
    "minHours" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcedureCompatibilityRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProcedureCompatibilityRule_procedureCodeA_idx" ON "ProcedureCompatibilityRule"("procedureCodeA");
CREATE INDEX "ProcedureCompatibilityRule_procedureCodeB_idx" ON "ProcedureCompatibilityRule"("procedureCodeB");
CREATE INDEX "ProcedureCompatibilityRule_active_idx" ON "ProcedureCompatibilityRule"("active");
