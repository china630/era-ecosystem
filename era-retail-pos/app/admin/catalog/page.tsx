"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";

type CodeOption = { value: string; label: string };
type OutletRow = {
  id: string;
  code: string;
  name: string;
  revenueCode: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  website?: string | null;
};
type CategoryRow = { id: string; code: string; name: string; revenueCode: string | null };
type ProductRow = {
  id: string;
  sku: string;
  description: string;
  revenueCode: string | null;
  categoryId: string | null;
};

function withCurrent(options: CodeOption[], current: string): CodeOption[] {
  if (!current || options.some((option) => option.value === current)) return options;
  return [{ value: current, label: current }, ...options];
}

export default function RetailCatalogPage() {
  const t = useTranslations("catalogAdmin");
  const [notice, setNotice] = useState("");
  const [options, setOptions] = useState<CodeOption[]>([]);
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [outletId, setOutletId] = useState("");
  const [outletCode, setOutletCode] = useState("");
  const [outletPhone, setOutletPhone] = useState("");
  const [outletEmail, setOutletEmail] = useState("");
  const [outletAddress, setOutletAddress] = useState("");
  const [outletWebsite, setOutletWebsite] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryRevenue, setCategoryRevenue] = useState("");
  const [productId, setProductId] = useState("");
  const [productCategoryId, setProductCategoryId] = useState("");

  const load = useCallback(async () => {
    const [codesRes, outletRes, categoryRes, productRes] = await Promise.all([
      fetch("/api/admin/hotel-revenue-codes"),
      fetch("/api/admin/outlets"),
      fetch("/api/admin/product-categories"),
      fetch("/api/admin/products"),
    ]);
    const codesBody = await codesRes.json().catch(() => null);
    if (!codesRes.ok) {
      setNotice(
        codesRes.status === 403
          ? t("forbidden")
          : codesRes.status === 409
            ? t("notLinked")
            : t("unavailable"),
      );
      setOptions([]);
    } else {
      const codes = (codesBody?.codes ?? []) as Array<{ code: string; name: string }>;
      setOptions(
        codes.map((row) => ({
          value: row.code,
          label: row.name ? `${row.code} — ${row.name}` : row.code,
        })),
      );
      setNotice(codes.length === 0 ? t("empty") : "");
    }
    const outletBody = await outletRes.json().catch(() => null);
    const outletRows = (outletBody?.outlets ?? []) as OutletRow[];
    setOutlets(outletRows);
    setOutletId((prev) => {
      const next = prev || outletRows[0]?.id || "";
      const row = outletRows.find((item) => item.id === next) ?? outletRows[0];
      if (row) {
        setOutletCode(row.revenueCode ?? "");
        setOutletPhone(row.phone ?? "");
        setOutletEmail(row.email ?? "");
        setOutletAddress(row.address ?? "");
        setOutletWebsite(row.website ?? "");
      }
      return next;
    });
    const categoryBody = await categoryRes.json().catch(() => null);
    setCategories((categoryBody?.categories ?? []) as CategoryRow[]);
    const productBody = await productRes.json().catch(() => null);
    setProducts((productBody?.products ?? []) as ProductRow[]);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectOutlet(id: string, rows: OutletRow[] = outlets) {
    const row = rows.find((item) => item.id === id);
    setOutletId(id);
    setOutletCode(row?.revenueCode ?? "");
    setOutletPhone(row?.phone ?? "");
    setOutletEmail(row?.email ?? "");
    setOutletAddress(row?.address ?? "");
    setOutletWebsite(row?.website ?? "");
  }

  async function saveOutlet() {
    const res = await fetch(`/api/admin/outlets/${outletId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        revenueCode: outletCode.trim() || null,
        phone: outletPhone.trim() || null,
        email: outletEmail.trim() || null,
        address: outletAddress.trim() || null,
        website: outletWebsite.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    showSuccess(t("saved"));
    await load();
  }

  async function saveCategory() {
    const res = await fetch("/api/admin/product-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: categoryCode.trim(),
        name: categoryName.trim(),
        revenueCode: categoryRevenue.trim() || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setCategoryCode("");
    setCategoryName("");
    setCategoryRevenue("");
    showSuccess(t("saved"));
    await load();
  }

  async function saveCategoryRow(row: CategoryRow, revenueCode: string) {
    const res = await fetch(`/api/admin/product-categories/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revenueCode: revenueCode.trim() || null }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    showSuccess(t("saved"));
    await load();
  }

  async function saveProduct() {
    if (!productId) return;
    const res = await fetch(`/api/admin/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: productCategoryId || null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    showSuccess(t("saved"));
    await load();
  }

  const selectedProduct = products.find((row) => row.id === productId);

  return (
    <div className="space-y-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {notice ? <p className="text-sm text-[#B7950B]">{notice}</p> : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("outletTitle")}</h2>
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("outlet")}
          options={outlets.map((row) => ({ value: row.id, label: `${row.code} — ${row.name}` }))}
          value={outletId}
          onChange={(next) => selectOutlet(String(next ?? ""))}
        />
        <CatalogField
          kind="SEARCHABLE"
          label={t("revenueCode")}
          options={withCurrent(options, outletCode)}
          value={outletCode}
          onChange={(next) => setOutletCode(String(next ?? ""))}
        />
        <p className="m-0 text-[12px] text-[#7F8C8D]">{t("outletContactsHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CatalogField
            kind="FREE_TEXT"
            label={t("outletPhone")}
            options={[]}
            value={outletPhone}
            onChange={(next) => setOutletPhone(String(next ?? ""))}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("outletEmail")}
            options={[]}
            value={outletEmail}
            onChange={(next) => setOutletEmail(String(next ?? ""))}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("outletAddress")}
            options={[]}
            value={outletAddress}
            onChange={(next) => setOutletAddress(String(next ?? ""))}
          />
          <CatalogField
            kind="FREE_TEXT"
            label={t("outletWebsite")}
            options={[]}
            value={outletWebsite}
            onChange={(next) => setOutletWebsite(String(next ?? ""))}
          />
        </div>
        <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!outletId} onClick={() => void saveOutlet()}>
          {t("save")}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("categoryTitle")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("code")} preset="code" value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} />
          <Field label={t("name")} preset="shortText" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
        </div>
        <CatalogField
          kind="SEARCHABLE"
          label={t("revenueCode")}
          options={withCurrent(options, categoryRevenue)}
          value={categoryRevenue}
          onChange={(next) => setCategoryRevenue(String(next ?? ""))}
        />
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={!categoryCode.trim() || !categoryName.trim()}
          onClick={() => void saveCategory()}
        >
          {t("addCategory")}
        </button>
        <ul className="space-y-2">
          {categories.map((row) => (
            <li key={row.id} className="flex flex-wrap items-end gap-3">
              <span className="min-w-40 text-sm">{row.code} — {row.name}</span>
              <div className="min-w-64 flex-1">
                <CatalogField
                  kind="SEARCHABLE"
                  label={t("revenueCode")}
                  options={withCurrent(options, row.revenueCode ?? "")}
                  value={row.revenueCode ?? ""}
                  onChange={(next) => void saveCategoryRow(row, String(next ?? ""))}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t("productTitle")}</h2>
        <CatalogField
          kind="SEARCHABLE"
          label={t("product")}
          options={products.map((row) => ({ value: row.id, label: `${row.sku} — ${row.description}` }))}
          value={productId}
          onChange={(next) => {
            const id = String(next ?? "");
            const row = products.find((item) => item.id === id);
            setProductId(id);
            setProductCategoryId(row?.categoryId ?? "");
          }}
        />
        {selectedProduct ? (
          <>
            <CatalogField
              kind="SEARCHABLE"
              label={t("category")}
              options={[
                { value: "", label: t("noCategory") },
                ...categories.map((row) => ({ value: row.id, label: `${row.code} — ${row.name}` })),
              ]}
              value={productCategoryId}
              onChange={(next) => setProductCategoryId(String(next ?? ""))}
            />
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void saveProduct()}>
              {t("save")}
            </button>
          </>
        ) : null}
      </section>
    </div>
  );
}
