"use client";

import {
  ChevronDown,
  ChevronUp,
  Download,
  History,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  CatalogFieldKind,
  DATA_TABLE_CLASS,
  Field,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import { bakuDateDisplay } from "@era/satellite-kit/time";
import { CARD_CLASS, INPUT_CLASS } from "@/lib/design-system";

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
  const [catModal, setCatModal] = useState<"create" | "edit" | null>(null);
  const [catDraft, setCatDraft] = useState({ id: "", name: "", sortOrder: "0" });
  const [itemModal, setItemModal] = useState<"create" | "edit" | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyTitle, setHistoryTitle] = useState("");
  const [priceHistory, setPriceHistory] = useState<PriceRow[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<{ value: string; label: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const recipesHref = financeRecipesUrl();

  const load = useCallback(async () => {
    const res = await fetch("/api/menu?includeInactive=true");
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      setCategories([]);
      return;
    }
    setCategories(Array.isArray(data) ? data : []);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedCategoryId((prev) =>
      prev && categories.some((c) => c.id === prev) ? prev : (categories[0]?.id ?? ""),
    );
  }, [categories]);

  async function moveCategory(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= categories.length) return;
    const reordered = [...categories];
    const [row] = reordered.splice(index, 1);
    if (!row) return;
    reordered.splice(next, 0, row);
    const results = await Promise.all(
      reordered.map((cat, i) =>
        fetch(`/api/menu/categories/${cat.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: (i + 1) * 10 }),
        }),
      ),
    );
    const failed = results.find((res) => !res.ok);
    if (failed) {
      showApiError(await failed.json().catch(() => ({})), t("saveFailed"));
    }
    await load();
  }

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
    const name = catDraft.name.trim();
    if (!name) {
      showApiError({ error: t("saveFailed") }, t("saveFailed"));
      return;
    }
    const res =
      catModal === "create"
        ? await fetch("/api/menu/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          })
        : await fetch(`/api/menu/categories/${catDraft.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setCatModal(null);
    showSuccess(t("saved"));
    await load();
  }

  async function deleteCategory(id: string) {
    if (!confirm(t("confirmDeleteCategory"))) return;
    const res = await fetch(`/api/menu/categories/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    await load();
  }

  function openCreateItem(categoryId: string) {
    setEditingItemId(null);
    setShowDetails(false);
    setItemForm(emptyItemForm(categoryId || categories[0]?.id || ""));
    setItemModal("create");
  }

  function openEditItem(item: MenuItem, categoryId: string) {
    setEditingItemId(item.id);
    setShowDetails(false);
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

  function nextPlu(categoryId: string): string {
    const used = new Set(
      (categories.find((c) => c.id === categoryId)?.items ?? []).map((item) => item.plu),
    );
    let n = 1;
    while (used.has(String(n))) n += 1;
    return String(n);
  }

  async function saveItem() {
    const name = itemForm.name.trim();
    const price = Number(itemForm.priceAzn);
    if (!name || itemForm.priceAzn.trim() === "" || Number.isNaN(price)) {
      showApiError({ error: t("saveFailed") }, t("saveFailed"));
      return;
    }
    const typedPlu = itemForm.plu.trim();
    const payload = {
      categoryId: itemForm.categoryId,
      name,
      priceAzn: price,
      recipeSku: itemForm.recipeSku.trim() || null,
      imageUrl: itemForm.imageUrl.trim() || null,
      active: itemForm.active,
      ...(itemModal === "create"
        ? { plu: typedPlu || nextPlu(itemForm.categoryId) }
        : typedPlu
          ? { plu: typedPlu }
          : {}),
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setItemModal(null);
    showSuccess(t("saved"));
    await load();
  }

  async function openPriceHistory(item: MenuItem) {
    const res = await fetch(`/api/menu/${item.id}/prices`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showApiError(data, t("saveFailed"));
      return;
    }
    setHistoryTitle(`${item.plu} — ${item.name}`);
    setPriceHistory(Array.isArray(data.prices) ? data.prices : []);
    setHistoryOpen(true);
  }

  const needle = query.trim().toLowerCase();
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const visibleItems = categories.flatMap((cat) => {
    if (!needle && cat.id !== selectedCategoryId) return [];
    return cat.items
      .filter((item) => {
        if (!showInactive && !item.active) return false;
        if (!needle) return true;
        return (
          item.name.toLowerCase().includes(needle) ||
          item.plu.toLowerCase().includes(needle)
        );
      })
      .map((item) => ({ ...item, categoryName: cat.name, categoryId: item.categoryId ?? cat.id }));
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {recipesHref ? (
              <a href={recipesHref} target="_blank" rel="noreferrer" className={SECONDARY_BUTTON_CLASS}>
                {t("recipesInFinance")}
              </a>
            ) : null}
            <a href="/api/menu/export" className={SECONDARY_BUTTON_CLASS}>
              <Download className="mr-1 inline h-4 w-4" />
              {t("exportExcel")}
            </a>
          </div>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
          className={`${INPUT_CLASS} min-w-[14rem] flex-1`}
        />
        <label className="flex items-center gap-2 text-sm text-[#34495E]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t("showInactive")}
        </label>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className={`${CARD_CLASS} p-2`}>
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {t("category")}
            </p>
            <button
              type="button"
              aria-label={t("addCategory")}
              title={t("addCategory")}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-[#34495E] hover:bg-[#EBEDF0]"
              onClick={openCreateCategory}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {categories.length === 0 && (
            <p className="px-2 py-3 text-sm text-[#7F8C8D]">{t("emptyCategories")}</p>
          )}
          <ul className="space-y-1">
            {categories.map((cat, index) => {
              const selected = cat.id === selectedCategoryId;
              return (
                <li key={cat.id} className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setSelectedCategoryId(cat.id);
                    }}
                    className={`min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-sm ${
                      selected ? "bg-[#2980B9] text-white" : "text-[#34495E] hover:bg-[#EBEDF0]"
                    }`}
                  >
                    {cat.name}
                  </button>
                  <button
                    type="button"
                    aria-label={t("moveUp")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[#7F8C8D] hover:bg-[#EBEDF0] disabled:opacity-30"
                    disabled={index === 0}
                    onClick={() => void moveCategory(index, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("moveDown")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[#7F8C8D] hover:bg-[#EBEDF0] disabled:opacity-30"
                    disabled={index === categories.length - 1}
                    onClick={() => void moveCategory(index, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("edit")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[#34495E] hover:bg-[#EBEDF0]"
                    onClick={() => openEditCategory(cat)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t("delete")}
                    className="inline-flex h-7 w-7 items-center justify-center rounded text-[#C0392B] hover:bg-[#EBEDF0]"
                    onClick={() => void deleteCategory(cat.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className={`${CARD_CONTAINER_CLASS} overflow-x-auto`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#34495E]">
              {needle ? t("searchResults") : (selectedCategory?.name ?? t("category"))}
            </h2>
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={!selectedCategoryId}
              onClick={() => openCreateItem(selectedCategoryId)}
            >
              <Plus className="mr-1 inline h-4 w-4" />
              {t("addItem")}
            </button>
          </div>
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className="border-b border-[#D5DADF] text-left text-[#7F8C8D]">
                <th className="py-2 pr-2">{t("name")}</th>
                {needle ? <th className="py-2 pr-2">{t("category")}</th> : null}
                <th className="py-2 pr-2">{t("price")}</th>
                <th className="py-2 text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="border-b border-[#EEF1F3]">
                  <td className={`py-2 pr-2 font-medium ${item.active ? "" : "text-[#7F8C8D]"}`}>
                    {item.name}
                    {!item.active ? (
                      <span className="ml-2 text-xs font-normal">{t("inactive")}</span>
                    ) : null}
                  </td>
                  {needle ? (
                    <td className="py-2 pr-2 text-[#7F8C8D]">{item.categoryName}</td>
                  ) : null}
                  <td className="py-2 pr-2">{Number(item.priceAzn).toFixed(2)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      aria-label={t("edit")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-[#34495E] hover:bg-[#EBEDF0]"
                      onClick={() => openEditItem(item, item.categoryId)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("priceHistory")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded text-[#34495E] hover:bg-[#EBEDF0]"
                      onClick={() => void openPriceHistory(item)}
                    >
                      <History className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={needle ? 4 : 3} className="py-3 text-[#7F8C8D]">
                    {t("noItems")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalShell
        open={catModal != null}
        title={catModal === "create" ? t("addCategory") : t("editCategory")}
        onClose={() => setCatModal(null)}
      >
        <Field
          label={t("categoryName")}
          preset="shortText"
          value={catDraft.name}
          onChange={(e) => setCatDraft((d) => ({ ...d, name: e.target.value }))}
        />
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
          <CatalogField
            kind={"SEARCHABLE" as CatalogFieldKind}
            label={t("name")}
            value={itemForm.name}
            options={nameSuggestions}
            serverSearch
            onQueryChange={(q) => {
              setItemForm((f) => ({ ...f, name: q }));
              void fetch(`/api/menu/suggest?q=${encodeURIComponent(q)}`)
                .then((r) => r.json())
                .then((d) => {
                  const list = Array.isArray(d.suggestions) ? d.suggestions : [];
                  setNameSuggestions(
                    list.map((s: { name: string }) => ({ value: s.name, label: s.name })),
                  );
                })
                .catch(() => setNameSuggestions([]));
            }}
            onChange={(next) =>
              setItemForm((f) => ({ ...f, name: Array.isArray(next) ? next[0] ?? "" : next }))
            }
          />
          <Field
            label={t("price")}
            preset="amount"
            value={itemForm.priceAzn}
            onChange={(e) =>
              setItemForm((f) => ({ ...f, priceAzn: e.target.value }))
            }
          />
          <CatalogField
            kind="CLOSED_SMALL"
            label={t("category")}
            value={itemForm.categoryId}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(next) =>
              setItemForm((f) => ({
                ...f,
                categoryId: Array.isArray(next) ? next[0] ?? "" : next,
              }))
            }
          />
          <button
            type="button"
            className="text-sm text-[#2980B9]"
            onClick={() => setShowDetails((v) => !v)}
          >
            {t("details")}
          </button>
          {showDetails && (
            <>
              <Field
                label={t("plu")}
                preset="code"
                value={itemForm.plu}
                onChange={(e) => setItemForm((f) => ({ ...f, plu: e.target.value }))}
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
            </>
          )}
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
                  {bakuDateDisplay(p.effectiveFrom)}
                </td>
                <td className="py-1">
                  {p.effectiveTo
                    ? bakuDateDisplay(p.effectiveTo)
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
