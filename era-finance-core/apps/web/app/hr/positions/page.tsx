"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { parsePaginatedList } from "../../../lib/paginated-list";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
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
} from "../../../lib/design-system";

type JobPositionRow = {
  id: string;
  name: string;
  totalSlots: number;
  minSalary: unknown;
  maxSalary: unknown;
  department: { id: string; name: string };
  _count: { employees: number };
};

export default function HrPositionsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [positions, setPositions] = useState<JobPositionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const workspacePositionsUrl = `${(process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "")}/workspace/workforce/positions`;

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const jp = await apiFetch(`/api/hr/job-positions?${qs.toString()}`);
    if (!jp.ok) {
      setError(`${t("hrStructure.loadErr")}: ${jp.status}`);
      setPositions([]);
      setTotal(0);
    } else {
      const parsed = parsePaginatedList<JobPositionRow>(await jp.json());
      setPositions(parsed.items);
      setTotal(parsed.total);
    }
    setLoading(false);
  }, [token, t, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="w-full max-w-none space-y-8">
      <PageHeader title={t("hrPositions.title")} subtitle={t("hrPositions.subtitle")} />

      <div className={`${CARD_CONTAINER_CLASS} border-l-4 border-l-[#2980B9] p-4`}>
        <p className="text-[13px] font-semibold text-[#34495E]">
          {t("hrStructure.orgCpBannerTitle")}
        </p>
        <p className="mt-1 text-xs text-[#7F8C8D]">{t("hrStructure.positionsCpBannerHint")}</p>
        <a
          href={workspacePositionsUrl}
          className="mt-2 inline-block text-[13px] font-medium text-[#2980B9] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("hrStructure.managePositionsInWorkspace")} →
        </a>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {loading && <p className="text-gray-600 text-sm">{t("common.loading")}</p>}
      {!loading && (
        <>
          <p className="text-xs text-[#7F8C8D]">{t("hrStructure.mirrorReadOnlyHint")}</p>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("hrStructure.positionName")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("hrStructure.department")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("hrStructure.slots")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("hrPositions.salaryFork")}</th>
                  <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                    {t("hrStructure.positionsEmployees")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {positions.length === 0 ? (
                  <tr className={DATA_TABLE_TR_CLASS}>
                    <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} py-12 text-center`}>
                      <EmptyState
                        title={t("hrStructure.positionsEmpty")}
                        description={t("hrStructure.positionsEmptyMirrorHint")}
                      />
                    </td>
                  </tr>
                ) : (
                  positions.map((p) => (
                    <tr key={p.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>
                        {p.name}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{p.department.name}</td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{p.totalSlots}</td>
                      <td className={`${DATA_TABLE_TD_RIGHT_CLASS} text-xs`}>
                        {formatMoneyAzn(p.minSalary)} — {formatMoneyAzn(p.maxSalary)}
                      </td>
                      <td className={DATA_TABLE_TD_RIGHT_CLASS}>{p._count.employees}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            className="mt-4"
          />
        </>
      )}
    </div>
  );
}
