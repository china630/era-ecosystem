#!/bin/bash
set -euo pipefail
MDM='3803a504-c29a-4708-ba22-67f60d496a31'
GUEST_SABAHET='7dbd5ab1-7f93-4c95-93ee-aab3092d2b63'

echo "=== Null MDM on remaining Səbahət guest (keeps hist res 306) ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -v ON_ERROR_STOP=1 -c "
UPDATE \"Guest\" SET \"globalPersonId\" = NULL WHERE id = '$GUEST_SABAHET' OR \"globalPersonId\" = '$MDM';
SELECT id, \"fullName\", \"globalPersonId\" FROM \"Guest\" WHERE id = '$GUEST_SABAHET';
"

echo "=== Delete MDM person ==="
docker exec -i era-postgres psql -U era -d era_mdm -v ON_ERROR_STOP=1 <<SQL
BEGIN;
DELETE FROM "PersonIdentifier" WHERE "personId" = '$MDM';
DELETE FROM "PersonAccessGrant" WHERE "personId" = '$MDM';
DELETE FROM "PersonAccessLog" WHERE "personId" = '$MDM';
DELETE FROM "PersonAccessRequest" WHERE "personId" = '$MDM';
DELETE FROM "PersonAddress" WHERE "personId" = '$MDM';
DELETE FROM "PersonHrProfile" WHERE "personId" = '$MDM';
DELETE FROM "GlobalNaturalPerson" WHERE id = '$MDM';
COMMIT;
SELECT count(*) AS mdm_left FROM "GlobalNaturalPerson" WHERE id = '$MDM';
SQL

echo "=== Final check ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT id, status, \"externalRef\" FROM \"Reservation\"
WHERE id IN ('787e4432-ebf1-436e-8381-d1f08cedcebf','f71e4907-5e52-43f1-911f-1b2fae84896c');
SELECT id, \"fullName\" FROM \"Guest\"
WHERE id IN ('153132d5-a832-4717-aa8f-774931d3fb2b','151addac-fb4d-4797-812b-dcbd7037d893');
"
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT count(*) AS p001854 FROM \"PatientRef\" WHERE \"refCode\"='P-001854';
SELECT count(*) AS open_501_511 FROM \"ClinicalEpisode\"
WHERE status='OPEN' AND \"roomNumber\" IN ('501','511')
  AND \"reservationId\" IN ('787e4432-ebf1-436e-8381-d1f08cedcebf','f71e4907-5e52-43f1-911f-1b2fae84896c');
"
echo DONE
