"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../../lib/cp-admin-fetch";
import { useListPagination } from "../../../../../lib/use-list-pagination";
import { useBilling } from "../../billing-context";

type PricingModule = {
  id: string;
  key: string;
  name: string;
  pricePerMonth: number;
  sortOrder: number;
  isPremium: boolean;
  satelliteKey?: string | null;
  catalogKind?: string | null;
};

type CommercialClass = "premium" | "standard" | "free";

function commercialClassOf(m: PricingModule): CommercialClass {
  if (m.isPremium) return "premium";
  if (m.pricePerMonth <= 0) return "free";
  return "standard";
}

type EditForm = {
  name: string;
  pricePerMonth: string;
  sortOrder: string;
  commercialClass: CommercialClass;
};

export default function SuperAdminBillingAddonsPage() {
  const t = useTranslations("superAdmin.billing");
  const tCommon = useTranslations("common");
  const { billing, loading, error, reload } = useBilling();
  const [saving, setSaving] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterClass, setFilterClass] = useState<"all" | CommercialClass>("all");
  const [editing, setEditing] = useState<PricingModule | null>(null);
  const [form, setForm] = useState<EditForm>({
    name: "",
    pricePerMonth: "",
    sortOrder: "",
    commercialClass: "standard",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const modules = useMemo(() => {
    return ((billing?.pricingModules ?? []) as PricingModule[])
      .filter((m) => m.catalogKind === "ADDON")
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [billing?.pricingModules]);

  const filtered = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    return modules
      .filter((m) => (filterClass === "all" ? true : commercialClassOf(m) === filterClass))
      .filter((m) =>
        !q
          ? true
          : m.name.toLowerCase().includes(q) || m.key.toLowerCase().includes(q),
      );
  }, [modules, filterClass, filterName]);

  const { page, pageSize, setPage, setPageSize, paged, total } = useListPagination(
    filtered,
    `${filterClass}:${filterName}`,
  );

  function openEdit(m: PricingModule) {
    setEditing(m);
    setFormError(null);
    setForm({
      name: m.name,
      pricePerMonth: String(m.pricePerMonth),
      sortOrder: String(m.sortOrder),
      commercialClass: commercialClassOf(m),
    });
  }

  async function saveModule(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    let price = Number.parseFloat(form.pricePerMonth);
    const sort = Number.parseInt(form.sortOrder, 10);
    if (!form.name.trim()) {
      setFormError(t("errName"));
      return;
    }
    if (form.commercialClass === "free") price = 0;
    if (!Number.isFinite(price) || price < 0) {
      setFormError(t("errPrice"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await cpAdminFetch(`pricing-modules/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          pricePerMonth: price,
          isPremium: form.commercialClass === "premium",
          ...(Number.isFinite(sort) ? { sortOrder: sort } : {}),
        }),
      });
      if (!res.ok) {
        setFormError(`HTTP ${res.status}`);
        return;
      }
      setEditing(null);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  function classBadge(cls: CommercialClass) {
    if (cls === "premium") {
      return (
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
          {t("classPremium")}
        </span>
      );
    }
    if (cls === "free") {
      return (
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          {t("classFree")}
        </span>
      );
    }
    return (
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
        {t("classStandard")}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#34495E]">{t("addonsTitle")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("addonsSubtitle")}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-3 p-4`}>
        <label className="text-sm">
          {t("filterName")}
          <input
            className="mt-1 block h-9 w-56 rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder={t("filterNamePlaceholder")}
          />
        </label>
        <label className="text-sm">
          {t("filterClass")}
          <select
            className="mt-1 block h-9 min-w-[10rem] rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value as "all" | CommercialClass)}
          >
            <option value="all">{t("filterAll")}</option>
            <option value="premium">{t("classPremium")}</option>
            <option value="standard">{t("classStandard")}</option>
            <option value="free">{t("classFree")}</option>
          </select>
        </label>
      </div>

      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colModule")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colKey")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colClass")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colPrice")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((m) => (
              <tr key={m.id} className={DATA_TABLE_TR_CLASS}>
                <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{m.name}</td>
                <td className={`${DATA_TABLE_TD_CLASS} font-mono text-xs`}>{m.key}</td>
                <td className={DATA_TABLE_TD_CLASS}>{classBadge(commercialClassOf(m))}</td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right tabular-nums`}>
                  {t("priceValue", { price: m.pricePerMonth })}
                </td>
                <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                  <button
                    type="button"
                    className={TABLE_ROW_ICON_BTN_CLASS}
                    title={t("edit")}
                    aria-label={t("edit")}
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading ? (
              <tr className={DATA_TABLE_TR_CLASS}>
                <td
                  colSpan={5}
                  className={`${DATA_TABLE_TD_CLASS} text-center text-sm text-[#95A5A6]`}
                >
                  {t("emptyFiltered")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <ListPaginationFooter
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          labels={{
            rowsPerPage: tCommon("paginationRowsPerPage"),
            pageOf: tCommon("paginationPageOf"),
            prev: tCommon("paginationPrev"),
            next: tCommon("paginationNext"),
          }}
        />
      </div>

      <ModalShell
        open={editing != null}
        title={t("editTitle", { name: editing?.name ?? "" })}
        subtitle={editing?.key}
        onClose={() => setEditing(null)}
        closeLabel={tCommon("close")}
      >
        <form onSubmit={(e) => void saveModule(e)} className="grid gap-3">
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldName")}
            <input
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
              autoFocus
            />
          </label>
          <label className="block text-[13px] font-medium text-[#34495E]">
            {t("fieldClass")}
            <select
              className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
              value={form.commercialClass}
              onChange={(e) => {
                const commercialClass = e.target.value as CommercialClass;
                setForm((p) => ({
                  ...p,
                  commercialClass,
                  pricePerMonth:
                    commercialClass === "free" ? "0" : p.pricePerMonth,
                }));
              }}
            >
              <option value="premium">{t("classPremium")}</option>
              <option value="standard">{t("classStandard")}</option>
              <option value="free">{t("classFree")}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldPrice")}
              <input
                type="number"
                min={0}
                step="0.01"
                disabled={form.commercialClass === "free"}
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px] disabled:bg-[#F8F9FA]"
                value={form.pricePerMonth}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pricePerMonth: e.target.value }))
                }
                required
              />
            </label>
            <label className="block text-[13px] font-medium text-[#34495E]">
              {t("fieldSort")}
              <input
                type="number"
                min={0}
                step="1"
                className="mt-1 block w-full rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                value={form.sortOrder}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
              />
            </label>
          </div>
          {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              onClick={() => setEditing(null)}
            >
              {tCommon("cancel")}
            </button>
            <button type="submit" className={PRIMARY_BUTTON_CLASS} disabled={saving}>
              {saving ? tCommon("loading") : tCommon("save")}
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
