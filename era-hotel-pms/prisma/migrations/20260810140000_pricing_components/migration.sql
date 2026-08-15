-- Versioned pricing components (service fee, meals, COGS) for BAR accounting base.

CREATE TYPE "PricingComponentKind" AS ENUM ('SERVICE_FEE', 'MEAL', 'FOOD_COGS', 'MEDICAL_COGS', 'OTHER');
CREATE TYPE "PricingAmountUnit" AS ENUM ('PER_PERSON_NIGHT', 'PER_PERSON_MEAL', 'PER_PERSON_DAY');

CREATE TABLE "PricingComponent" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "PricingComponentKind" NOT NULL,
    "unit" "PricingAmountUnit" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PricingComponent_code_key" ON "PricingComponent"("code");
CREATE INDEX "PricingComponent_kind_sortOrder_idx" ON "PricingComponent"("kind", "sortOrder");

CREATE TABLE "PricingComponentVersion" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "sellAmount" DECIMAL(12,2),
    "cogsAmount" DECIMAL(12,2),
    "currencyCode" TEXT NOT NULL DEFAULT 'AZN',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingComponentVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PricingComponentVersion_componentId_effectiveFrom_idx" ON "PricingComponentVersion"("componentId", "effectiveFrom");
CREATE INDEX "PricingComponentVersion_effectiveFrom_effectiveTo_idx" ON "PricingComponentVersion"("effectiveFrom", "effectiveTo");

ALTER TABLE "PricingComponentVersion" ADD CONSTRAINT "PricingComponentVersion_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "PricingComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
