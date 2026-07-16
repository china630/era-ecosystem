"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { formatMoneyAzn } from "../../lib/format-money";
import { useRequireAuth } from "../../lib/use-require-auth";
import { EmptyState } from "../../components/empty-state";
import { PageHeader } from "../../components/layout/page-header";
import { SubscriptionPaywall } from "../../components/subscription-paywall";
import { IntangibleAssetModal } from "../../components/intangible-assets/intangible-asset-modal";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_ACTIONS_TH_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../lib/design-system";
import { TOOLBAR_MONTH_INPUT_CLASS } from "../../lib/form-styles";

type Ia = {
  id: string;
  name: string;
  inventoryNumber: string;
  purchaseDate: string;
  status: "ACTIVE" | "DISPOSED";
  purchasePrice: unknown;
  usefulLifeMonths: number;
  bookedAmortization: unknown;
};

function IntangibleAssetsPageContent() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<Ia[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [depYearMonth, setDepYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [runningAmort, setRunningAmort] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/intangible-assets");
    if (!res.ok) {
      setErr(`${t("intangibleAssets.loadErr")}: ${res.status}`);
      setRows([]);
    } else {
      setRows(await res.json());
    }
    setLoading(false);
  }, [token, t]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  async function runAmortization() {
    if (!token) return;
    setRunningAmort(true);
    try {
      const parts = depYearMonth.trim().split("-");
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const res = await apiFetch(
        `/api/intangible-assets/run-amortization?year=${year}&month=${month}`,
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error(await res.text());
        return;
      }
      const data = (await res.json()) as { assetsCount: number; totalAmount: string };
      toast.success(
        t("intangibleAssets.amortRunDone", {
          count: data.assetsCount,
          amount: data.totalAmount,
        }),
      );
      await load();
    } finally {
      setRunningAmort(false);
    }
  }

  async function acquire(id: string) {
    const res = await apiFetch(`/api/intangible-assets/${encodeURIComponent(id)}/acquire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creditSource: "BANK" }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    await load();
  }

  async function dispose(id: string) {
    if (!window.confirm(t("intangibleAssets.disposeConfirm"))) return;
    const proceeds = window.prompt(t("intangibleAssets.lifecycleProceeds"), "0");
    const res = await apiFetch(`/api/intangible-assets/${encodeURIComponent(id)}/dispose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proceeds: Number(proceeds || 0) }),
    });
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    await load();
  }

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("intangibleAssets.title")}
        subtitle={
          <p className="m-0 text-[13px] leading-snug text-[#7F8C8D]">
            {t("intangibleAssets.subtitle")}
          </p>
        }
        leading={
          <div className="flex h-8 flex-wrap items-center gap-2">
            <span className="shrink-0 text-sm font-medium leading-none text-[#34495E]">
              {t("intangibleAssets.amortMonthLabel")}
            </span>
            <input
              type="month"
              value={depYearMonth}
              onChange={(e) => setDepYearMonth(e.target.value)}
              className={TOOLBAR_MONTH_INPUT_CLASS}
            />
          </div>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => void runAmortization()}
              disabled={runningAmort}
              className={SECONDARY_BUTTON_CLASS}
            >
              {runningAmort ? "…" : t("intangibleAssets.runAmortization")}
            </button>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              + {t("intangibleAssets.newBtn")}
            </button>
          </>
        }
      />

      {err ? <p className="text-red-800 text-sm">{err}</p> : null}
      {loading && <p className="text-gray-600">{t("common.loading")}</p>}

      {!loading && rows.length === 0 && !err ? (
        <div className="flex min-h-[320px] w-full flex-col items-center justify-center py-8">
          <EmptyState
            className="max-w-lg w-full border-[#D5DADF] bg-white"
            icon={<Sparkles className="mx-auto h-12 w-12 stroke-[1.5] text-[#7F8C8D]" aria-hidden />}
            title={t("intangibleAssets.emptyTitle")}
            description={t("intangibleAssets.emptyHint")}
            action={
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
                + {t("intangibleAssets.newBtn")}
              </button>
            }
          />
        </div>
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={`${DATA_TABLE_CLASS} min-w-full`}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("intangibleAssets.thName")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("intangibleAssets.invNo")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("intangibleAssets.purchasePrice")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("intangibleAssets.thBooked")}</th>
                <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("intangibleAssets.bookValue")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("intangibleAssets.status")}</th>
                <th className={DATA_TABLE_ACTIONS_TH_CLASS}>{t("teamPage.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>{r.name}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{r.inventoryNumber}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.purchasePrice)}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.bookedAmortization)}</td>
                  <td className={DATA_TABLE_TD_RIGHT_CLASS}>
                    {formatMoneyAzn(Number(r.purchasePrice) - Number(r.bookedAmortization))}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{t(`intangibleAssets.status_${r.status}`)}</td>
                  <td className={DATA_TABLE_ACTIONS_TD_CLASS}>
                    <div className="flex items-center justify-end gap-1">
                      {r.status === "ACTIVE" ? (
                        <>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("intangibleAssets.acquire")}
                            onClick={() => void acquire(r.id)}
                          >
                            {t("intangibleAssets.acquireShort")}
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            title={t("intangibleAssets.dispose")}
                            onClick={() => void dispose(r.id)}
                          >
                            {t("intangibleAssets.disposeShort")}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <IntangibleAssetModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => void load()} />
    </div>
  );
}

export default function IntangibleAssetsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;
  return (
    <SubscriptionPaywall module="fixedAssets">
      <IntangibleAssetsPageContent />
    </SubscriptionPaywall>
  );
}
