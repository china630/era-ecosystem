#!/bin/bash
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT r.id, r.status, r.\"externalRef\", rm.\"roomNumber\", r.\"guestId\"
FROM \"Reservation\" r
LEFT JOIN \"Room\" rm ON rm.id=r.\"roomId\"
WHERE r.\"guestId\"='7dbd5ab1-7f93-4c95-93ee-aab3092d2b63'
   OR r.id='f71e4907-5e52-43f1-911f-1b2fae84896c';

SELECT rg.* FROM \"ReservationGuest\" rg
WHERE rg.\"guestId\"='7dbd5ab1-7f93-4c95-93ee-aab3092d2b63';
"
