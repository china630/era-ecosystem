-- Revenue code system role: services look codes up by role, not by code/name text.
-- Idempotent: the Nafta pilot DB received the column and roles before this deploy.
ALTER TABLE "RevenueCode" ADD COLUMN IF NOT EXISTS "systemRole" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "RevenueCode_organizationId_systemRole_key"
  ON "RevenueCode"("organizationId", "systemRole");

-- Backfill: the code or name that services matched by token keeps working.
-- One row per org and role; an exact code match wins over a name match.
-- Orgs that already carry a role keep it.
WITH roles(role) AS (
  VALUES ('ROOM'), ('BOARD'), ('PKG'), ('TREATMENT'), ('RATE_ADJ'), ('EARLY_CI'),
         ('LATE_CO'), ('MINIBAR'), ('LAUNDRY'), ('TRANSFER'), ('TOUR'), ('BANQUET'),
         ('FOOD'), ('MEDICAL'), ('DISCOUNT')
),
picked AS (
  SELECT DISTINCT ON (rc."organizationId", r.role)
         rc.id, r.role
  FROM roles r
  JOIN "RevenueCode" rc
    ON rc.active
   AND rc."systemRole" IS NULL
   AND (upper(trim(rc.code)) = r.role OR upper(trim(rc.name)) = r.role)
  WHERE NOT EXISTS (
    SELECT 1 FROM "RevenueCode" taken
     WHERE taken."organizationId" = rc."organizationId"
       AND taken."systemRole" = r.role
  )
  ORDER BY rc."organizationId", r.role,
           (upper(trim(rc.code)) = r.role) DESC, rc.code
)
UPDATE "RevenueCode" rc
   SET "systemRole" = picked.role
  FROM picked
 WHERE rc.id = picked.id
   AND NOT EXISTS (
     SELECT 1 FROM picked p2 WHERE p2.id = picked.id AND p2.role < picked.role
   );
