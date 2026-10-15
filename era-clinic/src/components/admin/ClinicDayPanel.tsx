"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DatePicker,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { useClinicAuth } from "@/hooks/useClinicAuth";

export function ClinicDayPanel() {
  const t = useTranslations("adminSettings");
  const tc = useTranslations("common");
  const { auth } = useClinicAuth();
  const [dayYmd, setDayYmd] = useState("");
  const [closed, setClosed] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!auth?.isPlatformSuperAdmin) return null;

  async function saveDay() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clinic-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayYmd, closed, endHour: closed ? null : 17 }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("clinicDaySaved"));
        return;
      }
      showSuccess(t("clinicDaySaved"));
    } finally {
      setBusy(false);
    }
  }

  async function recalc(apply: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/schedule-recalc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const data = await res.json();
      if (!res.ok) {
        showApiError(data, t("recalcSchedule"));
        return;
      }
      const count = (data.data?.moves ?? data.moves ?? []).length;
      if (apply) showSuccess(t("recalcScheduleDone", { count }));
      else showSuccess(t("recalcScheduleDone", { count }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 space-y-2 rounded-lg border border-[#D5DADF] bg-white p-4">
      <h2 className="text-sm font-medium">{t("recalcSchedule")}</h2>
      <div className="flex flex-wrap items-end gap-2">
        <DatePicker label={tc("date")} placeholder={tc("datePlaceholder")} value={dayYmd} onChange={setDayYmd} />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("closedWeekdays")}
          value={closed ? "closed" : "open"}
          onChange={(value) => setClosed(value === "closed")}
          options={[
            { value: "closed", label: t("clinicDayClosed") },
            { value: "open", label: t("clinicDayOpen") },
          ]}
        />
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy || !dayYmd} onClick={() => void saveDay()}>
          {t("clinicDaySave")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} disabled={busy} onClick={() => void recalc(false)}>
          {t("recalcSchedulePreview")}
        </button>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={busy} onClick={() => void recalc(true)}>
          {t("recalcSchedule")}
        </button>
      </div>
    </section>
  );
}
