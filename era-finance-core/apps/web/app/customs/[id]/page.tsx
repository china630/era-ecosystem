"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { PageHeader } from "../../../components/layout/page-header";
import { apiFetch } from "../../../lib/api-client";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";

type ItemRow = {
  id: string;
  sequenceNumber: number;
  hsCode: string;
  description: string;
  productId: string | null;
  statisticalValueAzn: unknown;
  calculatedDutyAzn: unknown;
  calculatedVatAzn: unknown;
  portalDutyAzn: unknown | null;
  portalVatAzn: unknown | null;
};

type DeclarationDetail = {
  id: string;
  bgdNumber: string;
  bgdDate: string;
  currency: string;
  status: string;
  senderName: string | null;
  receiverName: string | null;
  mismatchPctDuty?: number;
  mismatchPctVat?: number;
  items: ItemRow[];
};

type AllocateMethod = "STAT_VALUE" | "WEIGHT" | "QUANTITY";

function money(v: unknown): string {
  if (v == null) return "—";
  return String(v);
}

export default function CustomsDeclarationDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const id = String(params.id ?? "");
  const { token, ready } = useRequireAuth();
  const [row, setRow] = useState<DeclarationDetail | null>(null);
  const [purchaseTxId, setPurchaseTxId] = useState("");
  const [attachBusy, setAttachBusy] = useState(false);
  const [allocateBusy, setAllocateBusy] = useState(false);
  const [allocateMethod, setAllocateMethod] = useState<AllocateMethod>("STAT_VALUE");
  const [productLinkByItem, setProductLinkByItem] = useState<Record<string, string>>({});
  const [linkBusyItem, setLinkBusyItem] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !id) return;
    const res = await apiFetch(`/api/customs/declarations/${encodeURIComponent(id)}`);
    if (res.ok) setRow((await res.json()) as DeclarationDetail);
    else setRow(null);
  }, [token, id]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [ready, token, load]);

  const attach = async () => {
    if (!token || !purchaseTxId.trim()) return;
    setAttachBusy(true);
    try {
      const res = await apiFetch(`/api/customs/declarations/${encodeURIComponent(id)}/attach`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchaseTransactionId: purchaseTxId.trim() }),
      });
      if (!res.ok) {
        window.alert(await res.text());
        return;
      }
      await load();
    } finally {
      setAttachBusy(false);
    }
  };

  const allocateLandedCost = async () => {
    if (!token) return;
    setAllocateBusy(true);
    try {
      const res = await apiFetch(
        `/api/customs/declarations/${encodeURIComponent(id)}/allocate-landed-cost`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: allocateMethod }),
        },
      );
      if (!res.ok) {
        window.alert(await res.text());
        return;
      }
      window.alert(t("trade.customs.detailAllocateOk"));
      await load();
    } finally {
      setAllocateBusy(false);
    }
  };

  const linkProduct = async (itemId: string) => {
    const productId = productLinkByItem[itemId]?.trim();
    if (!token || !productId) return;
    setLinkBusyItem(itemId);
    try {
      const res = await apiFetch(
        `/api/customs/declarations/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/product`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        },
      );
      if (!res.ok) {
        window.alert(await res.text());
        return;
      }
      await load();
    } finally {
      setLinkBusyItem(null);
    }
  };

  if (!row) {
    return (
      <div className="space-y-4 p-4">
        <PageHeader title={t("trade.customs.detailTitle")} />
        <p className="text-sm text-slate-600">{t("common.loadErr")}</p>
        <Link href="/customs" className="text-blue-600 underline text-sm">
          ← {t("trade.customs.title")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 max-w-6xl mx-auto">
      <PageHeader title={`${t("trade.customs.detailTitle")} ${row.bgdNumber}`} />
      <p className="text-sm">
        <Link href="/customs" className="text-blue-600 underline">
          ← {t("trade.customs.title")}
        </Link>
      </p>
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm space-y-1">
        <div>
          <span className="text-slate-500">{t("trade.customs.colDate")}: </span>
          {String(row.bgdDate).slice(0, 10)}
        </div>
        <div>
          <span className="text-slate-500">{t("trade.customs.colCurrency")}: </span>
          {row.currency}
        </div>
        <div>
          <span className="text-slate-500">{t("trade.customs.colStatus")}: </span>
          {row.status}
        </div>
        <div>
          <span className="text-slate-500">{t("trade.customs.colSender")}: </span>
          {row.senderName ?? "—"}
        </div>
        <div>
          <span className="text-slate-500">{t("trade.customs.colReceiver")}: </span>
          {row.receiverName ?? "—"}
        </div>
        {row.mismatchPctDuty != null && row.mismatchPctDuty > 0.5 ? (
          <p className="text-amber-800 text-xs mt-2">
            {t("trade.customs.detailMismatchDuty", { pct: String(row.mismatchPctDuty) })}
          </p>
        ) : null}
        {row.mismatchPctVat != null && row.mismatchPctVat > 0.5 ? (
          <p className="text-amber-800 text-xs mt-2">
            {t("trade.customs.detailMismatchVat", { pct: String(row.mismatchPctVat) })}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-700">
          {t("trade.customs.detailAllocateLandedCost")}
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-xs text-slate-600 flex items-center gap-2">
            {t("trade.customs.detailAllocateMethod")}
            <select
              className="border rounded px-2 py-1 text-sm"
              value={allocateMethod}
              onChange={(e) => setAllocateMethod(e.target.value as AllocateMethod)}
            >
              <option value="STAT_VALUE">{t("trade.customs.methodStatValue")}</option>
              <option value="WEIGHT">{t("trade.customs.methodWeight")}</option>
              <option value="QUANTITY">{t("trade.customs.methodQuantity")}</option>
            </select>
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={allocateBusy}
            onClick={() => void allocateLandedCost()}
          >
            {allocateBusy ? t("trade.customs.detailAllocateBusy") : t("trade.customs.detailAllocateLandedCost")}
          </button>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-800">{t("trade.customs.detailItems")}</h2>
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>#</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colHs")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colDesc")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colStatValue")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colCalcDuty")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colCalcVat")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colPortalDuty")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("trade.customs.colPortalVat")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("nav.products")}</th>
            </tr>
          </thead>
          <tbody>
            {row.items.map((it) => (
              <tr key={it.id} className={DATA_TABLE_TR_CLASS}>
                <td className={DATA_TABLE_TD_CLASS}>{it.sequenceNumber}</td>
                <td className={DATA_TABLE_TD_CLASS}>{it.hsCode}</td>
                <td className={DATA_TABLE_TD_CLASS}>{it.description}</td>
                <td className={DATA_TABLE_TD_CLASS}>{money(it.statisticalValueAzn)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{money(it.calculatedDutyAzn)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{money(it.calculatedVatAzn)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{money(it.portalDutyAzn)}</td>
                <td className={DATA_TABLE_TD_CLASS}>{money(it.portalVatAzn)}</td>
                <td className={DATA_TABLE_TD_CLASS}>
                  {it.productId ? (
                    <span className="text-xs font-mono">{it.productId.slice(0, 8)}…</span>
                  ) : (
                    <div className="flex flex-col gap-1 min-w-[200px]">
                      <input
                        className="border rounded px-2 py-1 text-xs font-mono"
                        placeholder={t("trade.customs.detailLinkProduct")}
                        value={productLinkByItem[it.id] ?? ""}
                        onChange={(e) =>
                          setProductLinkByItem((prev) => ({
                            ...prev,
                            [it.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline text-left"
                        disabled={linkBusyItem === it.id}
                        onClick={() => void linkProduct(it.id)}
                      >
                        {linkBusyItem === it.id
                          ? "…"
                          : t("trade.customs.detailLinkProductCta")}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
        <p className="text-xs text-slate-600">{t("trade.customs.detailAttachHint")}</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            className="border rounded px-2 py-1 text-sm flex-1 min-w-[240px]"
            value={purchaseTxId}
            onChange={(e) => setPurchaseTxId(e.target.value)}
            placeholder="00000000-0000-0000-0000-000000000000"
          />
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={attachBusy}
            onClick={() => void attach()}
          >
            {attachBusy ? "…" : t("trade.customs.detailAttachCta")}
          </button>
        </div>
      </div>
    </div>
  );
}
