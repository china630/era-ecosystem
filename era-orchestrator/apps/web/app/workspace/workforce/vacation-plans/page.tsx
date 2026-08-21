"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  MODAL_INPUT_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../../lib/use-require-auth";
import {
  isWorkforceGate403,
  workforceFetch,
} from "../../../../lib/workforce-fetch";
import { WorkforceGate } from "../../../../components/workspace/workforce-gate";

type PlanRow = {
  id: string;
  year: number;
  status: string;
  orgUnitId?: string | null;
};

export default function VacationPlansPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceVacation");
  const [rows, setRows] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [gated, setGated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [employmentId, setEmploymentId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [days, setDays] = useState("14");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await workforceFetch(`vacation-plans?year=${year}`);
    if (await isWorkforceGate403(res)) {
      setGated(true);
      setLoading(false);
      return;
    }
    setGated(false);
    if (!res.ok) {
      setError(t("loadFailed"));
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as PlanRow[] | { items?: PlanRow[] };
    setRows(Array.isArray(data) ? data : (data.items ?? []));
    setLoading(false);
  }, [year, t]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function createPlan() {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch("vacation-plans", {
        method: "POST",
        body: JSON.stringify({
          year,
          lines: [
            {
              employmentId: employmentId.trim(),
              startDate,
              endDate,
              days: Number(days) || 1,
            },
          ],
        }),
      });
      if (!res.ok) {
        setError(t("createFailed"));
        return;
      }
      setEmploymentId("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "submit" | "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await workforceFetch(`vacation-plans/${id}/${action}`, {
        method: "POST",
        body: action === "reject" ? JSON.stringify({ rejectionReason: "rejected" }) : undefined,
      });
      if (!res.ok) {
        setError(t("actionFailed"));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (gated) return <WorkforceGate onEnabled={() => void load()} />;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
        <h2 className="text-sm font-semibold">{t("createTitle")}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className={MODAL_INPUT_CLASS}
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <input
            className={MODAL_INPUT_CLASS}
            placeholder={t("employmentId")}
            value={employmentId}
            onChange={(e) => setEmploymentId(e.target.value)}
          />
          <input
            className={MODAL_INPUT_CLASS}
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            className={MODAL_INPUT_CLASS}
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <input
            className={`${MODAL_INPUT_CLASS} w-20`}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={busy || !employmentId || !startDate || !endDate}
            onClick={() => void createPlan()}
          >
            {t("create")}
          </button>
        </div>
      </div>
      <div className={CARD_CONTAINER_CLASS}>
        {loading ? (
          <p className="p-4 text-sm text-[#7F8C8D]">{t("loading")}</p>
        ) : (
          <ul className="divide-y divide-[#EBEDF0]">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span>
                  {r.year} · {r.status} · <code className="text-xs">{r.id.slice(0, 8)}</code>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, "submit")}
                  >
                    {t("submit")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, "approve")}
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={busy}
                    onClick={() => void act(r.id, "reject")}
                  >
                    {t("reject")}
                  </button>
                </div>
              </li>
            ))}
            {rows.length === 0 ? (
              <li className="p-4 text-sm text-[#7F8C8D]">{t("empty")}</li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
