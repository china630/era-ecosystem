"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../../components/layout/page-header";
import { SuperAdminDataTable } from "../../../../components/admin/data-table";
import { apiFetch } from "../../../../lib/api-client";
import { useAuth } from "../../../../lib/auth-context";
import {
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../../lib/design-system";

type CurrencyRow = {
  id: string;
  code: string;
  symbol: string;
  decimals: number;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  isActive: boolean;
  sortOrder: number;
  usageTotal?: number;
};

/** Hub-owned ISO catalog — local FK-cache snapshot (read-only). */
export default function DataHubCurrenciesPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [rows, setRows] = useState<CurrencyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/admin/currencies");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      const data = (await res.json()) as CurrencyRow[];
      setRows(data.map((r) => ({ ...r, usageTotal: r.usageTotal ?? 0 })));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("superAdmin.dataHubCurrencies")}
        subtitle={t("superAdmin.dataHubReadOnly")}
      />
      <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
        {t("superAdminTranslations.refresh")}
      </button>
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("common.loading")}</p>
      ) : (
        <SuperAdminDataTable>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Code</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Symbol</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>AZ / RU / EN</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                {t("superAdmin.dataHubColUsage")}
              </th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>
                {t("superAdmin.dataHubColStatus")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{r.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.symbol}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {r.nameAz} / {r.nameRu} / {r.nameEn}
                </td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                  {r.usageTotal ?? 0}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {r.isActive
                    ? t("superAdmin.dataHubActive")
                    : t("superAdmin.dataHubInactive")}
                </td>
              </tr>
            ))}
          </tbody>
        </SuperAdminDataTable>
      )}
    </div>
  );
}
