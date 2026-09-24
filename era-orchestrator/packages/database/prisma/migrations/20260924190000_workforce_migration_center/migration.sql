-- CP-WF-MIG-01: origin on absence/order + per-org wizard step state

ALTER TABLE "workforce_absences"
  ADD COLUMN "source" VARCHAR(16) NOT NULL DEFAULT 'manual',
  ADD COLUMN "source_ref" VARCHAR(191);

CREATE INDEX "workforce_absences_organization_id_source_source_ref_idx"
  ON "workforce_absences"("organization_id", "source", "source_ref");

ALTER TABLE "workforce_personnel_orders"
  ADD COLUMN "source" VARCHAR(16) NOT NULL DEFAULT 'manual',
  ADD COLUMN "source_ref" VARCHAR(191);

CREATE INDEX "workforce_personnel_orders_organization_id_source_source_ref_idx"
  ON "workforce_personnel_orders"("organization_id", "source", "source_ref");

CREATE TABLE "workforce_migration_steps" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "organization_id" UUID NOT NULL,
  "step_id" VARCHAR(32) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "summary_json" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_migration_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workforce_migration_steps_organization_id_step_id_key"
  ON "workforce_migration_steps"("organization_id", "step_id");
CREATE INDEX "workforce_migration_steps_organization_id_idx"
  ON "workforce_migration_steps"("organization_id");

ALTER TABLE "workforce_migration_steps"
  ADD CONSTRAINT "workforce_migration_steps_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
