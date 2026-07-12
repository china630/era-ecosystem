"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";
import {
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type Warehouse = { id: string; name: string };
type Product = { id: string; name: string; sku?: string | null };
type BinBalanceRow = {
  id: string;
  quantity: string | number;
  product: Product;
};
type ScannedBin = {
  id: string;
  code: string;
  barcode?: string | null;
  warehouse: Warehouse;
  zone?: { code: string; name: string } | null;
  binBalances: BinBalanceRow[];
};

type TabKey = "receive" | "issue" | "transfer" | "count";

export default function WmsMobilePage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const [tab, setTab] = useState<TabKey>("receive");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scanned, setScanned] = useState<ScannedBin | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [targetBarcode, setTargetBarcode] = useState("");
  const [targetBinId, setTargetBinId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("0");
  const [busy, setBusy] = useState(false);

  const tabButtons: Array<{ key: TabKey; label: string }> = useMemo(
    () => [
      { key: "receive", label: t("inventory.wms.tabReceive") },
      { key: "issue", label: t("inventory.wms.tabIssue") },
      { key: "transfer", label: t("inventory.wms.tabTransfer") },
      { key: "count", label: t("inventory.wms.tabCount") },
    ],
    [t],
  );

  const loadMeta = useCallback(async () => {
    if (!token) return;
    const [whRes, prodRes] = await Promise.all([
      apiFetch("/api/inventory/warehouses"),
      apiFetch("/api/products?page=1&pageSize=200"),
    ]);
    if (whRes.ok) {
      const wh = (await whRes.json()) as Warehouse[];
      setWarehouses(Array.isArray(wh) ? wh : []);
      if (!warehouseId && Array.isArray(wh) && wh[0]) {
        setWarehouseId(wh[0].id);
      }
    }
    if (prodRes.ok) {
      const body = (await prodRes.json()) as { items?: Product[] };
      setProducts(body.items ?? []);
    }
  }, [token, warehouseId]);

  useEffect(() => {
    if (!ready || !token) return;
    void loadMeta();
  }, [ready, token, loadMeta]);

  const scanBin = async () => {
    if (!barcode.trim()) return;
    setBusy(true);
    const qs = new URLSearchParams({ barcode: barcode.trim() });
    if (warehouseId) qs.set("warehouseId", warehouseId);
    const res = await apiFetch(`/api/inventory/wms/scan?${qs.toString()}`);
    setBusy(false);
    if (!res.ok) {
      toast.error(t("inventory.wms.scanErr"));
      setScanned(null);
      return;
    }
    const data = (await res.json()) as ScannedBin;
    setScanned(data);
    toast.success(t("inventory.wms.scanOk", { code: data.code }));
  };

  const scanTargetBin = async () => {
    if (!targetBarcode.trim()) return;
    const qs = new URLSearchParams({ barcode: targetBarcode.trim() });
    if (warehouseId) qs.set("warehouseId", warehouseId);
    const res = await apiFetch(`/api/inventory/wms/scan?${qs.toString()}`);
    if (!res.ok) {
      toast.error(t("inventory.wms.scanErr"));
      return;
    }
    const data = (await res.json()) as ScannedBin;
    setTargetBinId(data.id);
    toast.success(t("inventory.wms.targetOk", { code: data.code }));
  };

  const submit = async () => {
    if (!scanned?.id || !productId) {
      toast.error(t("inventory.wms.needScanProduct"));
      return;
    }
    setBusy(true);
    let res: Response;
    if (tab === "receive") {
      res = await apiFetch("/api/inventory/wms/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          binId: scanned.id,
          productId,
          quantity: Number(quantity),
        }),
      });
    } else if (tab === "issue") {
      res = await apiFetch("/api/inventory/wms/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          binId: scanned.id,
          productId,
          quantity: Number(quantity),
        }),
      });
    } else if (tab === "transfer") {
      if (!targetBinId) {
        setBusy(false);
        toast.error(t("inventory.wms.needTargetBin"));
        return;
      }
      res = await apiFetch("/api/inventory/wms/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceBinId: scanned.id,
          targetBinId,
          productId,
          quantity: Number(quantity),
        }),
      });
    } else {
      res = await apiFetch("/api/inventory/wms/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          binId: scanned.id,
          productId,
          quantityDelta: Number(adjustDelta),
        }),
      });
    }
    setBusy(false);
    if (!res.ok) {
      toast.error(t("inventory.wms.actionErr"));
      return;
    }
    toast.success(t("inventory.wms.actionOk"));
    setBarcode("");
    setScanned(null);
    setTargetBarcode("");
    setTargetBinId(null);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 pb-24">
      <PageHeader
        title={t("inventory.wms.title")}
        subtitle={t("inventory.wms.subtitle")}
      />

      <label className="text-sm font-medium">{t("inventory.filterWh")}</label>
      <select
        className={MODAL_INPUT_CLASS}
        value={warehouseId}
        onChange={(e) => setWarehouseId(e.target.value)}
      >
        <option value="">{t("inventory.whSelect")}</option>
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tabButtons.map((b) => (
          <button
            key={b.key}
            type="button"
            className={`min-h-14 rounded-xl px-3 py-4 text-base font-semibold ${
              tab === b.key ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS
            }`}
            onClick={() => setTab(b.key)}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium">
          {t("inventory.wms.barcodeLabel")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={MODAL_INPUT_CLASS}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder={t("inventory.wms.barcodePh")}
            onKeyDown={(e) => {
              if (e.key === "Enter") void scanBin();
            }}
          />
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} min-h-12 px-6`}
            disabled={busy}
            onClick={() => void scanBin()}
          >
            {t("inventory.wms.scanBtn")}
          </button>
        </div>

        {scanned ? (
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
            <div className="font-semibold">
              {scanned.code}
              {scanned.zone ? ` · ${scanned.zone.name}` : ""}
            </div>
            <div className="text-muted-foreground">{scanned.warehouse.name}</div>
            <ul className="mt-2 space-y-1">
              {scanned.binBalances.map((b) => (
                <li key={b.id}>
                  {b.product.name} — {String(b.quantity)}
                </li>
              ))}
              {scanned.binBalances.length === 0 ? (
                <li className="text-muted-foreground">{t("inventory.wms.emptyBin")}</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium">
          {t("inventory.wms.productLabel")}
        </label>
        <select
          className={MODAL_INPUT_CLASS}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        >
          <option value="">{t("inventory.wms.productPh")}</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.sku ? ` (${p.sku})` : ""}
            </option>
          ))}
        </select>

        {tab === "count" ? (
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium">
              {t("inventory.wms.adjustDelta")}
            </label>
            <input
              className={MODAL_INPUT_CLASS}
              value={adjustDelta}
              onChange={(e) => setAdjustDelta(e.target.value)}
              inputMode="decimal"
            />
          </div>
        ) : (
          <div className="mt-3">
            <label className="mb-2 block text-sm font-medium">
              {t("inventory.wms.quantityLabel")}
            </label>
            <input
              className={MODAL_INPUT_CLASS}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="decimal"
            />
          </div>
        )}

        {tab === "transfer" ? (
          <div className="mt-3 space-y-2">
            <label className="block text-sm font-medium">
              {t("inventory.wms.targetBinLabel")}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                className={MODAL_INPUT_CLASS}
                value={targetBarcode}
                onChange={(e) => setTargetBarcode(e.target.value)}
                placeholder={t("inventory.wms.targetBinPh")}
              />
              <button
                type="button"
                className={`${SECONDARY_BUTTON_CLASS} min-h-12`}
                onClick={() => void scanTargetBin()}
              >
                {t("inventory.wms.scanBtn")}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className={`${PRIMARY_BUTTON_CLASS} mt-4 min-h-14 w-full text-lg`}
          disabled={busy}
          onClick={() => void submit()}
        >
          {t("inventory.wms.submitBtn")}
        </button>
      </div>
    </div>
  );
}
