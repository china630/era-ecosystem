ALTER TABLE "outlets" ADD COLUMN "terminal_revoked_at" TIMESTAMP(3);
ALTER TABLE "staff_rosters" ADD COLUMN "pin_fail_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "staff_rosters" ADD COLUMN "pin_locked_until" TIMESTAMP(3);
