"use client";
import { DatePicker as FinanceDatePicker } from "../../../components/ui/date-picker";

import { CatalogField } from "@era/satellite-kit/ui";
import { Pencil, Plus, X } from "lucide-react";
import { bakuDateDisplay, todayBakuYmd } from "@era/satellite-kit/time";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { formatMoneyAzn } from "../../../lib/format-money";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { EmptyState } from "../../../components/empty-state";
import { PageHeader } from "../../../components/layout/page-header";
import { Button } from "../../../components/ui/button";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  MODAL_CLOSE_BUTTON_CLASS,
  MODAL_DIALOG_CONTENT_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  MODAL_FOOTER_ACTIONS_CLASS,
  MODAL_FOOTER_BUTTON_CLASS,
  MODAL_INPUT_CLASS,
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
  const [validFrom, setValidFrom] = useState(() => todayBakuYmd());
  const [validTo, setValidTo] = useState("");
  const [channel, setChannel] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
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

  const loadChannels = useCallback(async () => {
    if (!token) return;
    const res = await apiFetch("/api/price-lists/channels");
    if (!res.ok) return;
    const body = (await res.json()) as { channels?: string[] };
    setChannels(body.channels ?? []);
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
    void loadProducts();
    void loadChannels();
  }, [load, loadProducts, loadChannels, ready, token]);

  function openCreate() {
    setEditId(null);
    setName("");
    setCurrencyCode("AZN");
    setValidFrom(todayBakuYmd());
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
    const res = await apiFetch(editId ? `/api/price-lists/${editId}` : "/api/price-lists", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
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

  const channelOptions = (channel && !channels.includes(channel) ? [channel, ...channels] : channels).map(
    (code) => ({ value: code, label: code }),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("catalog.priceList.pageTitle")}
        subtitle={t("catalog.priceList.subtitle")}
        actions={
          <Button type="button" variant="primary" onClick={openCreate}>
            <Plus className="mr-1 inline h-4 w-4" />
            {t("catalog.priceList.newBtn")}
          </Button>
        }
      />

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
                  <td className={DATA_TABLE_TD_CLASS}>
                    {bakuDateDisplay(String(r.validFrom).slice(0, 10))}
                  </td>
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <form
            className={`${MODAL_DIALOG_CONTENT_CLASS} max-w-lg`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="price-list-modal-title"
            onSubmit={(e) => void save(e)}
          >
            <header className="flex shrink-0 items-start justify-between gap-3">
              <h2
                id="price-list-modal-title"
                className="m-0 text-lg font-semibold text-[#34495E]"
              >
                {editId ? t("catalog.priceList.editTitle") : t("catalog.priceList.newTitle")}
              </h2>
              <Button
                type="button"
                variant="ghost"
                className={MODAL_CLOSE_BUTTON_CLASS}
                onClick={() => setModalOpen(false)}
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </header>
            <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
              <label className="block">
                <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.name")}</span>
                <input
                  className={`${MODAL_INPUT_CLASS} w-full`}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("catalog.priceList.currency")}
                value={currencyCode}
                onChange={(next) => {
                  const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                  if (v) setCurrencyCode(v);
                }}
                options={[
                  { value: "AZN", label: "AZN" },
                  { value: "USD", label: "USD" },
                  { value: "EUR", label: "EUR" },
                ]}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.validFrom")}</span>
                  <FinanceDatePicker
                    value={validFrom}
                    onChange={(iso) => setValidFrom(iso)}
                    respectPeriodLock={false}
                    required
                  />
                </label>
                <label className="block">
                  <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.validTo")}</span>
                  <FinanceDatePicker
                    value={validTo}
                    onChange={(iso) => setValidTo(iso)}
                    respectPeriodLock={false}
                  />
                </label>
              </div>
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("catalog.priceList.channel")}
                value={channel}
                onChange={(next) => {
                  const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                  setChannel(v);
                }}
                options={[
                  { value: "", label: t("catalog.priceList.channelPh") },
                  ...channelOptions,
                ]}
              />
              <div>
                <div className="mb-2 flex justify-between">
                  <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.lines")}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setLines((p) => [...p, { productId: "", unitPrice: "" }])}
                  >
                    {t("catalog.priceList.addLine")}
                  </Button>
                </div>
                {lines.map((line, idx) => (
                  <div key={idx} className="mb-2 grid grid-cols-2 gap-2">
                    <CatalogField
                      kind="SEARCHABLE"
                      label={t("catalog.priceList.selectProduct")}
                      value={line.productId}
                      onChange={(next) => {
                        const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                        setLines((p) =>
                          p.map((x, i) => (i === idx ? { ...x, productId: v } : x)),
                        );
                      }}
                      options={products.map((p) => ({
                        value: p.id,
                        label: `${p.name} (${p.sku}) — ${formatMoneyAzn(p.price)}`,
                      }))}
                    />
                    <label className="block">
                      <span className={MODAL_FIELD_LABEL_CLASS}>{t("catalog.priceList.unitPrice")}</span>
                      <input
                        className={`${MODAL_INPUT_CLASS} w-full`}
                        value={line.unitPrice}
                        onChange={(e) =>
                          setLines((p) =>
                            p.map((x, i) => (i === idx ? { ...x, unitPrice: e.target.value } : x)),
                          )
                        }
                      />
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <footer className={MODAL_FOOTER_ACTIONS_CLASS}>
              <Button
                type="button"
                variant="secondary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                onClick={() => setModalOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                className={MODAL_FOOTER_BUTTON_CLASS}
                disabled={saving}
              >
                {t("catalog.priceList.save")}
              </Button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
