"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  Field,
  PageHeader,
  showApiError,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { bakuDateTimeDisplay } from "@era/satellite-kit/time";

type LoginRow = {
  id: string;
  login: string;
  fullName: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
};

export default function RetailLoginsPage() {
  const t = useTranslations("logins");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    void (async () => {
      const res = await fetch(`/api/admin/user-logins?${params.toString()}`);
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("loadError"));
        return;
      }
      setRows(await res.json());
    })();
  }, [debouncedQ, from, to, tc]);

  return (
    <div className="grid gap-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <EraListFilterBar>
        <Field
          label={t("search")}
          preset="longText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <DatePicker
          label={t("from")}
          value={from}
          onChange={setFrom}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
        <DatePicker
          label={t("to")}
          value={to}
          onChange={setTo}
          placeholder={tc("datePlaceholder")}
          openCalendarLabel={tc("openCalendar")}
        />
      </EraListFilterBar>
      <div className={CARD_CONTAINER_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colWhen")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colLogin")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colIp")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} text-[#7F8C8D]`} colSpan={4}>
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(row.createdAt)}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{row.login}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.fullName}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.ipAddress ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
