-- System vs custom clinic roles + staffKind for practitioner persona.
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "staff_kind" TEXT;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "clone_from_code" TEXT;

-- Mark known system role codes and backfill staffKind (FLOOR → NURSE like inferStaffKind).
UPDATE "Role"
SET
  "is_system" = true,
  "staff_kind" = CASE "code"
    WHEN 'DOCTOR' THEN 'DOCTOR'
    WHEN 'NURSE' THEN 'NURSE'
    WHEN 'FLOOR' THEN 'NURSE'
    WHEN 'LAB_TECH' THEN 'LAB'
    WHEN 'RECEPTION' THEN 'NONE'
    WHEN 'CLINIC_ADMIN' THEN 'NONE'
    WHEN 'ADMIN' THEN 'NONE'
    ELSE COALESCE("staff_kind", 'NONE')
  END
WHERE "code" IN (
  'RECEPTION',
  'DOCTOR',
  'NURSE',
  'FLOOR',
  'LAB_TECH',
  'CLINIC_ADMIN',
  'ADMIN'
);
