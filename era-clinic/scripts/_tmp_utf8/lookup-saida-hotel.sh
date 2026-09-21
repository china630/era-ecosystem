#!/bin/bash
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT r.id, r.status, r.\"externalRef\", r.\"roomId\",
       g.\"fullName\", left(coalesce(g.\"globalPersonId\",''), 16) AS mdm
FROM \"Reservation\" r
LEFT JOIN \"Guest\" g ON g.id = r.\"guestId\"
WHERE r.id IN (
  '787e4432-ebf1-436e-8381-d1f08cedcebf',
  'f71e4907-5e52-43f1-911f-1b2fae84896c'
);
"
