-- Placement Wave 1: PlacementBatch + clone-then-freeze status ladder.

ALTER TYPE "PlacementJobStatus" ADD VALUE IF NOT EXISTS 'CONFIGURE';
ALTER TYPE "PlacementJobStatus" ADD VALUE IF NOT EXISTS 'IMPORT';
ALTER TYPE "PlacementJobStatus" ADD VALUE IF NOT EXISTS 'ROLLBACK';

CREATE TYPE "PlacementPackaging" AS ENUM ('PER_SATELLITE', 'SINGLE_STACK');

CREATE TABLE "placement_batches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "satellite_keys" TEXT[],
    "from_topology" "DeploymentTopology" NOT NULL,
    "to_topology" "DeploymentTopology" NOT NULL,
    "packaging" "PlacementPackaging" NOT NULL DEFAULT 'PER_SATELLITE',
    "target_host" TEXT,
    "status" "PlacementJobStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "placement_batches_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "placement_batches_organization_id_idx" ON "placement_batches"("organization_id");
CREATE INDEX "placement_batches_status_idx" ON "placement_batches"("status");

ALTER TABLE "placement_batches"
  ADD CONSTRAINT "placement_batches_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "placement_jobs" ADD COLUMN "batch_id" UUID;

CREATE INDEX "placement_jobs_batch_id_idx" ON "placement_jobs"("batch_id");

ALTER TABLE "placement_jobs"
  ADD CONSTRAINT "placement_jobs_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "placement_batches"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
