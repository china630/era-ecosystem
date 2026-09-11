#!/bin/bash
set -euo pipefail
MDM='3803a504-c29a-4708-ba22-67f60d496a31'

docker exec -i era-postgres psql -U era -d era_mdm -c "
SELECT column_name FROM information_schema.columns
WHERE table_name='person_identifiers' ORDER BY 1;
SELECT id FROM global_natural_persons WHERE id='$MDM';
"

docker exec -i era-postgres psql -U era -d era_mdm -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DELETE FROM person_identifiers WHERE person_id = '$MDM';
DELETE FROM person_access_grants WHERE person_id = '$MDM';
DELETE FROM person_access_logs WHERE person_id = '$MDM';
DELETE FROM person_access_requests WHERE person_id = '$MDM';
DELETE FROM person_addresses WHERE person_id = '$MDM';
DELETE FROM person_hr_profiles WHERE person_id = '$MDM';
DELETE FROM global_natural_persons WHERE id = '$MDM';
COMMIT;
SELECT count(*) AS mdm_left FROM global_natural_persons WHERE id = '$MDM';
SQL

echo "=== Final ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT count(*) AS live_res FROM \"Reservation\"
WHERE id IN ('787e4432-ebf1-436e-8381-d1f08cedcebf','f71e4907-5e52-43f1-911f-1b2fae84896c');
SELECT count(*) AS saida_guests FROM \"Guest\"
WHERE id IN ('153132d5-a832-4717-aa8f-774931d3fb2b','151addac-fb4d-4797-812b-dcbd7037d893');
"
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT count(*) AS p001854 FROM \"PatientRef\" WHERE \"refCode\"='P-001854';
"
echo DONE
