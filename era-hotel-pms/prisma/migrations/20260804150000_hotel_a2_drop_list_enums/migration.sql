-- A2 cutover: drop Prisma enums for note / event line / concierge category → TEXT codes
ALTER TABLE "ReservationNote" ALTER COLUMN "noteType" TYPE TEXT USING "noteType"::text;

ALTER TABLE "EventOrderLine" ALTER COLUMN "kind" TYPE TEXT USING "kind"::text;
ALTER TABLE "EventOrderLine" ALTER COLUMN "kind" SET DEFAULT 'OTHER';

ALTER TABLE "ConciergeProduct" ALTER COLUMN "category" TYPE TEXT USING "category"::text;
ALTER TABLE "ConciergeProduct" ALTER COLUMN "category" SET DEFAULT 'EXCURSION';

DROP TYPE "ReservationNoteType";
DROP TYPE "EventOrderLineKind";
DROP TYPE "ConciergeProductCategory";
