#!/bin/bash
# Wipe ALL hotel reservations currently on doors 501 and 511 (+ clinic + orphan MDM).
set -euo pipefail

echo "=== PRE: hotel stays on 501/511 ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -v ON_ERROR_STOP=1 <<'SQL'
SELECT r.id, r.status, r."shareEligible", r.adults, rm."roomNumber",
       g."fullName", g."globalPersonId", r."externalRef"
FROM "Reservation" r
JOIN "Room" rm ON rm.id = r."roomId"
LEFT JOIN "Guest" g ON g.id = r."guestId"
WHERE rm."roomNumber" IN ('501','511')
ORDER BY rm."roomNumber", r.status, r."checkInDate";
SQL

echo "=== PRE: clinic episodes 501/511 ==="
docker exec -i era-postgres psql -U era -d era_clinic -v ON_ERROR_STOP=1 <<'SQL'
SELECT e.id, e.status, e."roomNumber", e."reservationId", e."globalPersonId",
       p."refCode", p."fullName"
FROM "ClinicalEpisode" e
LEFT JOIN "PatientRef" p ON p.id = e."patientRefId"
WHERE e."roomNumber" IN ('501','511')
ORDER BY e."roomNumber", e.status;
SQL

# Save MDM ids before hotel wipe
docker exec -i era-postgres psql -U era -d era_hotel_pms -t -A -c "
SELECT DISTINCT g.\"globalPersonId\"
FROM \"Reservation\" r
JOIN \"Room\" rm ON rm.id = r.\"roomId\"
JOIN \"Guest\" g ON g.id = r.\"guestId\"
WHERE rm.\"roomNumber\" IN ('501','511')
  AND g.\"globalPersonId\" IS NOT NULL;
" > /tmp/wipe_501_511_mdm.txt || true

docker exec -i era-postgres psql -U era -d era_clinic -t -A -c "
SELECT DISTINCT e.\"globalPersonId\"
FROM \"ClinicalEpisode\" e
WHERE e.\"roomNumber\" IN ('501','511')
  AND e.\"globalPersonId\" IS NOT NULL;
" >> /tmp/wipe_501_511_mdm.txt || true

sort -u /tmp/wipe_501_511_mdm.txt -o /tmp/wipe_501_511_mdm.txt
echo "MDM candidates:"
cat /tmp/wipe_501_511_mdm.txt || true

echo "=== HOTEL wipe ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

CREATE TEMP TABLE _wipe_res ON COMMIT DROP AS
SELECT r.id, r."guestId"
FROM "Reservation" r
JOIN "Room" rm ON rm.id = r."roomId"
WHERE rm."roomNumber" IN ('501','511');

CREATE TEMP TABLE _wipe_guests ON COMMIT DROP AS
SELECT DISTINCT "guestId" AS id FROM _wipe_res WHERE "guestId" IS NOT NULL;

DELETE FROM "FolioPaymentAllocation" a
USING "FolioPayment" p, "Folio" f, _wipe_res w
WHERE a."paymentId" = p.id AND p."folioId" = f.id AND f."reservationId" = w.id;

DELETE FROM "FolioPayment" p
USING "Folio" f, _wipe_res w
WHERE p."folioId" = f.id AND f."reservationId" = w.id;

DELETE FROM "FolioSettlement" s
USING "Folio" f, _wipe_res w
WHERE s."folioId" = f.id AND f."reservationId" = w.id;

DELETE FROM "FolioDeposit" d
USING "Folio" f, _wipe_res w
WHERE d."folioId" = f.id AND f."reservationId" = w.id;

DELETE FROM "FolioCharge" c
USING "Folio" f, _wipe_res w
WHERE c."folioId" = f.id AND f."reservationId" = w.id;

DELETE FROM "FiscalDocument" fd USING _wipe_res w WHERE fd."reservationId" = w.id;
DELETE FROM "Folio" f USING _wipe_res w WHERE f."reservationId" = w.id;

DELETE FROM "Reservation" r USING _wipe_res w WHERE r.id = w.id;

DELETE FROM "Guest" g
USING _wipe_guests w
WHERE g.id = w.id
  AND NOT EXISTS (SELECT 1 FROM "Reservation" r WHERE r."guestId" = g.id)
  AND NOT EXISTS (SELECT 1 FROM "ReservationGuest" rg WHERE rg."guestId" = g.id);

UPDATE "Room" SET status = 'AVAILABLE'
WHERE "roomNumber" IN ('501','511');

COMMIT;

SELECT 'hotel_res_left' AS k, count(*)::text AS v
FROM "Reservation" r JOIN "Room" rm ON rm.id=r."roomId"
WHERE rm."roomNumber" IN ('501','511');
SQL

echo "=== CLINIC wipe ==="
docker exec -i era-postgres psql -U era -d era_clinic -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

CREATE TEMP TABLE _wipe_ep ON COMMIT DROP AS
SELECT e.id, e."patientRefId", e."globalPersonId"
FROM "ClinicalEpisode" e
WHERE e."roomNumber" IN ('501','511');

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

DELETE FROM "ClinicalEpisode" e USING _wipe_ep w WHERE e.id = w.id;

DELETE FROM "PatientRef" p
WHERE p.id IN (SELECT "patientRefId" FROM _wipe_ep WHERE "patientRefId" IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "ClinicalEpisode" e WHERE e."patientRefId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "LabOrder" lo WHERE lo."patientRefId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "Visit" v WHERE v."patientRefId" = p.id)
  AND NOT EXISTS (SELECT 1 FROM "Appointment" a WHERE a."patientRefId" = p.id);

COMMIT;

SELECT 'clinic_eps_left' AS k, count(*)::text AS v
FROM "ClinicalEpisode" WHERE "roomNumber" IN ('501','511');
SQL

echo "=== MDM wipe (orphan persons from wiped doors) ==="
while IFS= read -r MDM || [ -n "${MDM:-}" ]; do
  [ -z "$MDM" ] && continue
  GREF=$(docker exec -i era-postgres psql -U era -d era_hotel_pms -t -A -c "SELECT count(*) FROM \"Guest\" WHERE \"globalPersonId\" = '$MDM';")
  CREF=$(docker exec -i era-postgres psql -U era -d era_clinic -t -A -c "SELECT count(*) FROM \"PatientRef\" WHERE \"globalPersonId\" = '$MDM';")
  echo "MDM $MDM hotel=$GREF clinic=$CREF"
  if [ "$GREF" = "0" ] && [ "$CREF" = "0" ]; then
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
SELECT 'mdm_deleted' AS step, '$MDM' AS id;
SQL
  else
    echo "SKIP MDM $MDM — still referenced"
  fi
done < /tmp/wipe_501_511_mdm.txt

echo "=== POSTCHECK ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT count(*) AS hotel_res_501_511 FROM \"Reservation\" r
JOIN \"Room\" rm ON rm.id=r.\"roomId\" WHERE rm.\"roomNumber\" IN ('501','511');
SELECT \"roomNumber\", status FROM \"Room\" WHERE \"roomNumber\" IN ('501','511');
"
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT count(*) AS clinic_eps FROM \"ClinicalEpisode\" WHERE \"roomNumber\" IN ('501','511');
"
echo DONE
