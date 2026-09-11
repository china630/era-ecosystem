#!/bin/bash
set -euo pipefail
echo "=== Room 501 ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT id, \"roomNumber\", status FROM \"Room\" WHERE \"roomNumber\"='501';
"

echo "=== IN_HOUSE / live on 501 ==="
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT r.id, r.status, r.\"externalRef\", r.\"adults\", r.\"children\",
       g.\"fullName\", g.sex, g.\"globalPersonId\"
FROM \"Reservation\" r
JOIN \"Room\" rm ON rm.id=r.\"roomId\"
LEFT JOIN \"Guest\" g ON g.id=r.\"guestId\"
WHERE rm.\"roomNumber\"='501' AND r.status IN ('IN_HOUSE','CONFIRMED','DUE_IN','DUE_OUT')
ORDER BY r.status, r.\"externalRef\";
" 2>&1 || docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT column_name FROM information_schema.columns
WHERE table_name='Reservation' AND (
  column_name ILIKE '%adult%' OR column_name ILIKE '%share%' OR column_name ILIKE '%pax%'
  OR column_name ILIKE '%child%' OR column_name ILIKE '%sex%' OR column_name ILIKE '%gender%'
)
ORDER BY 1;
"
