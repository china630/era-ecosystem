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
  DATA_TABLE_VIEWPORT_CLASS,
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

export default function ClinicAdminLoginsPage() {
  const t = useTranslations("adminAccess");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<LoginRow[]>([]);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams();
        if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(`/api/admin/user-logins?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          showApiError(data, tc("loadError"));
          setRows([]);
          return;
        }
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled) return;
        showApiError({ error: e instanceof Error ? e.message : tc("loadError") });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, from, to, tc]);

  return (
    <div className="space-y-4 p-4">
      <PageHeader title={t("loginsTitle")} subtitle={t("loginsSubtitle")} />
      <EraListFilterBar
        resetLabel={tc("filterReset")}
        onReset={() => {
          setQ("");
          setFrom("");
          setTo("");
        }}
      >
        <Field
          label={tc("search")}
          preset="shortText"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <DatePicker
          label={t("filterFrom")}
          value={from}
          onChange={setFrom}
          placeholder={tc("datePlaceholder")}
        />
        <DatePicker
          label={t("filterTo")}
          value={to}
          onChange={setTo}
          placeholder={tc("datePlaceholder")}
        />
      </EraListFilterBar>
      <div className={CARD_CONTAINER_CLASS}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colWhen")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colLogin")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colIp")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAgent")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={5}>
                    {t("loginsEmpty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{bakuDateTimeDisplay(row.createdAt)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.login}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.fullName}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.ipAddress ?? "—"}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.userAgent ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
