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

type Row = {
  id: string;
  code: string;
  kind: string;
  nameAz: string;
  nameRu: string;
  nameEn: string;
  isActive: boolean;
  usageTotal?: number;
};

/** Hub-owned catalog — read-only local cache snapshot. */
export default function DataHubUomPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/admin/units-of-measure");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      const data = (await res.json()) as Row[];
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
        title={t("superAdmin.dataHubUom")}
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
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Kind</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>AZ</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>RU</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>EN</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>Usage</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{r.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.kind}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.nameAz}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.nameRu}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.nameEn}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right`}>{r.usageTotal ?? 0}</td>
                <td className={DATA_TABLE_TD_CLASS}>{r.isActive ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </SuperAdminDataTable>
      )}
    </div>
  );
}
