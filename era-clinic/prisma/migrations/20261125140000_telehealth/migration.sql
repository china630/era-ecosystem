-- MED-P1-02 telehealth on appointments

CREATE TYPE "AppointmentMode" AS ENUM ('IN_PERSON', 'VIDEO');

ALTER TABLE "Appointment"
  ADD COLUMN "mode" "AppointmentMode" NOT NULL DEFAULT 'IN_PERSON',
  ADD COLUMN "video_room_url" TEXT,
  ADD COLUMN "video_provider" TEXT;