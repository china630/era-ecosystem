"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../../lib/api-client";
import { CatalogField } from "@era/satellite-kit/ui";
import {
  CARD_CONTAINER_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { PageHeader } from "../../../components/layout/page-header";

type Warehouse = { id: string; name: string };
type Product = { id: string; name: string; sku: string; isService?: boolean };

export default function InventorySurplusPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [productId, setProductId] = useState("");
  const [inventoryAccountCode, setInventoryAccountCode] = useState<"201" | "204">("201");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [w, p] = await Promise.all([
      apiFetch("/api/inventory/warehouses"),
      apiFetch("/api/products"),
    ]);
    if (w.ok) {
      const list = (await w.json()) as Warehouse[];
      setWarehouses(list);
      setWarehouseId((prev) => prev || list[0]?.id || "");
    }
    if (p.ok) {
      const plist = ((await p.json()) as Product[]).filter((x) => !x.isService);
      setProducts(plist);
      setProductId((prev) => prev || plist[0]?.id || "");
    }
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    const up = Number(unitPrice);
    if (!warehouseId || !productId || !Number.isFinite(q) || q <= 0) {
      alert(t("inventory.adjustNeedFields"));
      return;
    }
    if (!Number.isFinite(up) || up < 0) {
      alert(t("inventory.adjustNeedUnitPrice"));
      return;
    }
    setBusy(true);
    const res = await apiFetch("/api/inventory/documents/surplus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId,
        productId,
        quantity: q,
        inventoryAccountCode,
        unitPrice: up,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      alert(await res.text());
      return;
    }
    router.push("/inventory");
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
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title={t("inventory.surplusDocTitle")}
        subtitle={t("inventory.adjustHint")}
        actions={
          <Link href="/inventory" className={SECONDARY_BUTTON_CLASS}>
            ← {t("inventory.backList")}
          </Link>
        }
      />

      <form onSubmit={(e) => void onSubmit(e)} className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <CatalogField
          kind="ENTITY_REF"
          label={t("inventory.transferFrom")}
          value={warehouseId}
          onChange={(next) => {
            const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
            setWarehouseId(v);
          }}
          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t("inventory.transferPickProduct")}
          value={productId}
          onChange={(next) => {
            const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
            setProductId(v);
          }}
          options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("inventory.adjustInvAccount")}
          value={inventoryAccountCode}
          onChange={(next) => {
            const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
            if (v === "201" || v === "204") setInventoryAccountCode(v);
          }}
          options={[
            { value: "201", label: t("inventory.adjustInv201") },
            { value: "204", label: t("inventory.adjustInv204") },
          ]}
        />
        <label className="block text-sm font-medium text-gray-700">
          {t("invoiceNew.quantity")}
          <input
            type="number"
            min={0.0001}
            step="any"
            className={INPUT_BORDERED_CLASS}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          {t("inventory.adjustUnitPrice")}
          <input
            type="number"
            min={0}
            step="0.01"
            className={INPUT_BORDERED_CLASS}
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
          {busy ? "…" : t("inventory.docSubmitSurplus")}
        </button>
      </form>
    </div>
  );
}
