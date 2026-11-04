-- Cancel extra OPEN lab orders of the same patient + loose service code.
-- Keeper: order that already had a catalog link, else one with results, else the oldest.
-- An order that is the keeper of any of its codes stays. PUBLISHED/COMPLETED are untouched.
-- Bare open items are linked when exactly one active catalog service matches the loose code.

BEGIN;

CREATE TEMP TABLE svc_loose ON COMMIT DROP AS
SELECT id,
       upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g')) AS loose
FROM "DiagnosticService"
WHERE active AND code IS NOT NULL AND code <> ''
UNION
SELECT id,
       upper(regexp_replace(service_code, '[^A-Za-z0-9]', '', 'g'))
FROM "DiagnosticService"
WHERE active AND service_code IS NOT NULL AND service_code <> '';

CREATE TEMP TABLE svc_one ON COMMIT DROP AS
SELECT loose, min(id) AS id
FROM svc_loose
GROUP BY loose
HAVING count(DISTINCT id) = 1;

CREATE TEMP TABLE open_orders ON COMMIT DROP AS
SELECT o.id,
       o."patientRefId",
       o."testCode",
       o."createdAt",
       EXISTS (
         SELECT 1 FROM "LabOrderItem" i
         WHERE i.lab_order_id = o.id AND i.diagnostic_service_id IS NOT NULL
       ) AS had_link,
       EXISTS (
         SELECT 1 FROM "LabOrderItem" i
         JOIN "LabResult" r ON r.lab_order_item_id = i.id
         WHERE i.lab_order_id = o.id
       ) AS had_result
FROM "LabOrder" o
WHERE o.status IN ('ORDERED', 'COLLECTED', 'IN_PROGRESS', 'RESULT_READY');

CREATE TEMP TABLE linked ON COMMIT DROP AS
WITH upd AS (
  UPDATE "LabOrderItem" i
  SET diagnostic_service_id = s.id
  FROM open_orders o, svc_one s
  WHERE i.lab_order_id = o.id
    AND i.diagnostic_service_id IS NULL
    AND s.loose = upper(regexp_replace(coalesce(nullif(i.service_code, ''), o."testCode"), '[^A-Za-z0-9]', '', 'g'))
  RETURNING i.id
)
SELECT count(*)::int AS n FROM upd;

CREATE TEMP TABLE coded ON COMMIT DROP AS
SELECT DISTINCT o.id, o."patientRefId", o."createdAt", o.had_link, o.had_result,
       upper(regexp_replace(coalesce(nullif(i.service_code, ''), o."testCode"), '[^A-Za-z0-9]', '', 'g')) AS loose
FROM open_orders o
LEFT JOIN "LabOrderItem" i ON i.lab_order_id = o.id;

CREATE TEMP TABLE keepers ON COMMIT DROP AS
SELECT DISTINCT ON ("patientRefId", loose) id
FROM coded
WHERE loose <> ''
  AND ("patientRefId", loose) IN (
    SELECT "patientRefId", loose FROM coded WHERE loose <> '' GROUP BY 1, 2 HAVING count(DISTINCT id) > 1
  )
ORDER BY "patientRefId", loose, had_link DESC, had_result DESC, "createdAt" ASC, id ASC;

CREATE TEMP TABLE dup_keys ON COMMIT DROP AS
SELECT "patientRefId", loose
FROM coded
WHERE loose <> ''
GROUP BY 1, 2
HAVING count(DISTINCT id) > 1;

CREATE TEMP TABLE doomed ON COMMIT DROP AS
SELECT DISTINCT c.id
FROM coded c
JOIN dup_keys d ON d."patientRefId" = c."patientRefId" AND d.loose = c.loose
WHERE c.id NOT IN (SELECT id FROM keepers);

UPDATE "LabOrder" o
SET status = 'CANCELLED',
    cancelled_at = now(),
    cancel_reason = 'duplicate_open'
FROM doomed d
WHERE o.id = d.id
  AND o.status IN ('ORDERED', 'COLLECTED', 'IN_PROGRESS', 'RESULT_READY');

SELECT (SELECT n FROM linked) AS linked, (SELECT count(*) FROM doomed) AS cancelled;

COMMIT;
