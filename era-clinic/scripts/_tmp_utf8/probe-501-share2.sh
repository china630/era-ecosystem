#!/bin/bash
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT column_name FROM information_schema.columns
WHERE table_name='Guest' AND (column_name ILIKE '%sex%' OR column_name ILIKE '%gender%' OR column_name ILIKE '%title%');
"
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT r.status, r.\"externalRef\", r.adults,
       r.\"shareEligible\", r.\"shareGender\", r.\"shareBedIndex\", r.\"shareNo\",
       g.\"fullName\", g.gender, g.title, rm.\"roomNumber\", rm.\"maxBed\"
FROM \"Reservation\" r
JOIN \"Room\" rm ON rm.id=r.\"roomId\"
LEFT JOIN \"Guest\" g ON g.id=r.\"guestId\"
WHERE rm.\"roomNumber\" IN ('501','511')
  AND r.status IN ('IN_HOUSE','CONFIRMED')
ORDER BY rm.\"roomNumber\", r.status, r.\"externalRef\";
"
