-- Retail tenant column matches hotel: Postgres "organizationId" (not organization_id).
-- Every retail table already had the column, including ReceiptLine. Rename only.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'organization_id'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I RENAME COLUMN organization_id TO %I',
      r.table_name,
      'organizationId'
    );
  END LOOP;
END $$;

-- Index names follow the column. User_organizationId_phone_key already uses the target name.
DO $$
DECLARE
  r record;
  new_name text;
BEGIN
  FOR r IN
    SELECT c.relname AS index_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname LIKE '%organization_id%'
  LOOP
    new_name := replace(r.index_name, 'organization_id', 'organizationId');
    IF new_name <> r.index_name THEN
      EXECUTE format('ALTER INDEX %I RENAME TO %I', r.index_name, new_name);
    END IF;
  END LOOP;
END $$;
