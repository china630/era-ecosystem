-- Wave 4: VAT posting role alignment + Invoice e-qaimə fields

DO $eqaime_enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EqaimeStatus') THEN
    CREATE TYPE "EqaimeStatus" AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END
$eqaime_enum$;

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "eqaime_number" TEXT,
  ADD COLUMN IF NOT EXISTS "eqaime_status" "EqaimeStatus",
  ADD COLUMN IF NOT EXISTS "eqaime_submitted_at" TIMESTAMPTZ(6);

-- Align global template posting roles (commercial VAT_INPUT 191 / VAT_OUTPUT 545)
UPDATE "template_posting_roles"
SET "account_code" = '191', "updated_at" = NOW()
WHERE "kind" = 'COMMERCIAL' AND "role" = 'VAT_INPUT' AND "account_code" = '241';

UPDATE "template_posting_roles"
SET "account_code" = '545', "updated_at" = NOW()
WHERE "kind" = 'COMMERCIAL' AND "role" = 'VAT_OUTPUT' AND "account_code" = '541';

UPDATE "template_posting_roles"
SET "account_code" = '545', "updated_at" = NOW()
WHERE "kind" = 'NGO' AND "role" = 'VAT_OUTPUT' AND "account_code" = '541';

UPDATE "template_posting_roles"
SET "account_code" = '308-1', "updated_at" = NOW()
WHERE "kind" = 'BUDGET' AND "role" = 'VAT_OUTPUT' AND "account_code" = '541';

-- Org overrides that still mirror the old commercial VAT_INPUT preset
UPDATE "organization_posting_roles" opr
SET "account_code" = '191', "updated_at" = NOW()
FROM "organizations" o
WHERE opr."organization_id" = o."id"
  AND o."kind" = 'COMMERCIAL'
  AND opr."role" = 'VAT_INPUT'
  AND opr."account_code" = '241';

UPDATE "organization_posting_roles" opr
SET "account_code" = '545', "updated_at" = NOW()
FROM "organizations" o
WHERE opr."organization_id" = o."id"
  AND o."kind" = 'COMMERCIAL'
  AND opr."role" = 'VAT_OUTPUT'
  AND opr."account_code" = '541';
