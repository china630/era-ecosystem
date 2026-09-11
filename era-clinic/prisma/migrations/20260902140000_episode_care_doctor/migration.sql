-- CLI-56 episode care team (multi-doctor)
CREATE TABLE "episode_care_doctor" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" TEXT,

    CONSTRAINT "episode_care_doctor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "episode_care_doctor_episode_id_practitioner_id_key" ON "episode_care_doctor"("episode_id", "practitioner_id");
CREATE INDEX "episode_care_doctor_practitioner_id_idx" ON "episode_care_doctor"("practitioner_id");
CREATE INDEX "episode_care_doctor_episode_id_assigned_at_idx" ON "episode_care_doctor"("episode_id", "assigned_at");

ALTER TABLE "episode_care_doctor" ADD CONSTRAINT "episode_care_doctor_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "ClinicalEpisode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "episode_care_doctor" ADD CONSTRAINT "episode_care_doctor_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
