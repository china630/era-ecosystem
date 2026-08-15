-- Multi-resource scheduling (Pattern A allocations + Pattern B appointment.resourceId)
CREATE TYPE "ProcedureRequirementRole" AS ENUM ('LOCATION', 'EQUIPMENT', 'STAFF');
CREATE TYPE "ProcedureStaffMode" AS ENUM ('HARD', 'SOFT');

CREATE TABLE "practitioner_skill" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "procedure_type_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "practitioner_skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "procedure_type_requirement" (
    "id" TEXT NOT NULL,
    "procedure_type_id" TEXT NOT NULL,
    "role" "ProcedureRequirementRole" NOT NULL,
    "resource_kind" "ResourceKind",
    "resource_code" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "staff_mode" "ProcedureStaffMode" NOT NULL DEFAULT 'HARD',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "procedure_type_requirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "procedure_allocation" (
    "id" TEXT NOT NULL,
    "procedure_order_id" TEXT NOT NULL,
    "role" "ProcedureRequirementRole" NOT NULL,
    "resource_id" TEXT,
    "practitioner_id" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "procedure_allocation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "resource_id" TEXT;

CREATE UNIQUE INDEX "practitioner_skill_practitioner_id_procedure_type_id_key" ON "practitioner_skill"("practitioner_id", "procedure_type_id");
CREATE INDEX "practitioner_skill_procedure_type_id_idx" ON "practitioner_skill"("procedure_type_id");
CREATE INDEX "procedure_type_requirement_procedure_type_id_idx" ON "procedure_type_requirement"("procedure_type_id");
CREATE INDEX "procedure_allocation_procedure_order_id_idx" ON "procedure_allocation"("procedure_order_id");
CREATE INDEX "procedure_allocation_resource_id_starts_at_ends_at_idx" ON "procedure_allocation"("resource_id", "starts_at", "ends_at");
CREATE INDEX "procedure_allocation_practitioner_id_starts_at_ends_at_idx" ON "procedure_allocation"("practitioner_id", "starts_at", "ends_at");
CREATE INDEX "Appointment_resource_id_scheduledAt_idx" ON "Appointment"("resource_id", "scheduledAt");

ALTER TABLE "practitioner_skill" ADD CONSTRAINT "practitioner_skill_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "practitioner_skill" ADD CONSTRAINT "practitioner_skill_procedure_type_id_fkey" FOREIGN KEY ("procedure_type_id") REFERENCES "ProcedureType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "procedure_type_requirement" ADD CONSTRAINT "procedure_type_requirement_procedure_type_id_fkey" FOREIGN KEY ("procedure_type_id") REFERENCES "ProcedureType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "procedure_allocation" ADD CONSTRAINT "procedure_allocation_procedure_order_id_fkey" FOREIGN KEY ("procedure_order_id") REFERENCES "ProcedureOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "procedure_allocation" ADD CONSTRAINT "procedure_allocation_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "procedure_allocation" ADD CONSTRAINT "procedure_allocation_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_resource_id_fkey";
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "procedure_type_requirement" ("id", "procedure_type_id", "role", "resource_kind", "resource_code", "quantity", "staff_mode", "required", "created_at")
SELECT md5(random()::text || clock_timestamp()::text), pt."id",
  CASE WHEN pt."resourceKind" = 'ROOM' THEN 'LOCATION'::"ProcedureRequirementRole" ELSE 'EQUIPMENT'::"ProcedureRequirementRole" END,
  pt."resourceKind", pt."resourceCode", 1, 'HARD'::"ProcedureStaffMode", true, CURRENT_TIMESTAMP
FROM "ProcedureType" pt
WHERE NOT EXISTS (
  SELECT 1 FROM "procedure_type_requirement" r WHERE r."procedure_type_id" = pt."id" AND r."role" IN ('LOCATION','EQUIPMENT')
);

INSERT INTO "procedure_type_requirement" ("id", "procedure_type_id", "role", "quantity", "staff_mode", "required", "created_at")
SELECT md5(random()::text || clock_timestamp()::text || 'staff'), pt."id",
  'STAFF'::"ProcedureRequirementRole", 1, 'HARD'::"ProcedureStaffMode", true, CURRENT_TIMESTAMP
FROM "ProcedureType" pt
WHERE NOT EXISTS (
  SELECT 1 FROM "procedure_type_requirement" r WHERE r."procedure_type_id" = pt."id" AND r."role" = 'STAFF'
);

INSERT INTO "procedure_allocation" ("id", "procedure_order_id", "role", "resource_id", "practitioner_id", "starts_at", "ends_at")
SELECT md5(random()::text || rb."id"), rb."procedureOrderId",
  CASE WHEN res."kind" = 'ROOM' THEN 'LOCATION'::"ProcedureRequirementRole" ELSE 'EQUIPMENT'::"ProcedureRequirementRole" END,
  rb."resourceId", NULL, rb."startsAt", rb."endsAt"
FROM "ResourceBooking" rb
JOIN "Resource" res ON res."id" = rb."resourceId"
WHERE rb."procedureOrderId" IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM "procedure_allocation" a WHERE a."procedure_order_id" = rb."procedureOrderId" AND a."role" IN ('LOCATION','EQUIPMENT')
);
