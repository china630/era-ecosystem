-- Unmatched / partial WO nahiye queue (CLI-49 W4). Raw string stays on ProcedureOrder.note.

DO $$ BEGIN
  CREATE TYPE "PhysioNahiyeQueueStatus" AS ENUM ('OPEN', 'RESOLVED', 'NOT_ANATOMY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "physio_nahiye_queue" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "normalized_text" TEXT NOT NULL,
  "sample_raw" TEXT NOT NULL,
  "residue" TEXT NOT NULL,
  "bucket" TEXT NOT NULL,
  "sample_procedure_name" TEXT,
  "hit_count" INTEGER NOT NULL DEFAULT 1,
  "status" "PhysioNahiyeQueueStatus" NOT NULL DEFAULT 'OPEN',
  "suggested_site_code" TEXT,
  "last_order_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "physio_nahiye_queue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "physio_nahiye_queue_organization_id_normalized_text_key"
  ON "physio_nahiye_queue"("organization_id", "normalized_text");
CREATE INDEX IF NOT EXISTS "physio_nahiye_queue_organization_id_status_hit_count_idx"
  ON "physio_nahiye_queue"("organization_id", "status", "hit_count");
