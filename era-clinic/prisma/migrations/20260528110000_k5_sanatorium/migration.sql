-- K5 Sanatorium bridge

ALTER TABLE "PatientRef" ADD COLUMN "globalPersonId" TEXT;

CREATE TABLE "ClinicalEpisode" (
    "id" TEXT NOT NULL,
    "patientRefId" TEXT,
    "globalPersonId" TEXT,
    "hotelStayId" TEXT,
    "reservationId" TEXT,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "ClinicalEpisode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalComplaint" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicalComplaint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalDiagnosis" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "icdCode" TEXT,
    "description" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicalDiagnosis_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LabOrder" ADD COLUMN "clinicalEpisodeId" TEXT;

CREATE INDEX "ClinicalEpisode_reservationId_idx" ON "ClinicalEpisode"("reservationId");
CREATE INDEX "ClinicalEpisode_organizationId_status_idx" ON "ClinicalEpisode"("organizationId", "status");
CREATE INDEX "ClinicalComplaint_episodeId_idx" ON "ClinicalComplaint"("episodeId");
CREATE INDEX "ClinicalDiagnosis_episodeId_idx" ON "ClinicalDiagnosis"("episodeId");
CREATE INDEX "LabOrder_clinicalEpisodeId_idx" ON "LabOrder"("clinicalEpisodeId");

ALTER TABLE "ClinicalEpisode" ADD CONSTRAINT "ClinicalEpisode_patientRefId_fkey" FOREIGN KEY ("patientRefId") REFERENCES "PatientRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalComplaint" ADD CONSTRAINT "ClinicalComplaint_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "ClinicalEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalDiagnosis" ADD CONSTRAINT "ClinicalDiagnosis_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "ClinicalEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_clinicalEpisodeId_fkey" FOREIGN KEY ("clinicalEpisodeId") REFERENCES "ClinicalEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
