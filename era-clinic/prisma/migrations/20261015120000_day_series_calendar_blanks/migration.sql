-- Day series, clinic day overrides, Word blank profiles, shared analyte cards.

CREATE TABLE "procedure_day_series" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fills_rest_days" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "procedure_day_series_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "procedure_day_series_organizationId_code_key" ON "procedure_day_series"("organizationId", "code");
CREATE INDEX "procedure_day_series_organizationId_active_idx" ON "procedure_day_series"("organizationId", "active");

CREATE TABLE "procedure_day_series_member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "series_id" TEXT NOT NULL,
    "procedure_code" TEXT NOT NULL,
    "short_mark" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "procedure_day_series_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "procedure_day_series_member_series_id_procedure_code_key" ON "procedure_day_series_member"("series_id", "procedure_code");
CREATE INDEX "procedure_day_series_member_organizationId_procedure_code_idx" ON "procedure_day_series_member"("organizationId", "procedure_code");
ALTER TABLE "procedure_day_series_member" ADD CONSTRAINT "procedure_day_series_member_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "procedure_day_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "clinic_day_override" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "day_ymd" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL,
    "end_hour" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clinic_day_override_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinic_day_override_organizationId_day_ymd_key" ON "clinic_day_override"("organizationId", "day_ymd");
CREATE INDEX "clinic_day_override_organizationId_idx" ON "clinic_day_override"("organizationId");

CREATE TYPE "LabBlankKind" AS ENUM ('TABLE', 'NARRATIVE');

CREATE TABLE "lab_blank_profile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LabBlankKind" NOT NULL DEFAULT 'TABLE',
    "service_code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lab_blank_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_blank_profile_organizationId_name_key" ON "lab_blank_profile"("organizationId", "name");
CREATE INDEX "lab_blank_profile_organizationId_active_idx" ON "lab_blank_profile"("organizationId", "active");

CREATE TABLE "lab_blank_row" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "source_label" TEXT NOT NULL,
    "analyte_code" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "lab_blank_row_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_blank_row_profile_id_source_label_key" ON "lab_blank_row"("profile_id", "source_label");
CREATE INDEX "lab_blank_row_organizationId_idx" ON "lab_blank_row"("organizationId");
ALTER TABLE "lab_blank_row" ADD CONSTRAINT "lab_blank_row_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "lab_blank_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "analyte_card" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label_en" TEXT NOT NULL,
    "label_ru" TEXT NOT NULL,
    "label_az" TEXT NOT NULL,
    "unit" TEXT,
    "value_type" "AnalyteValueType" NOT NULL DEFAULT 'NUMERIC',
    "ref_min" TEXT,
    "ref_max" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "analyte_card_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analyte_card_organizationId_code_key" ON "analyte_card"("organizationId", "code");
CREATE INDEX "analyte_card_organizationId_idx" ON "analyte_card"("organizationId");

ALTER TABLE "DiagnosticAnalyte" ADD COLUMN "card_id" TEXT;
CREATE INDEX "DiagnosticAnalyte_card_id_idx" ON "DiagnosticAnalyte"("card_id");
ALTER TABLE "DiagnosticAnalyte" ADD CONSTRAINT "DiagnosticAnalyte_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "analyte_card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
