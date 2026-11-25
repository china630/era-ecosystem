-- CRM Wave C1: selections + warranty

CREATE TYPE "SelectionPackageStatus" AS ENUM ('OPEN', 'APPROVED', 'CLOSED');
CREATE TYPE "WarrantyCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

CREATE TABLE "SelectionPackage" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "status" "SelectionPackageStatus" NOT NULL DEFAULT 'OPEN',
  "allowance" DECIMAL(12,2),
  "finance_contract_id" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SelectionPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SelectionItem" (
  "id" TEXT NOT NULL,
  "packageId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SelectionItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarrantyCase" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "WarrantyCaseStatus" NOT NULL DEFAULT 'OPEN',
  "partyRef" TEXT,
  "construction_project_id" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WarrantyCase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SelectionPackage_organization_id_idx" ON "SelectionPackage"("organization_id");
CREATE INDEX "SelectionPackage_leadId_idx" ON "SelectionPackage"("leadId");
CREATE INDEX "SelectionItem_packageId_idx" ON "SelectionItem"("packageId");
CREATE INDEX "WarrantyCase_organization_id_idx" ON "WarrantyCase"("organization_id");
CREATE INDEX "WarrantyCase_leadId_idx" ON "WarrantyCase"("leadId");

ALTER TABLE "SelectionPackage" ADD CONSTRAINT "SelectionPackage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SelectionItem" ADD CONSTRAINT "SelectionItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "SelectionPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarrantyCase" ADD CONSTRAINT "WarrantyCase_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
