"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api-client";
import { parsePaginatedList } from "../../lib/paginated-list";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useSubscription } from "../../lib/subscription-context";
import { PageHeader } from "../../components/layout/page-header";
import { EmptyState } from "../../components/empty-state";
import { FinanceEmptyTableRow } from "../../components/finance-empty-table-row";
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
  mode?: string;
  _count?: { lines: number };
};

function hasBudgetModule(activeModules: string[], tier: string): boolean {
  if (tier === "TIER_3") return true;
  return (
    activeModules.includes("gov_budget_pro") ||
    activeModules.includes("mgmt_budget_pro")
  );
}

export default function GovBudgetPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const moduleLocked =
    subReady &&
    snapshot &&
    !hasBudgetModule(snapshot.activeModules ?? [], tier);
  const commercialOnly =
    !moduleLocked &&
    (snapshot?.activeModules ?? []).includes("mgmt_budget_pro") &&
    !(snapshot?.activeModules ?? []).includes("gov_budget_pro") &&
    tier !== "TIER_3";

  const [rows, setRows] = useState<BudgetYearRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const orchBase = (
    process.env.NEXT_PUBLIC_ORCH_WEB_URL ?? "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
  const subscriptionHref = `${orchBase}/settings/subscription`;

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
      setErr(t("govBudget.loadErr", { status: res.status }));
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const parsed = parsePaginatedList<BudgetYearRow>(await res.json());
    setRows(parsed.items);
    setTotal(parsed.total);
    setLoading(false);
  }, [token, moduleLocked, page, pageSize, t]);

  useEffect(() => {
    if (!ready || !token || moduleLocked) return;
    void load();
  }, [load, ready, token, moduleLocked]);

  if (!ready) return null;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={commercialOnly ? t("govBudget.titleMgmt") : t("govBudget.titleGov")}
        subtitle={
          commercialOnly ? t("govBudget.subtitleMgmt") : t("govBudget.subtitleGov")
        }
        actions={
          <Link href={subscriptionHref} className={SECONDARY_BUTTON_CLASS}>
            {t("govBudget.subscription")}
          </Link>
        }
      />

      {moduleLocked ? (
        <EmptyState
          title={t("govBudget.lockedTitle")}
          description={t("govBudget.lockedDesc")}
          action={
            <Link href={subscriptionHref} className={PRIMARY_BUTTON_CLASS}>
              {t("govBudget.manageSubscription")}
            </Link>
          }
        />
      ) : (
        <>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          {loading ? <p className="text-gray-600">{t("govBudget.loading")}</p> : null}

          {!loading && (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={creating}
                  onClick={() => {
                    void (async () => {
                      setCreating(true);
                      setErr(null);
                      const year = new Date().getFullYear();
                      const res = await apiFetch("/api/gov-budget/years", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          year,
                          mode: commercialOnly ? "MANAGEMENT" : "GOV",
                          lines: commercialOnly
                            ? [
                                {
                                  accountCode: "OPEX",
                                  limitAnnual: 100000,
                                },
                              ]
                            : undefined,
                        }),
                      });
                      setCreating(false);
                      if (!res.ok) {
                        setErr(t("govBudget.createErr", { status: res.status }));
                        return;
                      }
                      await load();
                    })();
                  }}
                >
                  {creating
                    ? "…"
                    : commercialOnly
                      ? t("govBudget.newYearMgmt")
                      : t("govBudget.newYearGov")}
                </button>
              </div>
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={`${DATA_TABLE_CLASS} min-w-full`}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("govBudget.thYear")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("govBudget.thMode")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("govBudget.thVersion")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("govBudget.thStatus")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("govBudget.thLines")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <FinanceEmptyTableRow colSpan={5} message={t("common.noRows")} />
                    ) : (
                      rows.map((row) => (
                        <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                          <td className={DATA_TABLE_TD_CLASS}>{row.year}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row.mode ?? "GOV"}</td>
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
