-- WS7: Personnel orders + staff schedule revisions
CREATE TYPE "WorkforcePersonnelOrderType" AS ENUM ('HIRE', 'TRANSFER', 'TERMINATE');
CREATE TYPE "WorkforcePersonnelOrderStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');
CREATE TYPE "StaffScheduleRevisionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

CREATE TABLE "workforce_personnel_orders" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workforce_scope_id" UUID NOT NULL,
  "employment_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "type" "WorkforcePersonnelOrderType" NOT NULL,
  "status" "WorkforcePersonnelOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "order_number" TEXT NOT NULL,
  "effective_date" DATE NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "person_display_name" TEXT,
  "document_storage_key" TEXT,
  "issued_by_user_id" UUID,
  "issued_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workforce_personnel_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workforce_personnel_orders_workforce_scope_id_order_number_key"
  ON "workforce_personnel_orders"("workforce_scope_id", "order_number");
CREATE INDEX "workforce_personnel_orders_workforce_scope_id_type_status_idx"
  ON "workforce_personnel_orders"("workforce_scope_id", "type", "status");
CREATE INDEX "workforce_personnel_orders_employment_id_idx"
  ON "workforce_personnel_orders"("employment_id");

ALTER TABLE "workforce_personnel_orders" ADD CONSTRAINT "workforce_personnel_orders_workforce_scope_id_fkey"
  FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workforce_personnel_orders" ADD CONSTRAINT "workforce_personnel_orders_employment_id_fkey"
  FOREIGN KEY ("employment_id") REFERENCES "workforce_employments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "staff_schedule_revisions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "workforce_scope_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" "StaffScheduleRevisionStatus" NOT NULL DEFAULT 'DRAFT',
  "snapshot_json" JSONB NOT NULL DEFAULT '[]',
  "submitted_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "submitted_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "document_storage_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "staff_schedule_revisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "staff_schedule_revisions_workforce_scope_id_status_idx"
  ON "staff_schedule_revisions"("workforce_scope_id", "status");
ALTER TABLE "staff_schedule_revisions" ADD CONSTRAINT "staff_schedule_revisions_workforce_scope_id_fkey"
  FOREIGN KEY ("workforce_scope_id") REFERENCES "workforce_scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
