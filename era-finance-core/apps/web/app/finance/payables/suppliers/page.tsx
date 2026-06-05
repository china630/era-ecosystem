"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "../../../../components/layout/page-header";
import { PayPurchaseModal } from "../../../../components/purchases/PayPurchaseModal";
import { apiFetch } from "../../../../lib/api-client";
import { formatMoneyAzn } from "../../../../lib/format-money";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../../lib/design-system";
import { subscribeListRefresh } from "../../../../lib/list-refresh-bus";
import { useRequireAuth } from "../../../../lib/use-require-auth";

type PayableRow = {
  counterpartyId: string;
  counterpartyName: string;
  payable531: string;
};

export default function SupplierPayablesPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<PayableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payCpId, setPayCpId] = useState<string | undefined>();
  const [payDefaultAmount, setPayDefaultAmount] = useState<string | undefined>();

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await apiFetch("/api/payables/suppliers");
    if (!res.ok) {
      toast.error(await res.text());
      setRows([]);
    } else {
      const data = (await res.json()) as { items?: PayableRow[] };
      setRows(data.items ?? []);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  useEffect(() => {
    if (!ready || !token) return;
    return subscribeListRefresh("payables", () => void load());
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
    <div className="w-full max-w-none space-y-6">
      <PageHeader
        title={t("payables.suppliersTitle", { defaultValue: "Təchizatçılar (531)" })}
        subtitle={t("payables.suppliersHint", {
          defaultValue: "Kreditor borcları üzrə ödəniş",
        })}
      />

      {loading ? <p className="text-gray-600">{t("common.loading")}</p> : null}
      {!loading ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  {t("counterparties.name", { defaultValue: "Kontragent" })}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                  {t("payables.balance531", { defaultValue: "531 borc" })}
                </th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className={DATA_TABLE_TR_CLASS}>
                  <td colSpan={3} className={`${DATA_TABLE_TD_CLASS} py-8 text-center text-slate-500`}>
                    {t("payables.empty", { defaultValue: "Açıq borc yoxdur" })}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.counterpartyId} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{r.counterpartyName}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.payable531)}</td>
                    <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                      <button
                        type="button"
                        className={SECONDARY_BUTTON_CLASS}
                        onClick={() => {
                          setPayCpId(r.counterpartyId);
                          setPayDefaultAmount(r.payable531);
                          setPayOpen(true);
                        }}
                      >
                        {t("inventory.purchasePayAction", { defaultValue: "Ödəniş et" })}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      <PayPurchaseModal
        open={payOpen}
        counterpartyId={payCpId}
        defaultAmount={payDefaultAmount}
        payUrl={
          payCpId
            ? `/api/payables/suppliers/${encodeURIComponent(payCpId)}/pay`
            : ""
        }
        onPaid={() => void load()}
        onClose={() => {
          setPayOpen(false);
          setPayCpId(undefined);
          setPayDefaultAmount(undefined);
        }}
      />
    </div>
  );
}
