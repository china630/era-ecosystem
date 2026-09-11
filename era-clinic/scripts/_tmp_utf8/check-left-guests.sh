#!/bin/bash
MDM='3803a504-c29a-4708-ba22-67f60d496a31'
docker exec -i era-postgres psql -U era -d era_hotel_pms -c "
SELECT g.id, g.\"fullName\", g.\"globalPersonId\",
  (SELECT count(*) FROM \"Reservation\" r WHERE r.\"guestId\"=g.id) AS as_primary,
  (SELECT count(*) FROM \"ReservationGuest\" rg WHERE rg.\"guestId\"=g.id) AS as_party,
  (SELECT count(*) FROM \"GuestFamily\" gf WHERE gf.\"guestId\"=g.id OR gf.\"relatedGuestId\"=g.id) AS family
FROM \"Guest\" g
WHERE g.id IN (
  '153132d5-a832-4717-aa8f-774931d3fb2b',
  '151addac-fb4d-4797-812b-dcbd7037d893',
  '7dbd5ab1-7f93-4c95-93ee-aab3092d2b63'
) OR g.\"globalPersonId\"='$MDM';
"
