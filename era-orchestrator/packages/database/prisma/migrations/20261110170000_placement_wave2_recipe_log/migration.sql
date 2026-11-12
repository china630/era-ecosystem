-- Placement Wave 2: clone recipe + append-only process log.

ALTER TABLE "placement_batches" ADD COLUMN "recipe_json" JSONB;

CREATE TABLE "placement_process_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "batch_id" UUID,
    "job_id" UUID,
    "phase" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "placement_process_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "placement_process_logs_batch_id_created_at_idx"
  ON "placement_process_logs"("batch_id", "created_at");
CREATE INDEX "placement_process_logs_job_id_created_at_idx"
  ON "placement_process_logs"("job_id", "created_at");

ALTER TABLE "placement_process_logs"
  ADD CONSTRAINT "placement_process_logs_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "placement_batches"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "placement_process_logs"
  ADD CONSTRAINT "placement_process_logs_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "placement_jobs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
