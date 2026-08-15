const fs = require("fs");
const path = require("path");

const dir = path.join(
  __dirname,
  "../migrations/20260721180000_diagnostic_catalog_db",
);
fs.mkdirSync(dir, { recursive: true });

const sql = `-- Diagnostic catalog in DB + normalized lab order items/results
CREATE TYPE "LabResultFlag" AS ENUM ('NORMAL', 'HIGH', 'LOW', 'CRITICAL');

CREATE TABLE "Modality" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_az" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Modality_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Modality_code_key" ON "Modality"("code");

CREATE TABLE "DiagnosticService" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "modality_id" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL,
  "title_en" TEXT NOT NULL,
  "title_ru" TEXT NOT NULL,
  "title_az" TEXT NOT NULL,
  "service_code" TEXT NOT NULL,
  "fields_json" TEXT,
  "includes_json" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiagnosticService_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosticService_code_key" ON "DiagnosticService"("code");
CREATE INDEX "DiagnosticService_modality_id_idx" ON "DiagnosticService"("modality_id");
CREATE INDEX "DiagnosticService_kind_idx" ON "DiagnosticService"("kind");
CREATE INDEX "DiagnosticService_active_idx" ON "DiagnosticService"("active");

CREATE TABLE "DiagnosticAnalyte" (
  "id" TEXT NOT NULL,
  "service_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "unit" TEXT,
  "label_en" TEXT NOT NULL,
  "label_ru" TEXT NOT NULL,
  "label_az" TEXT NOT NULL,
  "ref_min" TEXT,
  "ref_max" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DiagnosticAnalyte_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiagnosticAnalyte_service_id_idx" ON "DiagnosticAnalyte"("service_id");
CREATE UNIQUE INDEX "DiagnosticAnalyte_service_id_code_key" ON "DiagnosticAnalyte"("service_id", "code");

CREATE TABLE "DiagnosticMetaField" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "field_type" TEXT NOT NULL,
  "label_en" TEXT NOT NULL,
  "label_ru" TEXT NOT NULL,
  "label_az" TEXT NOT NULL,
  "unit" TEXT,
  "options_json" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "DiagnosticMetaField_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiagnosticMetaField_key_key" ON "DiagnosticMetaField"("key");

CREATE TABLE "LabOrderItem" (
  "id" TEXT NOT NULL,
  "lab_order_id" TEXT NOT NULL,
  "diagnostic_service_id" TEXT,
  "service_code" TEXT NOT NULL,
  "amount_net" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabOrderItem_lab_order_id_idx" ON "LabOrderItem"("lab_order_id");
CREATE INDEX "LabOrderItem_diagnostic_service_id_idx" ON "LabOrderItem"("diagnostic_service_id");
CREATE INDEX "LabOrderItem_service_code_idx" ON "LabOrderItem"("service_code");

CREATE TABLE "LabResult" (
  "id" TEXT NOT NULL,
  "lab_order_item_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT,
  "value" TEXT NOT NULL,
  "unit" TEXT,
  "ref_min" TEXT,
  "ref_max" TEXT,
  "flag" "LabResultFlag" NOT NULL DEFAULT 'NORMAL',
  "entered_by_user_id" TEXT,
  "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabResult_lab_order_item_id_idx" ON "LabResult"("lab_order_item_id");
CREATE INDEX "LabResult_flag_idx" ON "LabResult"("flag");
CREATE UNIQUE INDEX "LabResult_lab_order_item_id_code_key" ON "LabResult"("lab_order_item_id", "code");

CREATE INDEX "LabOrder_createdAt_idx" ON "LabOrder"("createdAt");

ALTER TABLE "DiagnosticService" ADD CONSTRAINT "DiagnosticService_modality_id_fkey" FOREIGN KEY ("modality_id") REFERENCES "Modality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiagnosticAnalyte" ADD CONSTRAINT "DiagnosticAnalyte_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "DiagnosticService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_lab_order_id_fkey" FOREIGN KEY ("lab_order_id") REFERENCES "LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabOrderItem" ADD CONSTRAINT "LabOrderItem_diagnostic_service_id_fkey" FOREIGN KEY ("diagnostic_service_id") REFERENCES "DiagnosticService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_lab_order_item_id_fkey" FOREIGN KEY ("lab_order_item_id") REFERENCES "LabOrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
`;

const out = path.join(dir, "migration.sql");
fs.writeFileSync(out, sql, "utf8");
console.log("wrote", out);
