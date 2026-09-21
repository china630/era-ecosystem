-- Named list-view presets (ADR extensibility W2). Columns/filters/sort only — not SQL.

CREATE TABLE "saved_list_views" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "grid_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "config_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "saved_list_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_list_views_organization_id_user_id_grid_key_name_key"
  ON "saved_list_views"("organization_id", "user_id", "grid_key", "name");

CREATE INDEX "saved_list_views_organization_id_grid_key_is_shared_idx"
  ON "saved_list_views"("organization_id", "grid_key", "is_shared");

CREATE INDEX "saved_list_views_organization_id_user_id_grid_key_is_default_idx"
  ON "saved_list_views"("organization_id", "user_id", "grid_key", "is_default");

ALTER TABLE "saved_list_views"
  ADD CONSTRAINT "saved_list_views_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_list_views"
  ADD CONSTRAINT "saved_list_views_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
