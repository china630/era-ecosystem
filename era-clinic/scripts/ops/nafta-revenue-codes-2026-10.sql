-- Nafta pilot: clinic hotel revenue codes (2001–2007). Codes sit on groups; services inherit them
-- (product -> modality / department -> tenant default, see billing-router revenueCodeForServiceLine).
-- ADR: docs/adr/hotel-revenue-code-resolution.md
-- Run once: psql -v ON_ERROR_STOP=1 -d era_clinic -f nafta-revenue-codes-2026-10.sql
\set org '6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b'

BEGIN;

UPDATE "Tenant" SET hotel_folio_revenue_code = '2001' WHERE "organizationId" = :'org';

UPDATE service_department
   SET hotel_revenue_code = CASE code
         WHEN 'DEPT-HEKIM-QEBULU' THEN '2002'
         WHEN 'DEPT-DIAQNOSTIKA' THEN '2003'
         WHEN 'DEPT-LABORATORIYA' THEN '2004'
         WHEN 'DEPT-MUALICE-PROQRAMI' THEN '2007'
         ELSE '2001'
       END
 WHERE "organizationId" = :'org';

UPDATE "Modality"
   SET hotel_revenue_code = CASE code
         WHEN 'LAB' THEN '2004'
         WHEN 'VISIT' THEN '2002'
         ELSE '2003'
       END
 WHERE "organizationId" = :'org';

SELECT 'tenant' AS level, "organizationId" AS code, hotel_folio_revenue_code AS revenue_code FROM "Tenant" WHERE "organizationId" = :'org'
UNION ALL SELECT 'department', code, hotel_revenue_code FROM service_department WHERE "organizationId" = :'org'
UNION ALL SELECT 'modality', code, hotel_revenue_code FROM "Modality" WHERE "organizationId" = :'org'
ORDER BY 1, 2;

COMMIT;
