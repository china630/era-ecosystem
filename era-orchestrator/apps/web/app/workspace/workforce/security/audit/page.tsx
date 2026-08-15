"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken } from "../../../../../lib/orch-api";
import { useRequireAuth } from "../../../../../lib/use-require-auth";
import { useListPagination } from "../../../../../lib/use-list-pagination";

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  globalPersonId?: string | null;
  cpEmploymentId?: string | null;
  createdAt: string;
};

async function wfFetch(path: string) {
  const token = getOrchAccessToken();
  const res = await fetch(`/api/platform/workforce/${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export default function WorkforceSecurityAuditPage() {
  const { ready } = useRequireAuth();
  const t = useTranslations("workforceAudit");
  const tCommon = useTranslations("common");
  const [action, setAction] = useState("");
  const [globalPersonId, setGlobalPersonId] = useState("");
  const [items, setItems] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const { page, pageSize, setPage, setPageSize, paged, total } =
    useListPagination(items);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ pageSize: "50" });
      if (action.trim()) qs.set("action", action.trim());
      if (globalPersonId.trim()) qs.set("globalPersonId", globalPersonId.trim());
      const data = await wfFetch(`security/audit?${qs.toString()}`);
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, [action, globalPersonId]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  if (!ready) return null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <p className="mb-4 text-sm">
        <Link href="/workspace/workforce/security" className="text-[#2980B9] hover:underline">
          ← {t("back")}
        </Link>
      </p>
      <div className={`${CARD_CONTAINER_CLASS} mb-4 grid gap-3 p-4 sm:grid-cols-3`}>
        <label className="text-xs">
          {t("filterAction")}
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="HIRE"
          />
        </label>
        <label className="text-xs">
          {t("filterPerson")}
          <input
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            value={globalPersonId}
            onChange={(e) => setGlobalPersonId(e.target.value)}
          />
        </label>
        <div className="flex items-end">
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
            {loading ? t("loading") : t("apply")}
          </button>
        </div>
      </div>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTime")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAction")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colEntity")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPerson")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{row.action}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {row.entityType} / {row.entityId.slice(0, 8)}…
                </td>
                <td className={`${DATA_TABLE_TD_CLASS} font-mono text-[11px]`}>
                  {row.globalPersonId?.slice(0, 8) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total === 0 && !loading ? (
          <p className="px-4 py-4 text-sm text-[#7F8C8D]">{t("empty")}</p>
        ) : null}
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          labels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      </div>
    </>
  );
}
