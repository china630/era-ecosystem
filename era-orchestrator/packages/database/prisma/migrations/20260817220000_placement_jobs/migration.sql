-- PlacementJob API scaffold (waves 11-15). Not a live migrate product.
-- Direct SHARED <-> ONPREM is rejected in application code (status REJECTED).

CREATE TYPE "PlacementJobStatus" AS ENUM (
  'PENDING',
  'FREEZE',
  'EXPORT',
  'PROVISION',
  'BIND',
  'CUTOVER',
  'SMOKE',
  'DONE',
  'FAILED',
  'REJECTED'
);

CREATE TABLE "placement_jobs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "satellite_key" TEXT NOT NULL,
  "from_topology" "DeploymentTopology" NOT NULL,
  "to_topology" "DeploymentTopology" NOT NULL,
  "status" "PlacementJobStatus" NOT NULL DEFAULT 'PENDING',
  "error_message" TEXT,
  "slice_meta" JSONB,
  "target_base_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "placement_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "placement_jobs_organization_id_idx" ON "placement_jobs"("organization_id");
CREATE INDEX "placement_jobs_status_idx" ON "placement_jobs"("status");

ALTER TABLE "placement_jobs"
  ADD CONSTRAINT "placement_jobs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
