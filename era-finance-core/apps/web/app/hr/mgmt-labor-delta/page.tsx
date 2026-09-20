"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useOrgPermissions } from "../../../lib/use-org-permissions";
import { CP_PERMISSION } from "../../../lib/role-utils";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { formatMoneyAzn } from "../../../lib/format-money";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
} from "../../../lib/design-system";
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../../lib/form-styles";

type DeltaRow = {
  id: string;
  employeeId: string;
  workHours: string | number;
  monthNormHours: string | number;
  mgmtGross: string | number;
  statGross: string | number;
  delta: string | number;
};

type EmpLite = {
  id: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  displayName?: string | null;
  finCode?: string;
};

function money(v: unknown): string {
  return formatMoneyAzn(v);
}

export default function MgmtLaborDeltaPage() {
  const { t } = useTranslation();
  const { ready, token } = useRequireAuth();
  const { user } = useAuth();
  const perms = useOrgPermissions();
  const allowed = perms.can(CP_PERMISSION.API_BOOK_MGMT);

  const now = useMemo(() => new Date(), []);
  const [yearMonth, setYearMonth] = useState(
    () =>
      `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
  );
  const [rows, setRows] = useState<DeltaRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  const { year, month } = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return { year: y, month: m };
  }, [yearMonth]);

  const loadNames = useCallback(async () => {
    const res = await apiFetch("/api/hr/employees?page=1&pageSize=500");
    if (!res.ok) return;
    const j = (await res.json()) as { items?: EmpLite[] };
    const map: Record<string, string> = {};
    for (const e of j.items ?? []) {
      const parts = [e.lastName, e.firstName, e.middleName]
        .map((p) => p?.trim())
        .filter((p) => p && p !== "—");
      map[e.id] =
        parts.join(" ").trim() || e.displayName?.trim() || e.finCode || e.id.slice(0, 8);
    }
    setNames(map);
  }, []);

  const load = useCallback(async () => {
    if (!token || !year || !month) return;
    setLoading(true);
    setError(null);
    const res = await apiFetch(
      `/api/hr/mgmt-labor-delta?year=${year}&month=${month}`,
    );
    if (!res.ok) {
      setError(await res.text());
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as DeltaRow[];
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [token, year, month]);

  useEffect(() => {
    if (!ready || !token || !allowed) return;
    void loadNames();
    void load();
  }, [ready, token, allowed, load, loadNames]);

  async function rebuild() {
    setBusy(true);
    setRebuildMsg(null);
    setError(null);
    const res = await apiFetch(
      `/api/hr/mgmt-labor-delta/rebuild?year=${year}&month=${month}`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      let msg = await res.text();
      try {
        const j = JSON.parse(msg) as { code?: string; message?: string };
        if (j.code === "TIMESHEET_NOT_APPROVED") {
          msg = t("hrMgmtDelta.errTimesheetNotApproved");
        } else if (j.message) {
          msg = j.message;
        }
      } catch {
        /* keep raw */
      }
      setError(msg);
      return;
    }
    const j = (await res.json()) as {
      posted?: number;
      skipped?: number;
      totalDelta?: string;
    };
    setRebuildMsg(
      t("hrMgmtDelta.rebuildOk", {
        posted: j.posted ?? 0,
        skipped: j.skipped ?? 0,
        total: j.totalDelta ?? "0",
      }),
    );
    await load();
  }

  if (!ready) {
    return <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>;
  }
  if (!token) return null;
  if (!allowed) {
    return (
      <p className="text-sm text-red-600">{t("hrMgmtDelta.forbidden")}</p>
    );
  }

  const sumDelta = rows.reduce((acc, r) => acc + Number(r.delta ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("hrMgmtDelta.title")}
        subtitle={t("hrMgmtDelta.subtitle")}
        actions={
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy}
            onClick={() => void rebuild()}
          >
            {busy ? "…" : t("hrMgmtDelta.rebuild")}
          </button>
        }
      />

      <p className={`${CARD_CONTAINER_CLASS} p-3 text-sm text-[#34495E]`}>
        {t("hrMgmtDelta.hint")}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[12px] text-[#34495E]">
          <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
            {t("hrMgmtDelta.period")}
          </span>
          <input
            className={`${MODAL_INPUT_CLASS} h-8 ${TOOLBAR_MONTH_INPUT_CLASS}`}
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={loading}
          onClick={() => void load()}
        >
          {t("hrMgmtDelta.refresh")}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rebuildMsg ? <p className="text-sm text-green-700">{rebuildMsg}</p> : null}

      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
      ) : (
        <div className={`${DATA_TABLE_VIEWPORT_CLASS} ${CARD_CONTAINER_CLASS}`}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("hrMgmtDelta.colEmployee")}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("hrMgmtDelta.colHours")}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("hrMgmtDelta.colNorm")}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("hrMgmtDelta.colContract")}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("hrMgmtDelta.colMgmt")}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("hrMgmtDelta.colDelta")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {names[r.employeeId] ?? r.employeeId.slice(0, 8)}
                  </td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                    {String(r.workHours)}
                  </td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                    {String(r.monthNormHours)}
                  </td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                    {money(r.statGross)}
                  </td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                    {money(r.mgmtGross)}
                  </td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{money(r.delta)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {t("hrMgmtDelta.empty")}
                  </td>
                </tr>
              ) : (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-semibold`} colSpan={5}>
                    {t("hrMgmtDelta.total")}
                  </td>
                  <td className={`${DATA_TABLE_TD_RIGHT_CLASS} font-semibold`}>
                    {money(sumDelta)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
