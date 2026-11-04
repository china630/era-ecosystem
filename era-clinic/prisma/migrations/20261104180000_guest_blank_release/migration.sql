CREATE TYPE "GuestBlankRelease" AS ENUM ('PAY_WITH_WORK', 'AFTER_PAYMENT');

ALTER TABLE "DiagnosticService"
  ADD COLUMN "guest_blank_release" "GuestBlankRelease" NOT NULL DEFAULT 'PAY_WITH_WORK';

ALTER TABLE "LabOrder"
  ADD COLUMN "release_after_pay" BOOLEAN NOT NULL DEFAULT false;
