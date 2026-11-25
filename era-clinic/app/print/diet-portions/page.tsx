"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DatePicker } from "@era/satellite-kit/ui";
import { todayBakuYmd } from "@/lib/baku-day";

type PortionTable = {
  dietCode: string;
  dietTitle: string;
  rows: Array<{ patientName: string; refCode: string; roomOrCase: string | null }>;
};

export default function PrintDietPortionsPage() {
  const t = useTranslations("diet");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [dateYmd, setDateYmd] = useState(todayBakuYmd());
  const [tables, setTables] = useState<PortionTable[]>([]);

  useEffect(() => {
    void fetch(`/api/diet-portions?date=${encodeURIComponent(dateYmd)}&locale=${locale}`)
      .then((r) => r.json())
      .then((d) => setTables((d.tables ?? []) as PortionTable[]));
  }, [dateYmd, locale]);

  return (
    <main className="mx-auto max-w-3xl p-6 text-sm text-black print:p-4">
      <h1 className="mb-2 text-lg font-semibold">{t("portionTitle")}</h1>
      <p className="mb-4 text-slate-600">
        {t("portionDate")}: {dateYmd}
      </p>
      <div className="mb-4 print:hidden">
        <DatePicker
          label={t("portionDate")}
          value={dateYmd}
          onChange={(v) => setDateYmd(v || todayBakuYmd())}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
      </div>
      {tables.length === 0 ? (
        <p>{t("portionEmpty")}</p>
      ) : (
        tables.map((tbl) => (
          <section key={tbl.dietCode} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 font-semibold">
              {tbl.dietCode} — {tbl.dietTitle} ({tbl.rows.length})
            </h2>
            <table className="w-full border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-2 py-1 text-left">{t("colPatient")}</th>
                  <th className="border border-slate-300 px-2 py-1 text-left">{t("colRef")}</th>
                  <th className="border border-slate-300 px-2 py-1 text-left">{t("colRoom")}</th>
                </tr>
              </thead>
              <tbody>
                {tbl.rows.map((row, idx) => (
                  <tr key={`${row.refCode}-${idx}`}>
                    <td className="border border-slate-300 px-2 py-1">{row.patientName}</td>
                    <td className="border border-slate-300 px-2 py-1">{row.refCode}</td>
                    <td className="border border-slate-300 px-2 py-1">{row.roomOrCase ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </main>
  );
}