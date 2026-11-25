-- Wave 1 scaffold: parties/phases/locations/rfi/submittal/inspection/change + soft-delete + sheet stubs.

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "ProjectTask" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "EquipmentLog" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "sheet_number" TEXT;
ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'CURRENT';
ALTER TABLE "DrawingRevision" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "TimesheetEntry" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "DailyLog" ADD COLUMN IF NOT EXISTS "crew_by_party_json" TEXT;
ALTER TABLE "DailyLog" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "assignee" TEXT;
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "due_date" DATE;
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "drawing_revision_id" TEXT;
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "pin_x" DECIMAL(8,4);
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "pin_y" DECIMAL(8,4);
ALTER TABLE "PunchListItem" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "SubcontractorClaim" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "BoqLine" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "MaterialRequisition" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "ProgressAct" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "ProgressActLine" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProjectPhase" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectPhase_project_id_code_key" ON "ProjectPhase"("project_id", "code");
CREATE INDEX IF NOT EXISTS "ProjectPhase_organization_id_idx" ON "ProjectPhase"("organization_id");

CREATE TABLE IF NOT EXISTS "ProjectLocation" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectLocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectLocation_project_id_code_key" ON "ProjectLocation"("project_id", "code");
CREATE INDEX IF NOT EXISTS "ProjectLocation_organization_id_idx" ON "ProjectLocation"("organization_id");

CREATE TABLE IF NOT EXISTS "ProjectParty" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "finance_counterparty_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectParty_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProjectParty_project_id_role_idx" ON "ProjectParty"("project_id", "role");
CREATE INDEX IF NOT EXISTS "ProjectParty_organization_id_idx" ON "ProjectParty"("organization_id");

CREATE TABLE IF NOT EXISTS "Rfi" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignee" TEXT,
    "due_date" DATE,
    "answer" TEXT,
    "impact_schedule" BOOLEAN NOT NULL DEFAULT false,
    "impact_cost" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rfi_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Rfi_project_id_status_idx" ON "Rfi"("project_id", "status");
CREATE INDEX IF NOT EXISTS "Rfi_organization_id_idx" ON "Rfi"("organization_id");

CREATE TABLE IF NOT EXISTS "Submittal" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "spec_section" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submittal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Submittal_project_id_status_idx" ON "Submittal"("project_id", "status");
CREATE INDEX IF NOT EXISTS "Submittal_organization_id_idx" ON "Submittal"("organization_id");

CREATE TABLE IF NOT EXISTS "SiteInspection" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "form_json" TEXT NOT NULL DEFAULT '{}',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteInspection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiteInspection_project_id_status_idx" ON "SiteInspection"("project_id", "status");
CREATE INDEX IF NOT EXISTS "SiteInspection_organization_id_idx" ON "SiteInspection"("organization_id");

CREATE TABLE IF NOT EXISTS "ChangeRequest" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "impact_schedule" BOOLEAN NOT NULL DEFAULT false,
    "impact_cost" BOOLEAN NOT NULL DEFAULT false,
    "rfi_id" TEXT,
    "finance_contract_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ChangeRequest_project_id_status_idx" ON "ChangeRequest"("project_id", "status");
CREATE INDEX IF NOT EXISTS "ChangeRequest_organization_id_idx" ON "ChangeRequest"("organization_id");

DO $$ BEGIN
  ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectLocation" ADD CONSTRAINT "ProjectLocation_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProjectParty" ADD CONSTRAINT "ProjectParty_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Rfi" ADD CONSTRAINT "Rfi_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Submittal" ADD CONSTRAINT "Submittal_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SiteInspection" ADD CONSTRAINT "SiteInspection_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_rfi_id_fkey" FOREIGN KEY ("rfi_id") REFERENCES "Rfi"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PunchListItem" ADD CONSTRAINT "PunchListItem_drawing_revision_id_fkey" FOREIGN KEY ("drawing_revision_id") REFERENCES "DrawingRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
