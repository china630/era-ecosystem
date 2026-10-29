-- DO NOT RUN — superseded by nafta-revenue-remap-matrix + category revenue SoR.
-- Archive only. Outlet RESTAURANT is retired (use NAFTANI).
-- Nafta pilot (historical): F&B outlet default hotel revenue code. 41xx = Naftani, 42xx = disco bar, 43xx = Xudmani;
-- CC = 01 food, 02 beverages, 03 alcohol, 04 tobacco, 05 hall rent, 06 entertainment, 99 discount.
-- The outlet code is the fallback; menu categories and dishes carry their own code when set.
-- ADR: docs/adr/hotel-revenue-code-resolution.md
-- Run once: psql -v ON_ERROR_STOP=1 -d era_fnb_pos -f nafta-revenue-codes-2026-10.sql
\set org '6bb9b75f-bf90-46c6-a4f7-bd5d3464c69b'

BEGIN;

UPDATE outlets SET revenue_center_code = '4101', updated_at = now()
 WHERE organization_id = :'org' AND code = 'RESTAURANT';

SELECT code, name, revenue_center_code FROM outlets WHERE organization_id = :'org' ORDER BY code;

COMMIT;
