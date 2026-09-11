#!/bin/bash
docker exec era-postgres psql -U era -d era_hotel_pms -c "SELECT r.status, r.\"shareEligible\", r.adults, rm.\"roomNumber\", g.\"fullName\", r.\"externalRef\" FROM \"Reservation\" r JOIN \"Room\" rm ON rm.id=r.\"roomId\" LEFT JOIN \"Guest\" g ON g.id=r.\"guestId\" WHERE rm.\"roomNumber\" IN ('501','511') ORDER BY 4,1;"
docker exec era-postgres psql -U era -d era_clinic -c "SELECT e.status, e.\"roomNumber\", p.\"refCode\", p.\"fullName\" FROM \"ClinicalEpisode\" e LEFT JOIN \"PatientRef\" p ON p.id=e.\"patientRefId\" WHERE e.\"roomNumber\" IN ('501','511');"
