CREATE TABLE "pos_halls" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "outlet_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pos_halls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_halls_outlet_id_sort_order_idx" ON "pos_halls"("outlet_id", "sort_order");
CREATE INDEX "pos_halls_organizationId_idx" ON "pos_halls"("organizationId");

ALTER TABLE "pos_halls"
  ADD CONSTRAINT "pos_halls_outlet_id_fkey"
  FOREIGN KEY ("outlet_id") REFERENCES "outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_tables" ADD COLUMN "hall_id" TEXT;

INSERT INTO "pos_halls" ("id", "organizationId", "outlet_id", "name", "sort_order", "created_at")
SELECT
  'h' || substr(md5(z."outlet_id" || '|' || z."key"), 1, 24),
  z."organization_id",
  z."outlet_id",
  z."name",
  (row_number() OVER (PARTITION BY z."outlet_id" ORDER BY z."key") - 1)::int,
  CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT ON (t."outlet_id", lower(btrim(t."zone")))
    t."organization_id",
    t."outlet_id",
    btrim(t."zone") AS "name",
    lower(btrim(t."zone")) AS "key"
  FROM "pos_tables" t
  WHERE t."zone" IS NOT NULL AND btrim(t."zone") <> ''
  ORDER BY t."outlet_id", lower(btrim(t."zone"))
) z;

UPDATE "pos_tables" t
SET "hall_id" = h."id"
FROM "pos_halls" h
WHERE h."outlet_id" = t."outlet_id"
  AND lower(h."name") = lower(btrim(t."zone"));

CREATE INDEX "pos_tables_hall_id_idx" ON "pos_tables"("hall_id");

ALTER TABLE "pos_tables"
  ADD CONSTRAINT "pos_tables_hall_id_fkey"
  FOREIGN KEY ("hall_id") REFERENCES "pos_halls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
