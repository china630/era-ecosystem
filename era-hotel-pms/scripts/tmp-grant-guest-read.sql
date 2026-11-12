UPDATE "Role"
SET "permissionsJson" = replace("permissionsJson", '[', '["api:guests.read",')
WHERE code = 'Hotel_Admin'
  AND "permissionsJson" NOT LIKE '%api:guests.read%';
