"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  LIST_PAGE_SHELL_CLASS,
  PageHeader,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { addBakuDays, bakuDateDisplay, todayBakuYmd } from "@era/satellite-kit/time";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  parseWorkforceApiError,
  workforceFetch as wfFetch,
} from "../../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../../components/workspace/workforce-gate";
import { WorkforceShiftsSubnav } from "../../../../../components/workspace/workforce-shifts-subnav";
import { WorkforceConfirmDialog } from "../../../../../components/workspace/workforce-confirm-dialog";

type AssignmentRow = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  place?: { code: string; name: string } | null;
  cycle?: { code: string; name: string } | null;
  brigade?: { code: string; name: string } | null;
  employment?: { globalPersonId?: string; orgUnit?: { name: string } | null } | null;
};

type PersonBrief = { displayName?: string | null; accessDenied?: boolean };

export default function WorkforceShiftAssignmentsPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceRoster");
  const tCommon = useTranslations("common");
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [persons, setPersons] = useState<Record<string, PersonBrief>>({});
  const [loading, setLoading] = useState(true);
  const [notEntitled, setNotEntitled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState<AssignmentRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await wfFetch("shift-assignments");
    if (await isWorkforceGate403(res)) {
      setNotEntitled(true);
      setLoading(false);
      return;
    }
    setNotEntitled(false);
    if (!res.ok) {
      setError(t("loadError"));
      setRows([]);
      setLoading(false);
      return;
    }
    const body = (await res.json()) as {
      items?: AssignmentRow[];
      persons?: Record<string, PersonBrief>;
    } | AssignmentRow[];
    setRows(Array.isArray(body) ? body : (body.items ?? []));
    setPersons(Array.isArray(body) ? {} : (body.persons ?? {}));
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function closeAssignment(row: AssignmentRow) {
    setBusy(true);
    const from = String(row.effectiveFrom).slice(0, 10);
    const today = todayBakuYmd();
    const to = today <= from ? from : addBakuDays(today, -1);
    const res = await wfFetch(`shift-assignments/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ effectiveTo: to }),
    });
    setBusy(false);
    setEnding(null);
    if (!res.ok) {
      const err = await parseWorkforceApiError(res);
      setError(err.message || t("saveError"));
      return;
    }
    await load();
  }

  if (!ready) return null;
  if (notEntitled) return <WorkforceGate />;

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <WorkforceShiftsSubnav />
      <PageHeader title={t("assignmentsHeading")} subtitle={t("assignmentsHint")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <table className={DATA_TABLE_CLASS}>
        <thead>
          <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTarget")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPlace")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCycle")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colFrom")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colUntil")}</th>
            <th className={DATA_TABLE_TH_LEFT_CLASS} />
          </tr>
        </thead>
        <tbody>
          {loading || rows.length === 0 ? (
            <tr className={DATA_TABLE_TR_CLASS}>
              <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                {loading ? tCommon("loading") : t("assignmentsEmpty")}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const from = String(row.effectiveFrom).slice(0, 10);
              const to = row.effectiveTo
                ? String(row.effectiveTo).slice(0, 10)
                : "";
              const open = !to || to > todayBakuYmd();
              const personId = row.employment?.globalPersonId;
              const person = personId ? persons[personId] : undefined;
              const personName =
                person?.displayName?.trim() ||
                (person?.accessDenied ? t("maskedPerson") : tCommon("unnamedPerson"));
              const target = row.brigade
                ? `${row.brigade.code} — ${row.brigade.name}`
                : personName;
              return (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{target}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.place ? `${row.place.code} — ${row.place.name}` : "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.cycle ? `${row.cycle.code} — ${row.cycle.name}` : "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{bakuDateDisplay(from)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {to ? bakuDateDisplay(to) : "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {open ? (
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        title={t("endAssignment")}
                        onClick={() => setEnding(row)}
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <WorkforceConfirmDialog
        open={ending !== null}
        title={t("endAssignment")}
        body={t("endAssignmentConfirm")}
        confirmLabel={t("endAssignment")}
        cancelLabel={tCommon("cancel")}
        busy={busy}
        onCancel={() => setEnding(null)}
        onConfirm={() => {
          if (ending) void closeAssignment(ending);
        }}
      />
    </div>
  );
}
