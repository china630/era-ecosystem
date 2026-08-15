-- CreateEnum
CREATE TYPE "PractitionerSchedulePattern" AS ENUM ('WEEKLY', 'WEEK_PARITY', 'MONTH_DAY_PARITY', 'CYCLE');

-- CreateEnum
CREATE TYPE "ScheduleParity" AS ENUM ('EVEN', 'ODD');

-- CreateEnum
CREATE TYPE "PractitionerScheduleExceptionKind" AS ENUM ('DAY_OFF', 'EXTRA_SHIFT', 'CUSTOM_HOURS');

-- CreateTable
CREATE TABLE "PractitionerScheduleRule" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "pattern" "PractitionerSchedulePattern" NOT NULL,
    "weekdays_json" TEXT,
    "parity" "ScheduleParity",
    "cycle_anchor" TIMESTAMP(3),
    "cycle_length_days" INTEGER,
    "cycle_offsets_json" TEXT,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,
    "effective_from" TIMESTAMP(3),
    "effective_to" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PractitionerScheduleRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PractitionerScheduleException" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" "PractitionerScheduleExceptionKind" NOT NULL,
    "start_minute" INTEGER,
    "end_minute" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PractitionerScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PractitionerScheduleRule_practitioner_id_active_idx" ON "PractitionerScheduleRule"("practitioner_id", "active");

-- CreateIndex
CREATE INDEX "PractitionerScheduleException_practitioner_id_date_idx" ON "PractitionerScheduleException"("practitioner_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PractitionerScheduleException_practitioner_id_date_kind_key" ON "PractitionerScheduleException"("practitioner_id", "date", "kind");

-- AddForeignKey
ALTER TABLE "PractitionerScheduleRule" ADD CONSTRAINT "PractitionerScheduleRule_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerScheduleException" ADD CONSTRAINT "PractitionerScheduleException_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
