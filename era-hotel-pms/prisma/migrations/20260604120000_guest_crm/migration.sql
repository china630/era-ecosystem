-- Guest CRM + reservation details (ElectraWeb parity)

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "bookerGuestId" TEXT;
CREATE INDEX IF NOT EXISTS "Reservation_bookerGuestId_idx" ON "Reservation"("bookerGuestId");
DO $$ BEGIN
  ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bookerGuestId_fkey"
    FOREIGN KEY ("bookerGuestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "GuestTag" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuestTag_guestId_name_key" ON "GuestTag"("guestId", "name");
CREATE INDEX IF NOT EXISTS "GuestTag_guestId_idx" ON "GuestTag"("guestId");

CREATE TABLE IF NOT EXISTS "GuestArchiveFile" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestArchiveFile_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestArchiveFile_guestId_idx" ON "GuestArchiveFile"("guestId");

CREATE TABLE IF NOT EXISTS "GuestPreference" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "preference" TEXT NOT NULL,
    "note" TEXT,
    "importance" TEXT,
    "department" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestPreference_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestPreference_guestId_idx" ON "GuestPreference"("guestId");

CREATE TABLE IF NOT EXISTS "GuestAllergen" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "allergen" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestAllergen_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestAllergen_guestId_idx" ON "GuestAllergen"("guestId");

CREATE TABLE IF NOT EXISTS "GuestSpecialDate" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "dateType" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestSpecialDate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestSpecialDate_guestId_idx" ON "GuestSpecialDate"("guestId");

CREATE TABLE IF NOT EXISTS "GuestFavoriteRoom" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "roomType" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestFavoriteRoom_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestFavoriteRoom_guestId_idx" ON "GuestFavoriteRoom"("guestId");

CREATE TABLE IF NOT EXISTS "GuestComment" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "commentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'NEW',
    "comment" TEXT NOT NULL,
    "answer" TEXT,
    "source" TEXT,
    "actionType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestComment_guestId_idx" ON "GuestComment"("guestId");

CREATE TABLE IF NOT EXISTS "GuestSurvey" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "surveyName" TEXT NOT NULL,
    "filledAt" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestSurvey_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestSurvey_guestId_idx" ON "GuestSurvey"("guestId");

CREATE TABLE IF NOT EXISTS "GuestIncident" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestIncident_guestId_idx" ON "GuestIncident"("guestId");

CREATE TABLE IF NOT EXISTS "GuestCommunication" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "recipient" TEXT,
    "status" TEXT NOT NULL DEFAULT 'STUB',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestCommunication_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestCommunication_guestId_idx" ON "GuestCommunication"("guestId");

CREATE TABLE IF NOT EXISTS "GuestContactLog" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "contactDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "operator" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestContactLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GuestContactLog_guestId_idx" ON "GuestContactLog"("guestId");

CREATE TABLE IF NOT EXISTS "GuestFamily" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "relatedGuestId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuestFamily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuestFamily_guestId_relatedGuestId_key" ON "GuestFamily"("guestId", "relatedGuestId");
CREATE INDEX IF NOT EXISTS "GuestFamily_guestId_idx" ON "GuestFamily"("guestId");

ALTER TABLE "GuestTag" ADD CONSTRAINT "GuestTag_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestArchiveFile" ADD CONSTRAINT "GuestArchiveFile_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestPreference" ADD CONSTRAINT "GuestPreference_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAllergen" ADD CONSTRAINT "GuestAllergen_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSpecialDate" ADD CONSTRAINT "GuestSpecialDate_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFavoriteRoom" ADD CONSTRAINT "GuestFavoriteRoom_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestComment" ADD CONSTRAINT "GuestComment_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestSurvey" ADD CONSTRAINT "GuestSurvey_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestIncident" ADD CONSTRAINT "GuestIncident_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestCommunication" ADD CONSTRAINT "GuestCommunication_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestContactLog" ADD CONSTRAINT "GuestContactLog_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFamily" ADD CONSTRAINT "GuestFamily_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestFamily" ADD CONSTRAINT "GuestFamily_relatedGuestId_fkey" FOREIGN KEY ("relatedGuestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
