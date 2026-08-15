"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Pencil } from "lucide-react";
import {
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  ListPaginationFooter,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { useListPagination } from "../../../../lib/use-list-pagination";
import { useBilling } from "../billing-context";

type BundleForm = {
  name: string;
  discount: string;
  moduleKeys: Set<string>;
  isTrialDefault: boolean;
  trialDurationDays: string;
};

const emptyForm = (): BundleForm => ({
  name: "",
  discount: "10",
  moduleKeys: new Set(),
  isTrialDefault: false,
  trialDurationDays: "",
});

export default function SuperAdminBillingPackagesPage() {
  const t = useTranslations("superAdmin.billingPackages");
  const tCommon = useTranslations("common");
  const { billing, loading, error, reload } = useBilling();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BundleForm>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const catalogModules = useMemo(
    () =>
      (billing?.pricingModules ?? [])
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [billing?.pricingModules],
  );

  const bundles = useMemo(() => {
    const all = billing?.pricingBundles ?? [];
    return showArchived ? all : all.filter((b) => !b.archivedAt);
  }, [billing?.pricingBundles, showArchived]);

  const { page, pageSize, setPage, setPageSize, paged, total } = useListPagination(
    bundles,
    showArchived ? "archived" : "active",
  );

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(id: string) {
    const b = billing?.pricingBundles.find((x) => x.id === id);
    if (!b) return;
    setEditingId(id);
    setForm({
      name: b.name,
      discount: String(b.discountPercent),
      moduleKeys: new Set(b.moduleKeys),
      isTrialDefault: Boolean(b.isTrialDefault),
      trialDurationDays:
        b.trialDurationDays != null ? String(b.trialDurationDays) : "",
    });
    setOpen(true);
  }

  function toggleModule(key: string) {
    setForm((prev) => {
      const next = new Set(prev.moduleKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return { ...prev, moduleKeys: next };
    });
  }

  async function submit() {
    setBusy(true);
    try {
      const trialDurationDays = form.trialDurationDays.trim()
        ? Number.parseInt(form.trialDurationDays, 10)
        : null;
      const body = {
        name: form.name.trim() || "New bundle",
        discountPercent: Number.parseFloat(form.discount) || 0,
        moduleKeys: [...form.moduleKeys],
        trial: {
          isTrialDefault: form.isTrialDefault,
          ...(trialDurationDays != null && Number.isFinite(trialDurationDays)
            ? { trialDurationDays }
            : {}),
        },
      };
      if (editingId) {
        await cpAdminFetch(`pricing-bundles/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await cpAdminFetch("pricing-bundles", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function archiveBundle(id: string) {
    if (!confirm(t("archiveConfirm"))) return;
    await cpAdminFetch(`pricing-bundles/${id}/archive`, { method: "PATCH" });
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
          <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[#475569]">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            {t("showArchived")}
          </label>
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
            {t("newBundle")}
          </button>
        </div>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}
      <div className={DATA_TABLE_VIEWPORT_CLASS}>
        <table className={DATA_TABLE_CLASS}>
          <thead>
            <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colBundle")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDiscount")}</th>
              <th className={`${DATA_TABLE_TH_LEFT_CLASS} max-w-[20rem]`}>
                {t("colModules")}
              </th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colTrial")}</th>
              <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colStatus")}</th>
              <th className={DATA_TABLE_TH_RIGHT_CLASS}>{t("colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((b) => {
              const keys = b.moduleKeys ?? [];
              const visible = keys.slice(0, 4);
              const more = keys.length - visible.length;
              return (
                <tr key={b.id} className={DATA_TABLE_TR_CLASS}>
                  <td className={`${DATA_TABLE_TD_CLASS} font-medium`}>{b.name}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{b.discountPercent}</td>
                  <td className={`${DATA_TABLE_TD_CLASS} max-w-[20rem]`}>
                    <div className="flex flex-wrap gap-1">
                      {visible.map((k) => (
                        <span
                          key={k}
                          className="rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] text-[#475569]"
                          title={k}
                        >
                          {k}
                        </span>
                      ))}
                      {more > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                          {t("modulesMore", { count: more })}
                        </span>
                      ) : null}
                      {keys.length === 0 ? (
                        <span className="text-[#95A5A6]">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {b.isTrialDefault
                      ? t("trialYes")
                      : b.trialDurationDays != null
                        ? `${b.trialDurationDays}d`
                        : "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {b.archivedAt ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        {t("archived")}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                        {t("active")}
                      </span>
                    )}
                  </td>
                  <td className={`${DATA_TABLE_TD_CLASS} text-right`}>
                    {!b.archivedAt ? (
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("edit")}
                          aria-label={t("edit")}
                          onClick={() => openEdit(b.id)}
                        >
                          <Pencil className="h-4 w-4 text-[#2980B9]" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          title={t("archive")}
                          aria-label={t("archive")}
                          onClick={() => void archiveBundle(b.id)}
                        >
                          <Archive className="h-4 w-4 text-[#C0392B]" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
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
        open={open}
        title={editingId ? t("editModalTitle") : t("modalTitle")}
        onClose={() => setOpen(false)}
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto text-sm">
          <label className="block">
            {t("name")}
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#D5DADF] px-3"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </label>
          <label className="block">
            {t("discount")}
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#D5DADF] px-3"
              value={form.discount}
              onChange={(e) => setForm((p) => ({ ...p, discount: e.target.value }))}
            />
          </label>
          <fieldset className="rounded-lg border border-[#D5DADF] p-3">
            <legend className="px-1 text-xs font-semibold text-[#475569]">
              {t("modules")}
            </legend>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {catalogModules.map((m) => (
                <li key={m.key}>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.moduleKeys.has(m.key)}
                      onChange={() => toggleModule(m.key)}
                    />
                    <span>
                      {m.name}{" "}
                      <span className="text-[#7F8C8D]">({m.key})</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isTrialDefault}
              onChange={(e) =>
                setForm((p) => ({ ...p, isTrialDefault: e.target.checked }))
              }
            />
            {t("isTrialDefault")}
          </label>
          <label className="block">
            {t("trialDurationDays")}
            <input
              className="mt-1 h-9 w-full rounded-lg border border-[#D5DADF] px-3"
              value={form.trialDurationDays}
              onChange={(e) =>
                setForm((p) => ({ ...p, trialDurationDays: e.target.value }))
              }
              placeholder="90"
            />
          </label>
        </div>
        <ModalFooter
          busy={busy}
          onCancel={() => setOpen(false)}
          onSubmit={() => void submit()}
          submitLabel={editingId ? t("save") : t("create")}
        />
      </ModalShell>
    </div>
  );
}
