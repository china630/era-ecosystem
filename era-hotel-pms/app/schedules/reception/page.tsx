"use client";

import { useTranslations } from "next-intl";
import { DutyScheduleBoard } from "@/components/duty-schedules/DutyScheduleBoard";

export default function ReceptionSchedulePage() {
  const t = useTranslations("dutySchedules");
  return (
    <DutyScheduleBoard
      dept="RECEPTION"
      title={t("reception")}
      subtitle={t("receptionOpsHint")}
    />
  );
}
