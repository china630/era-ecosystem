-- Clinic T1 BodyPart catalog (ADR managed-lists A4)
CREATE TYPE "ClinicLookupKind" AS ENUM ('BODY_PART');

CREATE TABLE "ClinicLookup" (
  "id" TEXT NOT NULL,
  "kind" "ClinicLookupKind" NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicLookup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicLookup_kind_code_key" ON "ClinicLookup"("kind", "code");
CREATE INDEX "ClinicLookup_kind_active_sortOrder_idx" ON "ClinicLookup"("kind", "active", "sortOrder");

INSERT INTO "ClinicLookup" ("id", "kind", "code", "name", "active", "sortOrder", "createdAt", "updatedAt") VALUES
  (gen_random_uuid()::text, 'BODY_PART', 'HEAD', 'Head', true, 10, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'NECK', 'Neck', true, 20, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'CHEST', 'Chest', true, 30, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'BACK', 'Back', true, 40, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'ABDOMEN', 'Abdomen', true, 50, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'ARM_LEFT', 'Arm left', true, 60, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'ARM_RIGHT', 'Arm right', true, 70, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'LEG_LEFT', 'Leg left', true, 80, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'LEG_RIGHT', 'Leg right', true, 90, NOW(), NOW()),
  (gen_random_uuid()::text, 'BODY_PART', 'FULL_BODY', 'Full body', true, 100, NOW(), NOW());
