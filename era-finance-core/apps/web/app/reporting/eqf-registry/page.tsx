"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import { EmptyState } from "../../../components/empty-state";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CENTER_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { formatMoneyAzn } from "../../../lib/format-money";

type EqfItem = {
  id: string;
  number: string;
  status: string;
  totalAmount: string;
  counterpartyId: string;
  counterparty: { id: string; name: string; taxId: string | null };
  eqaimeNumber: string | null;
  eqaimeStatus: string | null;
  eqaimeSubmittedAt: string | null;
  dvxExternalId: string | null;
  dvxSyncStatus: string;
  dvxSyncError: string | null;
};

type EqfGroup = {
  counterpartyId: string;
  counterpartyName: string;
  counterpartyTaxId: string | null;
  invoices: EqfItem[];
};

type EqfResponse = {
  total: number;
  items: EqfItem[];
  groups: EqfGroup[];
  s2sEnabled: boolean;
};

export default function EqfRegistryPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EqfResponse | null>(null);
  const [status, setStatus] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const qs = new URLSearchParams();
    if (status.trim()) qs.set("status", status.trim());
    if (counterpartyId.trim()) qs.set("counterpartyId", counterpartyId.trim());
    const res = await apiFetch(`/api/reporting/eqf-registry?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setData(null);
      return;
    }
    setData((await res.json()) as EqfResponse);
  }, [token, status, counterpartyId]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  if (!ready) {
    return <p className="text-[#7F8C8D]">{t("common.loading")}</p>;
  }
  if (!token) return null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("reporting.eqfRegistryTitle")}
        subtitle={t("reporting.eqfRegistrySubtitle")}
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[13px] text-[#34495E]">
          {t("invoices.eqaimeStatus")}
          <select
            className={`${MODAL_INPUT_CLASS} mt-1 block min-w-[10rem]`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{t("reporting.eqfRegistryAllStatuses", { defaultValue: "Все статусы" })}</option>
            <option value="DRAFT">DRAFT</option>
            <option value="READY">READY</option>
            <option value="SUBMITTED">SUBMITTED</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="ERROR">ERROR</option>
          </select>
        </label>
        <label className="text-[13px] text-[#34495E]">
          {t("invoices.counterparty")} ID
          <input
            className={`${MODAL_INPUT_CLASS} mt-1 block min-w-[16rem]`}
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
            placeholder="uuid"
          />
        </label>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void load()}>
          {t("common.refresh", { defaultValue: "Refresh" })}
        </button>
        {data ? (
          <span className="text-[13px] text-[#7F8C8D]">
            S2S: {data.s2sEnabled ? "on" : "off"} · {data.total}
          </span>
        ) : null}
      </div>

      {loading ? (
        <p className="text-[#7F8C8D]">{t("common.loading")}</p>
      ) : !data?.groups.length ? (
        <EmptyState title={t("reporting.eqfRegistryEmpty")} />
      ) : (
        <div className="space-y-6">
          {data.groups.map((g) => (
            <section key={g.counterpartyId} className="space-y-2">
              <h2 className="text-base font-semibold text-[#34495E]">
                {g.counterpartyName}
                {g.counterpartyTaxId ? (
                  <span className="ml-2 font-mono text-[13px] font-normal text-[#7F8C8D]">
                    {g.counterpartyTaxId}
                  </span>
                ) : null}
              </h2>
              <div className={DATA_TABLE_VIEWPORT_CLASS}>
                <table className={DATA_TABLE_CLASS}>
                  <thead>
                    <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("invoices.number")}</th>
                      <th className={DATA_TABLE_TH_CENTER_CLASS}>{t("invoices.eqaimeStatus")}</th>
                      <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("invoices.eqaimeNumber")}</th>
                      <th className={DATA_TABLE_TH_CENTER_CLASS}>DVX</th>
                      <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("invoices.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.invoices.map((inv) => (
                      <tr key={inv.id} className={DATA_TABLE_TR_CLASS}>
                        <td className={DATA_TABLE_TD_CLASS}>{inv.number}</td>
                        <td className={DATA_TABLE_TD_CENTER_CLASS}>
                          {inv.eqaimeStatus ?? "—"}
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>
                          {inv.eqaimeNumber ?? inv.dvxExternalId ?? "—"}
                        </td>
                        <td className={DATA_TABLE_TD_CENTER_CLASS}>{inv.dvxSyncStatus}</td>
                        <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                          {formatMoneyAzn(inv.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
