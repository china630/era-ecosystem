-- Organization operating mode: standalone (own VOEN) vs department-of-parent (hotel).
-- Only money routing (fiscal/revenue) may delegate to the parent; operational data
-- always stays owned by the org's own satellite DB.

CREATE TYPE "OrgOperatingMode" AS ENUM ('STANDALONE', 'DEPARTMENT');
CREATE TYPE "OrgRouting" AS ENUM ('OWN', 'PARENT');

ALTER TABLE "organizations" ADD COLUMN "operating_mode" "OrgOperatingMode" NOT NULL DEFAULT 'STANDALONE';
ALTER TABLE "organizations" ADD COLUMN "parent_org_id" UUID;
ALTER TABLE "organizations" ADD COLUMN "fiscal_routing" "OrgRouting" NOT NULL DEFAULT 'OWN';
ALTER TABLE "organizations" ADD COLUMN "revenue_routing" "OrgRouting" NOT NULL DEFAULT 'OWN';

ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_org_id_fkey"
  FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "organizations_parent_org_id_idx" ON "organizations"("parent_org_id");
