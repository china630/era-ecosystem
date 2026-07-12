"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { EmptyState } from "../../../components/empty-state";
import { PageHeader } from "../../../components/layout/page-header";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";

type PriceListRow = {
  id: string;
  name: string;
  currencyCode: string;
  validFrom: string;
  validTo?: string | null;
  channel?: string | null;
  isActive: boolean;
  _count?: { lines: number };
};

type ProductRow = { id: string; name: string; sku: string; price: unknown };

type LineForm = { productId: string; unitPrice: string };

export default function PriceListsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [rows, setRows] = useState<PriceListRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [currencyCode, setCurrencyCode] = useState("AZN");
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState("");
  const [channel, setChannel] = useState("");
  const [lines, setLines] = useState<LineForm[]>([{ productId: "", unitPrice: "" }]);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await apiFetch("/api/price-lists?isActive=true");
    if (!res.ok) {
      setErr(`${t("catalog.priceList.loadErr")}: ${res.status}`);
      setRows([]);
    } else {
      setRows(await res.json());
    }
    setLoading(false);
  }, [token, t]);

  const loadProducts = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch("/api/products?limit=200");
    if (res.ok) setProducts(await res.json());
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
    void loadProducts();
  }, [load, loadProducts, ready, token]);

  function openCreate() {
    setEditId(null);
    setName("");
    setCurrencyCode("AZN");
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidTo("");
    setChannel("");
    setLines([{ productId: "", unitPrice: "" }]);
    setModalOpen(true);
  }

  async function openEdit(id: string) {
    const res = await apiFetch(`/api/price-lists/${id}`);
    if (!res.ok) {
      toast.error(t("catalog.priceList.loadErr"));
      return;
    }
    const row = (await res.json()) as {
      id: string;
      name: string;
      currencyCode: string;
      validFrom: string;
      validTo?: string | null;
      channel?: string | null;
      lines?: Array<{ productId: string; unitPrice: unknown }>;
    };
    setEditId(row.id);
    setName(row.name);
    setCurrencyCode(row.currencyCode);
    setValidFrom(String(row.validFrom).slice(0, 10));
    setValidTo(row.validTo ? String(row.validTo).slice(0, 10) : "");
    setChannel(row.channel ?? "");
    setLines(
      (row.lines ?? []).map((l) => ({
        productId: l.productId,
        unitPrice: String(l.unitPrice ?? ""),
      })),
    );
    if (!row.lines?.length) setLines([{ productId: "", unitPrice: "" }]);
    setModalOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      currencyCode,
      validFrom,
      validTo: validTo.trim() || undefined,
      channel: channel.trim() || undefined,
      lines: lines
        .filter((l) => l.productId && Number(l.unitPrice.replace(",", ".")) >= 0)
        .map((l) => ({
          productId: l.productId,
          unitPrice: Number(l.unitPrice.replace(",", ".")),
        })),
    };
    const res = await apiFetch(
      editId ? `/api/price-lists/${editId}` : "/api/price-lists",
      {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(t("catalog.priceList.saveErr"));
      return;
    }
    toast.success(t("catalog.priceList.saved"));
    setModalOpen(false);
    await load();
  }

  if (!ready) return <p>{t("common.loading")}</p>;
  if (!token) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("catalog.priceList.pageTitle")}
        subtitle={t("catalog.priceList.subtitle")}
      />

      <div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
          <Plus className="mr-1 inline h-4 w-4" />
          {t("catalog.priceList.newBtn")}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? (
        <p className="text-sm text-gray-600">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title={t("catalog.priceList.emptyTitle")}
          description={t("catalog.priceList.emptyHint")}
        />
      ) : (
        <div className={DATA_TABLE_VIEWPORT_CLASS}>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("catalog.priceList.colName")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("catalog.priceList.colCurrency")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("catalog.priceList.colValidFrom")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("catalog.priceList.colChannel")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("catalog.priceList.colLines")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={DATA_TABLE_TD_CLASS}>{r.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.currencyCode}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{String(r.validFrom).slice(0, 10)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r.channel || "—"}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{r._count?.lines ?? 0}</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className={TABLE_ROW_ICON_BTN_CLASS}
                      onClick={() => void openEdit(r.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
            onSubmit={(e) => void save(e)}
          >
            <h2 className="mb-4 text-lg font-semibold">
              {editId ? t("catalog.priceList.editTitle") : t("catalog.priceList.newTitle")}
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.name")}</span>
                <input
                  className={`${MODAL_INPUT_CLASS} w-full`}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.currency")}</span>
                <select
                  className={`${MODAL_INPUT_CLASS} w-full`}
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                >
                  {["AZN", "USD", "EUR"].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.validFrom")}</span>
                  <input
                    type="date"
                    className={`${MODAL_INPUT_CLASS} w-full`}
                    required
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.validTo")}</span>
                  <input
                    type="date"
                    className={`${MODAL_INPUT_CLASS} w-full`}
                    value={validTo}
                    onChange={(e) => setValidTo(e.target.value)}
                  />
                </label>
              </div>
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.channel")}</span>
                <input
                  className={`${MODAL_INPUT_CLASS} w-full`}
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder={t("catalog.priceList.channelPh")}
                />
              </label>
              <div>
                <div className="mb-2 flex justify-between">
                  <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.lines")}</span>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => setLines((p) => [...p, { productId: "", unitPrice: "" }])}
                  >
                    {t("catalog.priceList.addLine")}
                  </button>
                </div>
                {lines.map((line, idx) => (
                  <div key={idx} className="mb-2 grid grid-cols-2 gap-2">
                    <select
                      className={MODAL_INPUT_CLASS}
                      value={line.productId}
                      onChange={(e) =>
                        setLines((p) =>
                          p.map((x, i) => (i === idx ? { ...x, productId: e.target.value } : x)),
                        )
                      }
                    >
                      <option value="">{t("catalog.priceList.selectProduct")}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) — {formatMoneyAzn(p.price)}
                        </option>
                      ))}
                    </select>
                    <input
                      className={MODAL_INPUT_CLASS}
                      placeholder={t("catalog.priceList.unitPrice")}
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((p) =>
                          p.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={saving}>
                {t("catalog.priceList.save")}
              </button>
              <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => setModalOpen(false)}>
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
