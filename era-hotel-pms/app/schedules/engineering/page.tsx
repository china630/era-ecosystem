"use client";

import { useTranslations } from "next-intl";
import { DutyScheduleBoard } from "@/components/duty-schedules/DutyScheduleBoard";

export default function EngineeringSchedulePage() {
  const t = useTranslations("dutySchedules");
  return (
    <DutyScheduleBoard
      dept="ENGINEERING"
      title={t("engineering")}
      subtitle={t("engineeringOpsHint")}
    />
  );
}
