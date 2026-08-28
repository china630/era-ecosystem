-- SaaS Wave 1: per-org Elektraweb bridge + clinic cutover policies (orchestrator SoR).
-- Synced to satellites keyed by organizationId — not process-wide env.

CREATE TABLE "elektraweb_bridge_policies" (
    "organization_id" UUID NOT NULL,
    "inbound_enabled" BOOLEAN NOT NULL DEFAULT false,
    "write_enabled" BOOLEAN NOT NULL DEFAULT false,
    "elektraweb_hotel_id" INTEGER,
    "spa_dep_id" INTEGER,
    "spa_currency_id" INTEGER,
    "walkin_res_id" VARCHAR(64),
    "walkin_res_name_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "elektraweb_bridge_policies_pkey" PRIMARY KEY ("organization_id")
);

ALTER TABLE "elektraweb_bridge_policies"
  ADD CONSTRAINT "elektraweb_bridge_policies_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "clinic_cutover_policies" (
    "organization_id" UUID NOT NULL,
    "elektraweb_dual_run" BOOLEAN NOT NULL DEFAULT false,
    "hotel_organization_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinic_cutover_policies_pkey" PRIMARY KEY ("organization_id")
);

ALTER TABLE "clinic_cutover_policies"
  ADD CONSTRAINT "clinic_cutover_policies_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clinic_cutover_policies"
  ADD CONSTRAINT "clinic_cutover_policies_hotel_organization_id_fkey"
  FOREIGN KEY ("hotel_organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "clinic_cutover_policies_hotel_organization_id_idx"
  ON "clinic_cutover_policies"("hotel_organization_id");
