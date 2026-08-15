-- CRM T1 catalogs (ADR managed-lists A5)
CREATE TYPE "CrmLookupKind" AS ENUM ('CHANNEL', 'PROSPECT_TYPE', 'ACTIVITY_SECTOR');

CREATE TABLE "CrmLookup" (
  "id" TEXT NOT NULL,
  "kind" "CrmLookupKind" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmLookup_kind_code_key" ON "CrmLookup"("kind", "code");
CREATE INDEX "CrmLookup_kind_active_sortOrder_idx" ON "CrmLookup"("kind", "active", "sortOrder");

INSERT INTO "CrmLookup" ("id", "kind", "code", "name", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'CHANNEL', 'whatsapp', 'WhatsApp', true, 10, NOW(), NOW()),
  (gen_random_uuid()::text, 'CHANNEL', 'instagram', 'Instagram', true, 20, NOW(), NOW()),
  (gen_random_uuid()::text, 'CHANNEL', 'visit', 'Visit', true, 30, NOW(), NOW()),
  (gen_random_uuid()::text, 'CHANNEL', 'phone', 'Phone', true, 40, NOW(), NOW()),
  (gen_random_uuid()::text, 'CHANNEL', 'other', 'Other', true, 50, NOW(), NOW()),
  (gen_random_uuid()::text, 'PROSPECT_TYPE', 'CUSTOMER', 'Customer', true, 10, NOW(), NOW()),
  (gen_random_uuid()::text, 'PROSPECT_TYPE', 'PARTNER', 'Partner', true, 20, NOW(), NOW()),
  (gen_random_uuid()::text, 'PROSPECT_TYPE', 'OTHER', 'Other', true, 30, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Hospitality', 'Hospitality', true, 10, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Healthcare', 'Healthcare', true, 20, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Retail', 'Retail', true, 30, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Wholesale', 'Wholesale', true, 40, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Construction', 'Construction', true, 50, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Logistics', 'Logistics', true, 60, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Finance', 'Finance', true, 70, NOW(), NOW()),
  (gen_random_uuid()::text, 'ACTIVITY_SECTOR', 'Other', 'Other', true, 80, NOW(), NOW());
