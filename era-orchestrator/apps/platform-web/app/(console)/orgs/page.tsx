"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  EraListFilterBar,
  ListPaginationFooter,
  MODAL_INPUT_CLASS,
  PageHeader,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "@/lib/cp-admin-fetch";

type OrgRow = {
  id: string;
  name: string;
  publicOrgNumber: number;
  operatingMode: string;
  deploymentTopology: string;
  billingStatus: string;
  parentOrgId: string | null;
  createdAt: string;
  isTrial: boolean | null;
  isBlocked: boolean | null;
  currentTier: string | null;
  trialExpiresAt: string | null;
  expiresAt: string | null;
};

const MODE_OPTIONS = [
  { value: "", label: "—" },
  { value: "STANDALONE", label: "STANDALONE" },
  { value: "DEPARTMENT", label: "DEPARTMENT" },
];

const TOPO_OPTIONS = [
  { value: "", label: "—" },
  { value: "SHARED", label: "SHARED" },
  { value: "DEDICATED", label: "DEDICATED" },
  { value: "ONPREM", label: "ONPREM" },
];

const BILLING_OPTIONS = [
  { value: "", label: "—" },
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "SOFT_BLOCK", label: "SOFT_BLOCK" },
  { value: "HARD_BLOCK", label: "HARD_BLOCK" },
];

function billingChipClass(status: string): string {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-800";
  if (status === "SOFT_BLOCK") return "bg-amber-50 text-amber-800";
  return "bg-red-50 text-red-800";
}

export default function SuperAdminOrgsPage() {
  const t = useTranslations("superAdmin.orgs");
  const tCommon = useTranslations("common");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const [operatingMode, setOperatingMode] = useState("");
  const [deploymentTopology, setDeploymentTopology] = useState("");
  const [billingStatus, setBillingStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
    if (operatingMode) params.set("operatingMode", operatingMode);
    if (deploymentTopology) params.set("deploymentTopology", deploymentTopology);
    if (billingStatus) params.set("billingStatus", billingStatus);
    const res = await cpAdminFetch(`organizations?${params.toString()}`);
    if (!res.ok) {
      setError(t("loadFailed"));
      setItems([]);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { total: number; items: OrgRow[] };
    setTotal(data.total);
    setItems(data.items ?? []);
    setLoading(false);
  }, [
    page,
    pageSize,
    debouncedQ,
    operatingMode,
    deploymentTopology,
    billingStatus,
    t,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, operatingMode, deploymentTopology, billingStatus]);

  function resetFilters() {
    setQ("");
    setOperatingMode("");
    setDeploymentTopology("");
    setBillingStatus("");
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("hint")} />

      <EraListFilterBar
        onReset={resetFilters}
        resetLabel={tCommon("filterReset")}
      >
        <label className="block text-xs font-medium text-[#7F8C8D]">
          {t("searchLabel")}
          <input
            className={`${MODAL_INPUT_CLASS} mt-1 min-w-[16rem]`}
            placeholder={t("searchPlaceholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colMode")}
          value={operatingMode}
          onChange={(next) => setOperatingMode(String(next))}
          options={MODE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.value ? o.label : tCommon("all"),
          }))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colTopology")}
          value={deploymentTopology}
          onChange={(next) => setDeploymentTopology(String(next))}
          options={TOPO_OPTIONS.map((o) => ({
            value: o.value,
            label: o.value ? o.label : tCommon("all"),
          }))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("colStatus")}
          value={billingStatus}
          onChange={(next) => setBillingStatus(String(next))}
          options={BILLING_OPTIONS.map((o) => ({
            value: o.value,
            label: o.value ? o.label : tCommon("all"),
          }))}
        />
      </EraListFilterBar>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      <div className={CARD_CONTAINER_CLASS}>
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colMode")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTopology")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTier")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className={`${DATA_TABLE_TR_CLASS} hover:bg-[#F8FAFC]`}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <Link
                      href={`/orgs/${row.id}`}
                      className="font-medium text-[#2980B9] hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="font-mono text-sm font-semibold text-[#34495E]">
                      {row.publicOrgNumber}
                    </div>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <span className="rounded-full bg-[#ECF0F1] px-2 py-0.5 text-xs font-medium text-[#34495E]">
                      {row.operatingMode}
                    </span>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <span className="rounded-full bg-[#ECF0F1] px-2 py-0.5 text-xs font-medium text-[#34495E]">
                      {row.deploymentTopology}
                    </span>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.currentTier ?? "—"}
                    {row.isTrial ? (
                      <span className="ml-1 text-xs text-amber-700">· {t("trial")}</span>
                    ) : null}
                    {row.isBlocked ? (
                      <span className="ml-1 text-xs text-red-700">· {t("blocked")}</span>
                    ) : null}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${billingChipClass(row.billingStatus)}`}
                    >
                      {row.billingStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={5}>
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          labels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      </div>
    </div>
  );
}
