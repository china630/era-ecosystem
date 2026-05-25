"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../lib/api-client";
import { parsePaginatedList } from "../../lib/paginated-list";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useSubscription } from "../../lib/subscription-context";
import { PageHeader } from "../../components/layout/page-header";
import { EmptyState } from "../../components/empty-state";
import { ListPaginationFooter } from "../../components/list-pagination-footer";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";

type BudgetYearRow = {
  id: string;
  year: number;
  version: number;
  status: string;
  _count?: { lines: number };
};

function hasGovBudgetModule(activeModules: string[], tier: string): boolean {
  if (tier === "TIER_3") return true;
  return activeModules.includes("gov_budget_pro");
}

export default function GovBudgetPage() {
  const { token, ready } = useRequireAuth();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const moduleLocked =
    subReady &&
    snapshot &&
    !hasGovBudgetModule(snapshot.activeModules ?? [], tier);

  const [rows, setRows] = useState<BudgetYearRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || moduleLocked) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const res = await apiFetch(`/api/gov-budget/years?${qs.toString()}`);
    if (!res.ok) {
      setErr(`Failed to load budget years (${res.status})`);
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const parsed = parsePaginatedList<BudgetYearRow>(await res.json());
    setRows(parsed.items);
    setTotal(parsed.total);
    setLoading(false);
  }, [token, moduleLocked, page, pageSize]);

  useEffect(() => {
    if (!ready || !token || moduleLocked) return;
    void load();
  }, [load, ready, token, moduleLocked]);

  if (!ready) return null;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gov budget"
        subtitle="Annual budget plan and execution (B2G)"
        actions={
          <Link href="/settings/subscription" className={SECONDARY_BUTTON_CLASS}>
            Subscription
          </Link>
        }
      />

      {moduleLocked ? (
        <EmptyState
          title="Gov Budget is not enabled"
          description="Enable the gov_budget_pro module for budget-year planning and limit checks."
          action={
            <Link href="/settings/subscription" className={PRIMARY_BUTTON_CLASS}>
              Manage subscription
            </Link>
          }
        />
      ) : (
        <>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          {loading ? <p className="text-gray-600">Loading…</p> : null}

          {!loading && (
            <>
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={`${DATA_TABLE_CLASS} min-w-full`}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>Year</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>Version</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>Status</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>Lines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr className={DATA_TABLE_TR_CLASS}>
                        <td colSpan={4} className={`${DATA_TABLE_TD_CLASS} py-10 text-center`}>
                          <EmptyState compact title="No budget years yet" />
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                          <td className={DATA_TABLE_TD_CLASS}>{row.year}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row.version}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row.status}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row._count?.lines ?? 0}</td>
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
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
