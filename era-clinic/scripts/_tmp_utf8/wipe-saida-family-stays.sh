#!/bin/bash
# Wipe live family stays Səidə@511 + Səbahət@501 so Elektraweb bridge can re-ingest.
# Does NOT wipe other IN_HOUSE / history on rooms 501/511.
set -euo pipefail

RES_SAIDA='787e4432-ebf1-436e-8381-d1f08cedcebf'
RES_SABAHET='f71e4907-5e52-43f1-911f-1b2fae84896c'
GUEST_SAIDA='153132d5-a832-4717-aa8f-774931d3fb2b'
GUEST_SAIDA2='151addac-fb4d-4797-812b-dcbd7037d893'
GUEST_SABAHET='7dbd5ab1-7f93-4c95-93ee-aab3092d2b63'
MDM='3803a504-c29a-4708-ba22-67f60d496a31'

echo "=== PRECHECK ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT id, status, \"externalRef\", \"guestId\" FROM \"Reservation\"
WHERE id IN ('$RES_SAIDA','$RES_SABAHET');
"
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT e.id, e.\"roomNumber\", e.\"reservationId\", p.\"refCode\"
FROM \"ClinicalEpisode\" e
LEFT JOIN \"PatientRef\" p ON p.id=e.\"patientRefId\"
WHERE e.\"reservationId\" IN ('$RES_SAIDA','$RES_SABAHET') OR p.\"globalPersonId\"='$MDM';
"

echo "=== CLINIC ==="
docker exec -i era-postgres psql -U era -d era_clinic -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

CREATE TEMP TABLE _wipe_ep ON COMMIT DROP AS
SELECT e.id, e."patientRefId"
FROM "ClinicalEpisode" e
WHERE e."reservationId" IN (
  '787e4432-ebf1-436e-8381-d1f08cedcebf',
  'f71e4907-5e52-43f1-911f-1b2fae84896c'
)
OR e."globalPersonId" = '3803a504-c29a-4708-ba22-67f60d496a31';

CREATE TEMP TABLE _wipe_lab ON COMMIT DROP AS
SELECT lo.id
FROM "LabOrder" lo
JOIN _wipe_ep w ON lo."clinicalEpisodeId" = w.id;

DELETE FROM "LabResult" lr
USING "LabOrderItem" li, _wipe_lab wl
WHERE lr.lab_order_item_id = li.id AND li.lab_order_id = wl.id;

DELETE FROM "LabOrderItem" li USING _wipe_lab wl WHERE li.lab_order_id = wl.id;
DELETE FROM "LabOrder" lo USING _wipe_lab wl WHERE lo.id = wl.id;

DELETE FROM "ProcedureOrder" po USING _wipe_ep w WHERE po.clinical_episode_id = w.id;

UPDATE "Visit" v SET clinical_episode_id = NULL
FROM _wipe_ep w WHERE v.clinical_episode_id = w.id;

DELETE FROM "ProgramProcedureBalance" b
USING "ProgramInstance" pi, _wipe_ep w
WHERE b."instanceId" = pi.id AND pi."episodeId" = w.id;

DELETE FROM "ProgramInstance" pi USING _wipe_ep w WHERE pi."episodeId" = w.id;

-- Cascade children of ClinicalEpisode (complaints/diagnoses/contraindications)
DELETE FROM "ClinicalEpisode" e USING _wipe_ep w WHERE e.id = w.id;

DELETE FROM "PatientRef" p
WHERE (p."globalPersonId" = '3803a504-c29a-4708-ba22-67f60d496a31' OR p."refCode" = 'P-001854')
  AND NOT EXISTS (SELECT 1 FROM "ClinicalEpisode" e WHERE e."patientRefId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "LabOrder" lo WHERE lo."patientRefId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "Visit" v WHERE v."patientRefId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."patientRefId" = p.id);

COMMIT;
SELECT 'clinic_ok' AS step, (SELECT count(*) FROM "ClinicalEpisode" WHERE "globalPersonId" = '3803a504-c29a-4708-ba22-67f60d496a31') AS eps_left;
SQL

echo "=== HOTEL ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DELETE FROM "Reservation"
WHERE id IN (
  '787e4432-ebf1-436e-8381-d1f08cedcebf',
  'f71e4907-5e52-43f1-911f-1b2fae84896c'
);

DELETE FROM "Guest" g
WHERE g.id IN (
  '153132d5-a832-4717-aa8f-774931d3fb2b',
  '151addac-fb4d-4797-812b-dcbd7037d893',
  '7dbd5ab1-7f93-4c95-93ee-aab3092d2b63'
)
AND NOT EXISTS (SELECT 1 FROM "Reservation" r WHERE r."guestId" = g.id)
AND NOT EXISTS (
  SELECT 1 FROM "ReservationGuest" rg WHERE rg."guestId" = g.id
);

COMMIT;

SELECT 'hotel_reservations_left' AS k, count(*)::text AS v FROM "Reservation"
WHERE id IN ('787e4432-ebf1-436e-8381-d1f08cedcebf','f71e4907-5e52-43f1-911f-1b2fae84896c')
UNION ALL
SELECT 'hotel_guests_left', count(*)::text FROM "Guest"
WHERE id IN (
  '153132d5-a832-4717-aa8f-774931d3fb2b',
  '151addac-fb4d-4797-812b-dcbd7037d893',
  '7dbd5ab1-7f93-4c95-93ee-aab3092d2b63'
)
UNION ALL
SELECT 'hotel_mdm_refs', count(*)::text FROM "Guest"
WHERE "globalPersonId" = '3803a504-c29a-4708-ba22-67f60d496a31';
SQL

echo "=== MDM ==="
GREF=$(docker exec -i era-postgres psql -U era -d era_hotel_pms -t -A -c "SELECT count(*) FROM \"Guest\" WHERE \"globalPersonId\" = '$MDM';")
CREF=$(docker exec -i era-postgres psql -U era -d era_clinic -t -A -c "SELECT count(*) FROM \"PatientRef\" WHERE \"globalPersonId\" = '$MDM';")
echo "refs hotel=$GREF clinic=$CREF"
if [ "$GREF" = "0" ] && [ "$CREF" = "0" ]; then
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
SELECT 'mdm_deleted' AS step;
SQL
else
  echo "SKIP MDM delete — still referenced (hotel=$GREF clinic=$CREF)"
fi

echo "=== POSTCHECK ==="
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT count(*) AS clinic_eps FROM \"ClinicalEpisode\"
WHERE \"reservationId\" IN ('$RES_SAIDA','$RES_SABAHET');
SELECT count(*) AS clinic_p FROM \"PatientRef\" WHERE \"refCode\"='P-001854';
"
echo DONE
