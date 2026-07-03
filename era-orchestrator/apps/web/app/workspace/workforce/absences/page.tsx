"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../../lib/orch-api";
import { useRequireAuth } from "../../../../lib/use-require-auth";

type AbsenceRow = {
  id: string;
  kind: string;
  status: string;
  startDate: string;
  endDate: string;
  note: string;
  employmentId: string;
  employment: { globalPersonId: string };
};

type ListResponse = {
  items: AbsenceRow[];
  persons: Record<
    string,
    { globalPersonId: string; displayName: string | null; accessDenied: boolean }
  >;
};

async function workforceFetch(path: string, init: RequestInit = {}) {
  const token = getOrchAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api/platform/workforce/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
  });
}

function personLabel(
  persons: ListResponse["persons"],
  globalPersonId: string,
  masked: string,
): string {
  const p = persons[globalPersonId];
  if (!p) return globalPersonId.slice(0, 8);
  if (p.displayName) return p.displayName;
  return p.accessDenied ? masked : globalPersonId.slice(0, 8);
}

export default function WorkforceAbsencesPage() {
  const { ready, user } = useRequireAuth();
  const t = useTranslations("workforceAbsences");
  const [rows, setRows] = useState<AbsenceRow[]>([]);
  const [persons, setPersons] = useState<ListResponse["persons"]>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const bounds = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      dateFrom: `${month}-01`,
      dateTo: `${month}-${String(last).padStart(2, "0")}`,
    };
  }, [month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams(bounds);
    const res = await workforceFetch(`absences?${qs.toString()}`);
    if (!res.ok) {
      setError(`${res.status}`);
      setRows([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as ListResponse;
    setRows(data.items ?? []);
    setPersons(data.persons ?? {});
    setLoading(false);
  }, [bounds]);

  useEffect(() => {
    if (!ready || !user?.organizationId) return;
    void load();
  }, [ready, user?.organizationId, load]);

  if (!ready) return null;
  if (!user?.organizationId) {
    return <p className="text-sm text-[#7F8C8D]">{t("selectOrg")}</p>;
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/workspace/workforce/employments" className={SECONDARY_BUTTON_CLASS}>
              {t("goEmployments")}
            </Link>
            <Link href="/workspace/workforce/absences/new" className={PRIMARY_BUTTON_CLASS}>
              {t("newAbsence")}
            </Link>
          </div>
        }
      />

      <div className={`${CARD_CONTAINER_CLASS} mb-4 flex flex-wrap items-end gap-3 p-4`}>
        <label className="text-[13px] font-medium text-[#34495E]">
          {t("monthFilter")}
          <input
            type="month"
            className="mt-1 block rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <div className={`${CARD_CONTAINER_CLASS} p-4 text-sm text-[#7F8C8D]`}>{t("empty")}</div>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto`}>
          <table className="min-w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#D5DADF]">
                <th className="p-2 text-left font-semibold">{t("colPerson")}</th>
                <th className="p-2 text-left font-semibold">{t("colKind")}</th>
                <th className="p-2 text-left font-semibold">{t("colPeriod")}</th>
                <th className="p-2 text-left font-semibold">{t("colStatus")}</th>
                <th className="p-2 text-right font-semibold">{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[#EBEDF0]">
                  <td className="p-2">
                    {personLabel(persons, r.employment.globalPersonId, t("maskedPerson"))}
                  </td>
                  <td className="p-2">{t(`kind.${r.kind}` as "kind.VACATION")}</td>
                  <td className="p-2 tabular-nums whitespace-nowrap">
                    {String(r.startDate).slice(0, 10)} — {String(r.endDate).slice(0, 10)}
                  </td>
                  <td className="p-2">{t(`status.${r.status}` as "status.DRAFT")}</td>
                  <td className="p-2 text-right">
                    <Link
                      href={`/workspace/workforce/absences/${r.id}`}
                      className="text-[#2980B9] hover:underline"
                    >
                      {t("open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
