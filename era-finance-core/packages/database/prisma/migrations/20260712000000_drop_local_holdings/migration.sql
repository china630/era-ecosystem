-- Drop local holdings SoT (moved to control plane / era-orchestrator).

ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_holding_id_fkey";
DROP INDEX IF EXISTS "organizations_holding_id_idx";
DROP INDEX IF EXISTS "organizations_holding_id_id_idx";
ALTER TABLE "organizations" DROP COLUMN IF EXISTS "holding_id";

DROP TABLE IF EXISTS "holding_memberships";
DROP TABLE IF EXISTS "holdings";

DROP TYPE IF EXISTS "HoldingAccessRole";
