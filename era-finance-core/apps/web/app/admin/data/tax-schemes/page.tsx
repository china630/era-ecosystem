"use client";

import { useCallback, useEffect, useState } from "react";
import { bakuDateDisplay } from "@era/satellite-kit/time";
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
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../../lib/design-system";

type Row = {
  id: string;
  code: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  nameRu: string;
  parameters: Record<string, string>;
};

export default function DataHubTaxSchemesPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await apiFetch("/api/admin/tax-schemes");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      setRows((await res.json()) as Row[]);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("superAdmin.dataHubTaxSchemes", "Tax schemes")}
        subtitle={t("reporting.simplifiedWatchSchemeHint")}
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
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.simplifiedWatchFrom")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.simplifiedWatchTo")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.simplifiedWatchDefaultRate")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.simplifiedWatchPosRate")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("reporting.simplifiedWatchThreshold")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{r.code}</td>
                <td className={DATA_TABLE_TD_CLASS}>{bakuDateDisplay(String(r.effectiveFrom).slice(0, 10))}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {r.effectiveTo ? bakuDateDisplay(String(r.effectiveTo).slice(0, 10)) : "—"}
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{r.parameters?.defaultSimplifiedPercent}%</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {r.parameters?.posSimplifiedPercent}% ({r.parameters?.posRateEffectiveFrom})
                </td>
                <td className={DATA_TABLE_TD_CLASS}>{r.parameters?.vatThresholdAzn}</td>
              </tr>
            ))}
          </tbody>
        </SuperAdminDataTable>
      )}
    </div>
  );
}
