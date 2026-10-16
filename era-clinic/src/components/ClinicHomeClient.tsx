"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
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

type Practitioner = { id: string; fullName: string };

export function ClinicHomeClient({ showExecutive }: { showExecutive: boolean }) {
  const t = useTranslations("home");
  const te = useTranslations("executive");
  const tc = useTranslations("common");
  const [date, setDate] = useState(todayBaku);
  const [refreshKey, setRefreshKey] = useState(0);
  const [practitionerId, setPractitionerId] = useState("");
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);

  useEffect(() => {
    if (!showExecutive) return;
    void fetch("/api/admin/practitioners")
      .then((res) => res.json())
      .then((data) => {
        const rows = (data.data ?? data) as Practitioner[];
        if (Array.isArray(rows)) setPractitioners(rows);
      })
      .catch(() => undefined);
  }, [showExecutive]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="space-y-6">
        <div
          className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end justify-between gap-3 px-4 py-3`}
        >
          <div className="flex flex-wrap items-end gap-3">
            <DatePicker
              label={t("filterDate")}
              value={date}
              onChange={setDate}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
            {showExecutive ? (
              <div className="w-56">
                <CatalogField
                  kind="SEARCHABLE"
                  label={te("filterPractitioner")}
                  value={practitionerId}
                  onChange={(value) => setPractitionerId(String(value ?? ""))}
                  options={[
                    { value: "", label: tc("all") },
                    ...practitioners.map((row) => ({ value: row.id, label: row.fullName })),
                  ]}
                  emptyLabel={tc("all")}
                />
              </div>
            ) : null}
          </div>
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
            <ExecutiveDashboard
              date={date}
              refreshKey={refreshKey}
              practitionerId={practitionerId}
            />
          </div>
        ) : null}

        <OpsHomeDashboard date={date} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
