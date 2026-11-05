"use client";

import { useTranslations } from "next-intl";
import { DutyScheduleBoard } from "@/components/duty-schedules/DutyScheduleBoard";

export default function SecuritySchedulePage() {
  const t = useTranslations("dutySchedules");
  return (
    <DutyScheduleBoard
      dept="SECURITY"
      title={t("security")}
      subtitle={t("securityOpsHint")}
    />
  );
}
