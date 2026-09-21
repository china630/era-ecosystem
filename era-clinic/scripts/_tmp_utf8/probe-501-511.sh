#!/bin/bash
docker exec era-postgres psql -U era -d era_hotel_pms -c "SELECT count(*) AS hotel_res FROM \"Reservation\" r JOIN \"Room\" rm ON rm.id=r.\"roomId\" WHERE rm.\"roomNumber\" IN ('501','511');"
docker exec era-postgres psql -U era -d era_clinic -c "SELECT count(*) AS clinic_eps FROM \"ClinicalEpisode\" WHERE \"roomNumber\" IN ('501','511');"
