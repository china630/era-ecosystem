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
import { ListPaginationFooter } from "../../components/list-pagination-footer";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../lib/design-system";

type ContractRow = {
  id: string;
  number: string;
  type: string;
  status: string;
  currency: string;
  amountLimit?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  counterparty?: { id: string; nameCipher?: string | null };
  _count?: { commitments: number; lines: number };
};

type LimitCheck = {
  allowed: boolean;
  reason: string | null;
  limit: string | null;
  committed: string;
  remaining: string | null;
  requested: string;
  status?: string;
  dateTo?: string | null;
};

function hasContractsModule(activeModules: string[], tier: string): boolean {
  if (tier === "TIER_3") return true;
  return activeModules.includes("contract_management_pro");
}

export default function ContractsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { ready: subReady, effectiveSnapshot: snapshot } = useSubscription();
  const tier = snapshot?.tier ? String(snapshot.tier).toUpperCase() : "";
  const moduleLocked =
    subReady &&
    snapshot &&
    !hasContractsModule(snapshot.activeModules ?? [], tier);

  const [rows, setRows] = useState<ContractRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [checkAmount, setCheckAmount] = useState("0");
  const [limitResult, setLimitResult] = useState<LimitCheck | null>(null);
  const [checkErr, setCheckErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || moduleLocked) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    const res = await apiFetch(`/api/contracts?${qs.toString()}`);
    if (!res.ok) {
      setErr(`${t("contracts.loadErr")} (${res.status})`);
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    const parsed = parsePaginatedList<ContractRow>(await res.json());
    setRows(parsed.items);
    setTotal(parsed.total);
    setLoading(false);
  }, [token, moduleLocked, page, pageSize, t]);

  useEffect(() => {
    if (!ready || !token || moduleLocked) return;
    void load();
  }, [load, ready, token, moduleLocked]);

  async function runLimitCheck() {
    if (!selectedId) return;
    setCheckErr(null);
    setLimitResult(null);
    const amount = Number(checkAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setCheckErr(t("contracts.checkAmountInvalid"));
      return;
    }
    const res = await apiFetch("/api/contracts/check-limit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: selectedId, amount }),
    });
    if (!res.ok) {
      setCheckErr(`${t("contracts.checkErr")} (${res.status})`);
      return;
    }
    setLimitResult((await res.json()) as LimitCheck);
  }

  if (!ready) return null;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("contracts.title")}
        subtitle={t("contracts.subtitle")}
        actions={
          <Link href="/settings/subscription" className={SECONDARY_BUTTON_CLASS}>
            {t("nav.settingsSubscription")}
          </Link>
        }
      />

      {moduleLocked ? (
        <EmptyState
          title={t("contracts.moduleLockedTitle")}
          description={t("contracts.moduleLockedDesc")}
          action={
            <Link href="/settings/subscription" className={PRIMARY_BUTTON_CLASS}>
              {t("contracts.manageSubscription")}
            </Link>
          }
        />
      ) : (
        <>
          {err ? <p className="text-sm text-red-600">{err}</p> : null}
          {loading ? <p className="text-gray-600">{t("contracts.loading")}</p> : null}

          {!loading && (
            <>
              <div className="flex flex-wrap items-end gap-3 rounded border border-[#D5DADF] bg-white p-4">
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t("contracts.checkContract")}</span>
                  <select
                    className={MODAL_INPUT_CLASS}
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                  >
                    <option value="">{t("contracts.selectContract")}</option>
                    {rows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.number} ({r.status})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t("contracts.checkAmount")}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={MODAL_INPUT_CLASS}
                    value={checkAmount}
                    onChange={(e) => setCheckAmount(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={PRIMARY_BUTTON_CLASS}
                  disabled={!selectedId}
                  onClick={() => void runLimitCheck()}
                >
                  {t("contracts.checkLimitBtn")}
                </button>
              </div>
              {checkErr ? <p className="text-sm text-red-600">{checkErr}</p> : null}
              {limitResult ? (
                <div className="rounded border border-[#D5DADF] bg-[#F8FAFC] p-3 text-sm">
                  <p>
                    {t("contracts.checkResult")}:{" "}
                    <strong>
                      {limitResult.allowed
                        ? t("contracts.allowed")
                        : t("contracts.blocked")}
                    </strong>
                    {limitResult.reason ? ` (${limitResult.reason})` : ""}
                  </p>
                  <p>
                    {t("contracts.committed")}: {limitResult.committed}
                    {limitResult.limit != null
                      ? ` / ${t("contracts.limit")}: ${limitResult.limit}`
                      : ""}
                    {limitResult.remaining != null
                      ? ` / ${t("contracts.remaining")}: ${limitResult.remaining}`
                      : ""}
                  </p>
                </div>
              ) : null}

              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={`${DATA_TABLE_CLASS} min-w-full`}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contracts.thNumber")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contracts.thType")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contracts.thStatus")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contracts.thCounterparty")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("contracts.thLimit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr className={DATA_TABLE_TR_CLASS}>
                        <td colSpan={5} className={`${DATA_TABLE_TD_CLASS} py-10 text-center`}>
                          <EmptyState compact title={t("contracts.empty")} />
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr
                          key={row.id}
                          className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                          onClick={() => setSelectedId(row.id)}
                        >
                          <td className={DATA_TABLE_TD_CLASS}>{row.number}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row.type}</td>
                          <td className={DATA_TABLE_TD_CLASS}>{row.status}</td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.counterparty?.nameCipher?.trim() || row.counterparty?.id || "—"}
                          </td>
                          <td className={DATA_TABLE_TD_CLASS}>
                            {row.amountLimit != null
                              ? `${row.amountLimit} ${row.currency}`
                              : "—"}
                          </td>
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
