#!/bin/bash
set -euo pipefail

echo "=== Rooms 501/511 ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT id, \"roomNumber\", status FROM \"Room\" WHERE \"roomNumber\" IN ('501','511');
"

echo "=== Reservations currently on 501/511 ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT res.id, res.status, res.\"externalRef\", res.\"roomId\", r.\"roomNumber\",
       g.id AS guest_id, g.\"fullName\", g.\"globalPersonId\"
FROM \"Reservation\" res
JOIN \"Room\" r ON r.id = res.\"roomId\"
LEFT JOIN \"Guest\" g ON g.id = res.\"guestId\"
WHERE r.\"roomNumber\" IN ('501','511')
ORDER BY r.\"roomNumber\", res.status;
"

echo "=== Known res UUIDs (from earlier) ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT res.id, res.status, res.\"externalRef\", r.\"roomNumber\",
       g.id AS guest_id, g.\"fullName\", g.\"globalPersonId\"
FROM \"Reservation\" res
LEFT JOIN \"Room\" r ON r.id = res.\"roomId\"
LEFT JOIN \"Guest\" g ON g.id = res.\"guestId\"
WHERE res.id IN (
  '787e4432-ebf1-436e-8381-d1f08cedcebf',
  'f71e4907-5e52-43f1-911f-1b2fae84896c'
);
"

echo "=== Clinic episodes for those reservations / rooms ==="
docker exec -i era-postgres psql -U era -d era_clinic -c "
SELECT e.id, e.status, e.\"programCode\", e.\"roomNumber\", e.\"reservationId\",
       e.\"patientRefId\", e.\"globalPersonId\", p.\"refCode\", p.\"fullName\"
FROM \"ClinicalEpisode\" e
LEFT JOIN \"PatientRef\" p ON p.id = e.\"patientRefId\"
WHERE e.\"roomNumber\" IN ('501','511')
   OR e.\"reservationId\" IN (
     '787e4432-ebf1-436e-8381-d1f08cedcebf',
     'f71e4907-5e52-43f1-911f-1b2fae84896c'
   );
"
