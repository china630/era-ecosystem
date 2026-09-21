#!/bin/bash
set -euo pipefail
echo "=== Clinic episodes P-001854 ==="
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT e.id, e.status, e.\"programCode\", e.\"roomNumber\",
       e.\"reservationId\", e.\"globalPersonId\",
       left(coalesce(e.anamnesis_text,''),30) AS anam,
       p.\"refCode\", p.\"fullName\", p.\"globalPersonId\" AS patient_mdm
FROM \"ClinicalEpisode\" e
JOIN \"PatientRef\" p ON p.id=e.\"patientRefId\"
WHERE p.\"refCode\"='P-001854'
ORDER BY e.\"openedAt\";
"

echo "=== Hotel guests/reservations around those res ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT g.id AS guest_id, g.\"fullName\", g.\"globalPersonId\",
       r.id AS res_id, r.status, r.\"externalRef\"
FROM \"Reservation\" r
JOIN \"Guest\" g ON g.id=r.\"guestId\"
WHERE r.id IN (
  '787e4432-ebf1-436e-8381-d1f08cedcebf',
  'f71e4907-5e52-43f1-911f-1b2fae84896c'
);
"

echo "=== Guests with same MDM prefix ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT g.id, g.\"fullName\", g.\"globalPersonId\"
FROM \"Guest\" g
WHERE g.\"globalPersonId\" LIKE '3803a504-c29a-47%'
ORDER BY g.\"fullName\";
"

echo "=== MDM person + identifiers ==="
GPID=\$(docker exec -i era-postgres psql -U era -d era_hotel_pms -t -A -c \"SELECT DISTINCT \\\"globalPersonId\\\" FROM \\\"Guest\\\" WHERE \\\"globalPersonId\\\" LIKE '3803a504-c29a-47%' LIMIT 1;\")
echo \"GPID=\$GPID\"
docker exec -i era-postgres psql -U era -d era_mdm -c \"
SELECT id, \\\"fullName\\\", \\\"firstName\\\", \\\"lastName\\\"
FROM \\\"GlobalNaturalPerson\\\"
WHERE id = '\$GPID';
\" 2>/dev/null || docker exec -i era-postgres psql -U era -d era_mdm -c \"
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%person%' LIMIT 20;
\"
