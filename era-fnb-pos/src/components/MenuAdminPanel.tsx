"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Field,
  FieldRow,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { CARD_CLASS } from "@/lib/design-system";

type MenuItem = {
  id: string;
  plu: string;
  name: string;
  priceAzn: string | number;
  active: boolean;
  recipeSku?: string | null;
  imageUrl?: string | null;
  categoryId?: string;
};

type Category = {
  id: string;
  name: string;
  sortOrder?: number;
  items: MenuItem[];
};

type PriceRow = {
  id: string;
  priceAzn: string | number;
  effectiveFrom: string;
  effectiveTo: string | null;
  reason: string | null;
};

type ItemForm = {
  categoryId: string;
  plu: string;
  name: string;
  priceAzn: string;
  recipeSku: string;
  imageUrl: string;
  active: boolean;
  priceReason: string;
};

const emptyItemForm = (categoryId = ""): ItemForm => ({
  categoryId,
  plu: "",
  name: "",
  priceAzn: "",
  recipeSku: "",
  imageUrl: "",
  active: true,
  priceReason: "",
});

function financeRecipesUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/manufacturing/recipes`;
}

export default function MenuAdminPanel() {
  const t = useTranslations("admin.menu");
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [catModal, setCatModal] = useState<"create" | "edit" | null>(null);
  const [catDraft, setCatDraft] = useState({ id: "", name: "", sortOrder: "0" });
  const [itemModal, setItemModal] = useState<"create" | "edit" | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceRow[]>([]);

  const recipesHref = financeRecipesUrl();

  const load = useCallback(async () => {
    const res = await fetch("/api/menu?includeInactive=true");
    const data = await res.json();
    setCategories(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateCategory() {
    setCatDraft({ id: "", name: "", sortOrder: String((categories.length + 1) * 10) });
    setCatModal("create");
  }

  function openEditCategory(cat: Category) {
    setCatDraft({
      id: cat.id,
      name: cat.name,
      sortOrder: String(cat.sortOrder ?? 0),
    });
    setCatModal("edit");
  }

  async function saveCategory() {
    setMessage("");
    if (catModal === "create") {
      const res = await fetch("/api/menu/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catDraft.name.trim(),
          sortOrder: Number(catDraft.sortOrder) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("saveFailed"));
        return;
      }
    } else if (catModal === "edit") {
      const res = await fetch(`/api/menu/categories/${catDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catDraft.name.trim(),
          sortOrder: Number(catDraft.sortOrder) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? t("saveFailed"));
        return;
      }
    }
    setCatModal(null);
    await load();
  }

  async function deleteCategory(id: string) {
    setMessage("");
    if (!confirm(t("confirmDeleteCategory"))) return;
    const res = await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("saveFailed"));
      return;
    }
    await load();
  }

  function openCreateItem(categoryId: string) {
    setEditingItemId(null);
    setItemForm(emptyItemForm(categoryId || categories[0]?.id || ""));
    setItemModal("create");
  }

  function openEditItem(item: MenuItem, categoryId: string) {
    setEditingItemId(item.id);
    setItemForm({
      categoryId: item.categoryId ?? categoryId,
      plu: item.plu,
      name: item.name,
      priceAzn: String(item.priceAzn),
      recipeSku: item.recipeSku ?? "",
      imageUrl: item.imageUrl ?? "",
      active: item.active,
      priceReason: "",
    });
    setItemModal("edit");
  }

  async function saveItem() {
    setMessage("");
    const payload = {
      categoryId: itemForm.categoryId,
      plu: itemForm.plu.trim(),
      name: itemForm.name.trim(),
      priceAzn: Number(itemForm.priceAzn),
      recipeSku: itemForm.recipeSku.trim() || null,
      imageUrl: itemForm.imageUrl.trim() || null,
      active: itemForm.active,
      ...(itemForm.priceReason.trim()
        ? { priceReason: itemForm.priceReason.trim() }
        : {}),
    };

    const res =
      itemModal === "create"
        ? await fetch("/api/menu", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/menu/${editingItemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("saveFailed"));
      return;
    }
    setItemModal(null);
    setMessage(t("saved"));
    await load();
  }

  async function deactivateItem(id: string) {
    setMessage("");
    const res = await fetch(`/api/menu/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("saveFailed"));
      return;
    }
    await load();
  }

  async function openPriceHistory(item: MenuItem) {
    setMessage("");
    const res = await fetch(`/api/menu/${item.id}/prices`);
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? t("saveFailed"));
      return;
    }
    setHistoryTitle(`${item.plu} — ${item.name}`);
    setPriceHistory(Array.isArray(data.prices) ? data.prices : []);
    setHistoryOpen(true);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <p className="text-sm text-[#7F8C8D]">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-2">
          {recipesHref && (
            <a
              href={recipesHref}
              target="_blank"
              rel="noreferrer"
              className={SECONDARY_BUTTON_CLASS}
            >
              {t("recipesInFinance")}
            </a>
          )}
          <Link href="/admin/tables" className={SECONDARY_BUTTON_CLASS}>
            {t("manageTables")}
          </Link>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreateCategory}>
            {t("addCategory")}
          </button>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            onClick={() => openCreateItem(categories[0]?.id ?? "")}
            disabled={categories.length === 0}
          >
            {t("addItem")}
          </button>
        </div>
      </div>

      {message && <p className="mb-3 text-sm text-[#2C3E50]">{message}</p>}

      {categories.length === 0 && (
        <p className="text-sm text-[#7F8C8D]">{t("emptyCategories")}</p>
      )}

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.id} className={`${CARD_CLASS} p-4`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {cat.name}{" "}
                <span className="text-xs font-normal text-[#7F8C8D]">
                  #{cat.sortOrder ?? 0}
                </span>
              </h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => openEditCategory(cat)}
                >
                  {t("edit")}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => openCreateItem(cat.id)}
                >
                  {t("addItem")}
                </button>
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void deleteCategory(cat.id)}
                >
                  {t("delete")}
                </button>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
                  <th className="py-1 pr-2">{t("plu")}</th>
                  <th className="py-1 pr-2">{t("name")}</th>
                  <th className="py-1 pr-2">{t("price")}</th>
                  <th className="py-1 pr-2">{t("recipeSku")}</th>
                  <th className="py-1 pr-2">{t("status")}</th>
                  <th className="py-1 text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item) => (
                  <tr key={item.id} className="border-b border-[#EEF1F3]">
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : null}
                        {item.plu}
                      </div>
                    </td>
                    <td className="py-2 pr-2">{item.name}</td>
                    <td className="py-2 pr-2">{Number(item.priceAzn).toFixed(2)}</td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {item.recipeSku || "—"}
                    </td>
                    <td className="py-2 pr-2">
                      {item.active ? t("active") : t("inactive")}
                    </td>
                    <td className="py-2 text-right space-x-2">
                      <button
                        type="button"
                        className="text-[#2980B9] underline"
                        onClick={() => openEditItem(item, cat.id)}
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        className="text-[#2980B9] underline"
                        onClick={() => void openPriceHistory(item)}
                      >
                        {t("priceHistory")}
                      </button>
                      {item.active && (
                        <button
                          type="button"
                          className="text-[#C0392B] underline"
                          onClick={() => void deactivateItem(item.id)}
                        >
                          {t("deactivate")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {cat.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-2 text-[#7F8C8D]">
                      {t("noItems")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <ModalShell
        open={catModal != null}
        title={catModal === "create" ? t("addCategory") : t("editCategory")}
        onClose={() => setCatModal(null)}
      >
        <FieldRow cols={2}>
          <Field
            label={t("categoryName")}
            preset="shortText"
            value={catDraft.name}
            onChange={(e) => setCatDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <Field
            label={t("sortOrder")}
            preset="shortText"
            value={catDraft.sortOrder}
            onChange={(e) =>
              setCatDraft((d) => ({ ...d, sortOrder: e.target.value }))
            }
          />
        </FieldRow>
        <ModalFooter
          onCancel={() => setCatModal(null)}
          onSubmit={() => void saveCategory()}
          submitLabel={t("save")}
        />
      </ModalShell>

      <ModalShell
        open={itemModal != null}
        title={itemModal === "create" ? t("addItem") : t("editItem")}
        onClose={() => setItemModal(null)}
      >
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-[#7F8C8D]">{t("category")}</span>
            <select
              className="w-full rounded border border-[#D5DADF] px-2 py-1.5"
              value={itemForm.categoryId}
              onChange={(e) =>
                setItemForm((f) => ({ ...f, categoryId: e.target.value }))
              }
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <FieldRow cols={2}>
            <Field
              label={t("plu")}
              preset="code"
              value={itemForm.plu}
              onChange={(e) => setItemForm((f) => ({ ...f, plu: e.target.value }))}
            />
            <Field
              label={t("price")}
              preset="amount"
              value={itemForm.priceAzn}
              onChange={(e) =>
                setItemForm((f) => ({ ...f, priceAzn: e.target.value }))
              }
            />
          </FieldRow>
          <Field
            label={t("name")}
            preset="shortText"
            value={itemForm.name}
            onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Field
            label={t("recipeSku")}
            preset="code"
            value={itemForm.recipeSku}
            onChange={(e) =>
              setItemForm((f) => ({ ...f, recipeSku: e.target.value }))
            }
          />
          <p className="text-xs text-[#7F8C8D]">{t("recipeSkuHint")}</p>
          <Field
            label={t("imageUrl")}
            preset="shortText"
            value={itemForm.imageUrl}
            onChange={(e) =>
              setItemForm((f) => ({ ...f, imageUrl: e.target.value }))
            }
          />
          {itemModal === "edit" && (
            <Field
              label={t("priceReason")}
              preset="shortText"
              value={itemForm.priceReason}
              onChange={(e) =>
                setItemForm((f) => ({ ...f, priceReason: e.target.value }))
              }
            />
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemForm.active}
              onChange={(e) =>
                setItemForm((f) => ({ ...f, active: e.target.checked }))
              }
            />
            {t("active")}
          </label>
        </div>
        <ModalFooter
          onCancel={() => setItemModal(null)}
          onSubmit={() => void saveItem()}
          submitLabel={t("save")}
        />
      </ModalShell>

      <ModalShell
        open={historyOpen}
        title={`${t("priceHistory")}: ${historyTitle}`}
        onClose={() => setHistoryOpen(false)}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
              <th className="py-1">{t("price")}</th>
              <th className="py-1">{t("effectiveFrom")}</th>
              <th className="py-1">{t("effectiveTo")}</th>
              <th className="py-1">{t("priceReason")}</th>
            </tr>
          </thead>
          <tbody>
            {priceHistory.map((p) => (
              <tr key={p.id} className="border-b border-[#EEF1F3]">
                <td className="py-1">{Number(p.priceAzn).toFixed(2)}</td>
                <td className="py-1">
                  {new Date(p.effectiveFrom).toLocaleString()}
                </td>
                <td className="py-1">
                  {p.effectiveTo
                    ? new Date(p.effectiveTo).toLocaleString()
                    : t("current")}
                </td>
                <td className="py-1">{p.reason || "—"}</td>
              </tr>
            ))}
            {priceHistory.length === 0 && (
              <tr>
                <td colSpan={4} className="py-2 text-[#7F8C8D]">
                  {t("noPriceHistory")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <ModalFooter
          onCancel={() => setHistoryOpen(false)}
          onSubmit={() => setHistoryOpen(false)}
          cancelLabel={t("close")}
          submitLabel={t("close")}
        />
      </ModalShell>
    </>
  );
}
