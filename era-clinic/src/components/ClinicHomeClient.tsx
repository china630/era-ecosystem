"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DatePicker,
  PageHeader,
} from "@era/satellite-kit/ui";
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
  const today = todayBaku();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-6">
        <div
          className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-3 px-4 py-3`}
        >
          <DatePicker
            label={t("dateFrom")}
            value={from}
            onChange={(v) => {
              setFrom(v);
              if (v > to) setTo(v);
            }}
            placeholder={tc("datePlaceholder")}
            openCalendarLabel={tc("openCalendar")}
          />
          <DatePicker
            label={t("dateTo")}
            value={to}
            onChange={(v) => {
              setTo(v);
              if (v < from) setFrom(v);
            }}
            placeholder={tc("datePlaceholder")}
            openCalendarLabel={tc("openCalendar")}
          />
        </div>

        {showExecutive ? (
          <div className={`${CARD_CONTAINER_CLASS} p-6`}>
            <ExecutiveDashboard from={from} to={to} />
          </div>
        ) : null}

        <OpsHomeDashboard from={from} to={to} />
      </div>
    </div>
  );
}
