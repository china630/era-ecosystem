"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  EraListFilterBar,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
} from "@era/satellite-kit/ui";
import { bakuDateDisplay, bakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type CompareKind =
  | "no_show"
  | "unscheduled"
  | "worked_on_leave"
  | "matched"
  | "expected_leave";

type CompareRow = {
  employmentId: string;
  globalPersonId: string | null;
  day: number;
  date: string;
  kind: CompareKind;
  plan: "WORK" | "OFF" | null;
  planPlaceCode: string | null;
  fact: string | null;
  factSource: string | null;
};

const EXCEPTION_KINDS = new Set<CompareKind>([
  "no_show",
  "unscheduled",
  "worked_on_leave",
]);

export default function WorkforcePlanFactPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforcePlanFact");
  const tRoster = useTranslations("workforceRoster");
  const tSheet = useTranslations("workforceTimesheets");
  const tCommon = useTranslations("common");
  const anchor = bakuYmd();
  const [year, setYear] = useState(anchor.y);
  const [month, setMonth] = useState(anchor.m);
  const [showMatches, setShowMatches] = useState(false);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [persons, setPersons] = useState<
    Record<string, { displayName?: string | null; accessDenied?: boolean }>
  >({});
  const [windowLabel, setWindowLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch(
      `roster/compare?year=${year}&month=${month}`,
    );
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!res.ok) {
      setError(String(res.status));
      setRows([]);
      setLoading(false);
      return;
    }
    const body = (await res.json()) as {
      from?: string;
      to?: string;
      rows?: CompareRow[];
      persons?: Record<string, { displayName?: string | null; accessDenied?: boolean }>;
    };
    setRows(body.rows ?? []);
    setPersons(body.persons ?? {});
    setWindowLabel(
      body.from && body.to
        ? `${bakuDateDisplay(body.from)} — ${bakuDateDisplay(body.to)}`
        : "",
    );
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const visible = useMemo(
    () =>
      rows.filter((row) => showMatches || EXCEPTION_KINDS.has(row.kind)),
    [rows, showMatches],
  );

  const yearOptions = [anchor.y - 1, anchor.y, anchor.y + 1].map((y) => ({
    value: String(y),
    label: String(y),
  }));
  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  function personLabel(row: CompareRow): string {
    const person = row.globalPersonId ? persons[row.globalPersonId] : undefined;
    const name = person?.displayName?.trim();
    if (name) return name;
    if (person?.accessDenied) return tCommon("unnamedPerson");
    return tCommon("unnamedPerson");
  }

  function planLabel(row: CompareRow): string {
    if (row.plan === "WORK") {
      return row.planPlaceCode
        ? `${t("planWork")} ${row.planPlaceCode}`
        : t("planWork");
    }
    if (row.plan === "OFF") return t("planOff");
    return t("planNone");
  }

  function factLetter(fact: string): string {
    if (fact === "WORK") return tSheet("codeWork");
    if (fact === "VACATION") return tSheet("codeVacation");
    if (fact === "SICK") return tSheet("codeSick");
    if (fact === "OFF") return tSheet("codeOff");
    if (fact === "BUSINESS_TRIP") return tSheet("codeTrip");
    return fact;
  }

  function factLabel(row: CompareRow): string {
    if (!row.fact) return t("factNone");
    const letter = factLetter(row.fact);
    if (row.factSource === "faceid") return `${letter} · ${tSheet("sourceFaceid")}`;
    if (row.factSource === "absence_sync") return `${letter} · ${t("factAbsence")}`;
    if (row.factSource === "ops_grid") return letter;
    return row.factSource ? `${letter} · ${row.factSource}` : letter;
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <EraListFilterBar
        resetLabel={tCommon("filterReset")}
        onReset={() => {
          const n = bakuYmd();
          setYear(n.y);
          setMonth(n.m);
          setShowMatches(false);
        }}
      >
        <CatalogField
          kind="CLOSED_SMALL"
          label={tRoster("year")}
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={yearOptions}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={tRoster("month")}
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          options={monthOptions}
        />
        <label className="flex items-end gap-2 pb-2 text-sm text-[#34495E]">
          <input
            type="checkbox"
            checked={showMatches}
            onChange={(e) => setShowMatches(e.target.checked)}
          />
          {t("showMatches")}
        </label>
      </EraListFilterBar>
      {windowLabel ? (
        <p className="text-xs text-[#7F8C8D]">{windowLabel}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <table className={DATA_TABLE_CLASS}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDate")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colKind")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPlan")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFact")}</th>
          </tr>
        </thead>
        <tbody>
          {loading || visible.length === 0 ? (
            <tr className={DATA_TABLE_TR_CLASS}>
              <td className={DATA_TABLE_TD_CLASS} colSpan={5}>
                {loading
                  ? tCommon("loading")
                  : showMatches
                    ? t("emptyMatches")
                    : t("empty")}
              </td>
            </tr>
          ) : (
            visible.map((row) => (
              <tr
                key={`${row.employmentId}-${row.date}`}
                className={DATA_TABLE_TR_CLASS}
              >
                <td className={DATA_TABLE_TD_CLASS}>{personLabel(row)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{bakuDateDisplay(row.date)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{t(`kind.${row.kind}`)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{planLabel(row)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{factLabel(row)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
