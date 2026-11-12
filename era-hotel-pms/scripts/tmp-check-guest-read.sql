SELECT code, ("permissionsJson" LIKE '%api:guests.read%') AS guests
FROM "Role"
WHERE code = 'Hotel_Admin';
