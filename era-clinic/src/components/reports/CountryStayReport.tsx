"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListWorkspace,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  countryLabel,
  showApiError,
} from "@era/satellite-kit/ui";
import { billingPeriodKeyBaku } from "@era/satellite-kit/time";

type Row = { code: string; guests: number; nights: number; extras: number };
type SortKey = "country" | "guests" | "nights" | "extras";

export function CountryStayReport({
  origin,
  titleKey,
}: {
  origin: "IN_HOUSE" | "WALK_IN";
  titleKey: "patientCountryReport" | "walkInCountryReport";
}) {
  const t = useTranslations("patientCountryReport");
  const tc = useTranslations("common");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const initial = billingPeriodKeyBaku();
  const [year, setYear] = useState(initial.slice(0, 4));
  const [month, setMonth] = useState(initial.slice(5, 7));
  const [items, setItems] = useState<Row[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("guests");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    const period = `${year}-${month}`;
    const res = await fetch(
      `/api/reports/patients-by-country?month=${period}&origin=${origin}`,
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, tc("failed"));
      return;
    }
    const payload = data.data ?? data;
    setItems(Array.isArray(payload.items) ? payload.items : []);
  }, [year, month, origin, tc]);

  useEffect(() => {
    void load();
  }, [load]);

  const years = useMemo(() => {
    const current = Number(initial.slice(0, 4));
    return Array.from({ length: 6 }, (_, i) => String(current - i));
  }, [initial]);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "country") {
        const an = a.code ? countryLabel(locale, a.code) : "";
        const bn = b.code ? countryLabel(locale, b.code) : "";
        return an.localeCompare(bn) * dir;
      }
      return (a[sortKey] - b[sortKey]) * dir;
    });
    return copy;
  }, [items, sortKey, sortDir, locale]);

  const totals = useMemo(
    () =>
      items.reduce(
        (sum, row) => ({
          guests: sum.guests + row.guests,
          nights: sum.nights + row.nights,
          extras: sum.extras + row.extras,
        }),
        { guests: 0, nights: 0, extras: 0 },
      ),
    [items],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "country" ? "asc" : "desc");
    }
  }

  function mark(key: SortKey) {
    if (sortKey !== key) return " ↕";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const showNights = origin === "IN_HOUSE";

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={nav(titleKey)} subtitle={t(origin === "WALK_IN" ? "walkInSubtitle" : "subtitle")} />
      <EraListWorkspace
        toolbar={
          <div className="flex flex-wrap gap-3">
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("year")}
              value={year}
              onChange={(v) => setYear(String(v ?? year))}
              options={years.map((y) => ({ value: y, label: y }))}
              emptyLabel={null}
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("month")}
              value={month}
              onChange={(v) => setMonth(String(v ?? month))}
              options={Array.from({ length: 12 }, (_, i) => {
                const value = String(i + 1).padStart(2, "0");
                return { value, label: value };
              })}
              emptyLabel={null}
            />
          </div>
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  <button type="button" onClick={() => toggleSort("country")}>
                    {t("colCountry")}
                    {mark("country")}
                  </button>
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  <button type="button" onClick={() => toggleSort("guests")}>
                    {t("colGuests")}
                    {mark("guests")}
                  </button>
                </th>
                {showNights ? (
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    <button type="button" onClick={() => toggleSort("nights")}>
                      {t("colNights")}
                      {mark("nights")}
                    </button>
                  </th>
                ) : null}
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  <button type="button" onClick={() => toggleSort("extras")}>
                    {t("colExtras")}
                    {mark("extras")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={showNights ? 4 : 3}>
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.code || "unknown"} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.code ? countryLabel(locale, row.code) : "—"}
                    </td>
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{row.guests}</td>
                    {showNights ? (
                      <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{row.nights}</td>
                    ) : null}
                    <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                      {row.extras.toFixed(2)} AZN
                    </td>
                  </tr>
                ))
              )}
              <tr className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} font-semibold`}>{t("totalRow")}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right font-semibold`}>{totals.guests}</td>
                {showNights ? (
                  <td className={`${DATA_TABLE_TD_CLASS} text-right font-semibold`}>{totals.nights}</td>
                ) : null}
                <td className={`${DATA_TABLE_TD_CLASS} text-right font-semibold`}>
                  {totals.extras.toFixed(2)} AZN
                </td>
              </tr>
            </tbody>
          </table>
        }
      />
    </div>
  );
}
