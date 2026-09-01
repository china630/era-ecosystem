-- Wipe hotel transactional ops for Nafta org (variant A re-import).
BEGIN;

DELETE FROM "MedicalAlert" m
USING "Guest" g
WHERE m."guestId" = g.id AND g."organizationId" = '__ORG__';

DELETE FROM "FolioPayment" fp
USING "Folio" f
WHERE fp."folioId" = f.id AND f."organizationId" = '__ORG__';

DELETE FROM "FolioCharge" fc
USING "Folio" f
WHERE fc."folioId" = f.id AND f."organizationId" = '__ORG__';

DELETE FROM "FolioSettlement" fs
USING "Folio" f
WHERE fs."folioId" = f.id AND f."organizationId" = '__ORG__';

DELETE FROM "FolioDeposit" fd
USING "Folio" f
WHERE fd."folioId" = f.id AND f."organizationId" = '__ORG__';

DELETE FROM "FiscalDocument" fd
USING "Reservation" r
WHERE fd."reservationId" = r.id AND r."organizationId" = '__ORG__';

DELETE FROM "Folio" WHERE "organizationId" = '__ORG__';

DELETE FROM "Stay" s
USING "Reservation" r
WHERE s."reservationId" = r.id AND r."organizationId" = '__ORG__';

DELETE FROM "ReservationDailyRate" dr
USING "Reservation" r
WHERE dr."reservationId" = r.id AND r."organizationId" = '__ORG__';

DELETE FROM "ReservationGuest" rg
USING "Reservation" r
WHERE rg."reservationId" = r.id AND r."organizationId" = '__ORG__';

DELETE FROM "ReservationNote" rn
USING "Reservation" r
WHERE rn."reservationId" = r.id AND r."organizationId" = '__ORG__';

DELETE FROM "ReservationAttachment" ra
USING "Reservation" r
WHERE ra."reservationId" = r.id AND r."organizationId" = '__ORG__';

DELETE FROM "Reservation" WHERE "organizationId" = '__ORG__';

DELETE FROM "ElektrawebFolioOutbox" WHERE "organizationId" = '__ORG__';

DELETE FROM "Guest" WHERE "organizationId" = '__ORG__';

UPDATE "Room"
SET status = 'AVAILABLE'
WHERE "organizationId" = '__ORG__' AND deleted = false;

COMMIT;

SELECT 'Guest' AS tbl, count(*) FROM "Guest" WHERE "organizationId" = '__ORG__'
UNION ALL
SELECT 'Reservation', count(*) FROM "Reservation" WHERE "organizationId" = '__ORG__'
UNION ALL
SELECT 'Folio', count(*) FROM "Folio" WHERE "organizationId" = '__ORG__';
