-- Fail-closed tenancy: drop sentinel column defaults; backfill from bind when present.
DO $$
DECLARE
  r record;
  bind_org text;
BEGIN
  bind_org := NULL;
  BEGIN
    EXECUTE $q$SELECT "organizationId" FROM "_era_organization_bind" WHERE id = 1 LIMIT 1$q$ INTO bind_org;
  EXCEPTION WHEN undefined_table OR undefined_column THEN
    BEGIN
      EXECUTE $q$SELECT organization_id FROM _era_organization_bind WHERE id = 1 LIMIT 1$q$ INTO bind_org;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      bind_org := NULL;
    END;
  END;

  IF bind_org IN ('unbound', 'demo-org') THEN
    bind_org := NULL;
  END IF;

  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attnum > 0
      AND NOT a.attisdropped
      AND c.relkind = 'r'
      AND n.nspname = 'public'
      AND a.attname IN ('organizationId', 'organization_id')
      AND d.adbin IS NOT NULL
      AND pg_get_expr(d.adbin, d.adrelid) ILIKE '%unbound%'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', r.tbl, r.col);
    IF bind_org IS NOT NULL THEN
      EXECUTE format(
        'UPDATE %I SET %I = $1 WHERE %I IN (''unbound'', ''demo-org'')',
        r.tbl, r.col, r.col
      ) USING bind_org;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_phone_key";
DROP INDEX IF EXISTS "User_phone_key";
CREATE UNIQUE INDEX IF NOT EXISTS "User_organizationId_phone_key" ON "User" ("organization_id", "phone");
