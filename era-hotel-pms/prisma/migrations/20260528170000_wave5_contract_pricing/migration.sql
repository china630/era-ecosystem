-- Wave 5 NW-3: contract discounts & supplements (PROC-24)
CREATE TYPE "ContractPricingRuleType" AS ENUM ('DISCOUNT', 'SUPPLEMENT');

CREATE TABLE "ContractPricingRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "agencyId" TEXT,
    "ratePlanId" TEXT NOT NULL,
    "ruleType" "ContractPricingRuleType" NOT NULL,
    "valuePercent" DECIMAL(5,2) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractPricingRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractPricingRule_agencyId_ratePlanId_idx" ON "ContractPricingRule"("agencyId", "ratePlanId");
CREATE INDEX "ContractPricingRule_validFrom_validTo_idx" ON "ContractPricingRule"("validFrom", "validTo");

ALTER TABLE "ContractPricingRule" ADD CONSTRAINT "ContractPricingRule_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ContractPricingRule" ADD CONSTRAINT "ContractPricingRule_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
