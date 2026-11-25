-- Digital Pipeline lite (P1-1): expand PipelineRule triggers/actions.
ALTER TABLE "PipelineRule" ADD COLUMN IF NOT EXISTS "trigger_type" TEXT NOT NULL DEFAULT 'STAGE_ENTER';
ALTER TABLE "PipelineRule" ADD COLUMN IF NOT EXISTS "config_json" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PipelineRule" ADD COLUMN IF NOT EXISTS "action_json" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "PipelineRule" ADD COLUMN IF NOT EXISTS "delay_minutes" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "PipelineRule_organization_id_trigger_type_active_idx"
  ON "PipelineRule" ("organization_id", "trigger_type", "active");
