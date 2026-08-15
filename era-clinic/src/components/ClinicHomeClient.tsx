"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  PageHeader,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { RefreshCw } from "lucide-react";
import { OpsHomeDashboard } from "@/components/OpsHomeDashboard";
import { ExecutiveDashboard } from "@/components/ExecutiveDashboard";

function todayBaku(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function ClinicHomeClient({ showExecutive }: { showExecutive: boolean }) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const [date, setDate] = useState(todayBaku);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-6 pb-10">
        <div
          className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end justify-between gap-3 px-4 py-3`}
        >
          <DatePicker
            label={t("filterDate")}
            value={date}
            onChange={setDate}
            placeholder={tc("datePlaceholder")}
            openCalendarLabel={tc("openCalendar")}
          />
          <button
            type="button"
            className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center gap-1.5`}
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            {t("refresh")}
          </button>
        </div>

        {showExecutive ? (
          <div className={`${CARD_CONTAINER_CLASS} p-6`}>
            <ExecutiveDashboard date={date} refreshKey={refreshKey} />
          </div>
        ) : null}

        <OpsHomeDashboard date={date} refreshKey={refreshKey} />
      </div>
    </>
  );
}
