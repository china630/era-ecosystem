-- Org placement (axis B). Existing rows default SHARED (self-serve SaaS trial).
-- Super-admin sets DEDICATED/ONPREM; that does not rewrite license dates unless asked.

CREATE TYPE "DeploymentTopology" AS ENUM ('SHARED', 'DEDICATED', 'ONPREM');

ALTER TABLE "organizations"
  ADD COLUMN "deployment_topology" "DeploymentTopology" NOT NULL DEFAULT 'SHARED';
