CREATE TYPE "WalkInPartyStatus" AS ENUM ('DRAFT', 'SENT_TO_CASHIER', 'PAID');

CREATE TABLE "walk_in_parties" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "visitDate" DATE NOT NULL,
  "status" "WalkInPartyStatus" NOT NULL DEFAULT 'DRAFT',
  "receipt_ref" TEXT,
  "created_by_user_id" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "walk_in_parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "walk_in_party_guests" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "party_id" TEXT NOT NULL,
  "sort_order" INT NOT NULL,
  "patient_ref_id" TEXT NOT NULL,
  "clinical_episode_id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "walk_in_party_guests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "walk_in_parties_organizationId_visitDate_idx" ON "walk_in_parties"("organizationId", "visitDate");
CREATE UNIQUE INDEX "walk_in_party_guests_party_id_sort_order_key" ON "walk_in_party_guests"("party_id", "sort_order");
CREATE INDEX "walk_in_party_guests_organizationId_idx" ON "walk_in_party_guests"("organizationId");
CREATE INDEX "walk_in_party_guests_clinical_episode_id_idx" ON "walk_in_party_guests"("clinical_episode_id");

ALTER TABLE "walk_in_party_guests"
  ADD CONSTRAINT "walk_in_party_guests_party_id_fkey"
  FOREIGN KEY ("party_id") REFERENCES "walk_in_parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "walk_in_party_guests"
  ADD CONSTRAINT "walk_in_party_guests_patient_ref_id_fkey"
  FOREIGN KEY ("patient_ref_id") REFERENCES "PatientRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "walk_in_party_guests"
  ADD CONSTRAINT "walk_in_party_guests_clinical_episode_id_fkey"
  FOREIGN KEY ("clinical_episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LabOrder" ADD COLUMN "settlement_pending_id" TEXT;
ALTER TABLE "LabOrder" ADD COLUMN "settled_at" TIMESTAMP(3);
