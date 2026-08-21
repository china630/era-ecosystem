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
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../lib/cp-admin-fetch";

type OrgRow = {
  id: string;
  name: string;
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

export default function SuperAdminOrgsPage() {
  const t = useTranslations("superAdmin.orgs");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (q.trim()) params.set("q", q.trim());
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
  }, [page, q, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="text-sm text-[#7F8C8D]">{t("hint")}</p>

      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-2 p-4`}>
        <input
          className={`${MODAL_INPUT_CLASS} min-w-[16rem] flex-1`}
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setPage(1);
              void load();
            }
          }}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          onClick={() => {
            setPage(1);
            void load();
          }}
        >
          {t("search")}
        </button>
      </div>

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
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="font-medium text-[#34495E]">{row.name}</div>
                    <div className="font-mono text-[11px] text-[#95A5A6]">{row.id}</div>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.operatingMode}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.deploymentTopology}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {row.currentTier ?? "—"}
                    {row.isTrial ? ` · ${t("trial")}` : ""}
                    {row.isBlocked ? ` · ${t("blocked")}` : ""}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{row.billingStatus}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/super-admin/orgs/${row.id}`}
                        className="text-sm text-[#2980B9]"
                      >
                        {t("openHub")}
                      </Link>
                      <Link
                        href={`/super-admin/orgs/${row.id}/subscription`}
                        className="text-sm text-[#2980B9]"
                      >
                        {t("openLicense")}
                      </Link>
                      <Link
                        href={`/super-admin/orgs/${row.id}/placement`}
                        className="text-sm text-[#2980B9]"
                      >
                        Placement
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={6}>
                    {t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 border-t border-[#EBEDF0] p-3 text-sm">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {t("prev")}
          </button>
          <span>
            {t("page", { page, total: totalPages })}
          </span>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
          </button>
        </div>
      </div>
    </div>
  );
}
