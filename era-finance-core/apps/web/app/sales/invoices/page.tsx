"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { subscribeListRefresh } from "../../../lib/list-refresh-bus";
import {
  CheckCircle2,
  Eye,
  FileStack,
  MoreHorizontal,
  Send,
  SendHorizontal,
  Wallet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CatalogField,
  EraListFilterBar,
  EraListWorkspace,
  EraSavedViewsBar,
  LIST_PAGE_SHELL_CLASS,
} from "@era/satellite-kit/ui";
import type { SavedListViewConfig } from "@era/satellite-kit";
import { apiFetch } from "../../../lib/api-client";
import {
  DATA_TABLE_ACTIONS_TD_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CENTER_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TD_RIGHT_CLASS,
  DATA_TABLE_TH_CENTER_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TH_RIGHT_CLASS,
  DATA_TABLE_TR_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
} from "../../../lib/design-system";
import { formatInvoiceStatus } from "../../../lib/invoice-status";
import { formatMoneyAzn } from "../../../lib/format-money";
import {
  EMPTY_INVOICE_LIST_FILTERS,
  INVOICE_LIST_COLUMN_IDS,
  INVOICE_LIST_GRID_KEY,
  INVOICE_LIST_SORT_KEYS,
  INVOICE_LIST_STATUSES,
  defaultVisibleColumns,
  type InvoiceListColumnId,
  type InvoiceListFilters,
  type InvoiceListSortKey,
} from "../../../lib/invoice-list-view";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useAuth } from "../../../lib/auth-context";
import { useOrgPermissions } from "../../../lib/use-org-permissions";
import { CP_PERMISSION } from "../../../lib/role-utils";
import { PageHeader } from "../../../components/layout/page-header";
import { ListPaginationFooter } from "../../../components/list-pagination-footer";
import { ExtensionInstallBanner } from "../../../components/extension-install-banner";
import { RpaUpsellModal } from "../../../components/rpa-upsell-modal";
import { EmptyState } from "../../../components/empty-state";
import { CreateInvoiceModal, ViewInvoiceModal } from "../../../components/sales/modals";
import { CreateShipmentModal } from "../../../components/inventory/create-shipment-modal";
import { useSubscription } from "../../../lib/subscription-context";
import { AsyncCombobox } from "../../../components/ui/async-combobox";

type Row = {
  id: string;
  number: string;
  status: string;
  dueDate: string;
  totalAmount: unknown;
  paidTotal?: string;
  remaining?: string;
  counterparty: { name: string };
  revenueRecognized?: boolean;
  inventorySettled?: boolean;
  revenuePostedTransactionId?: string | null;
  hasGoodsLines?: boolean;
  isInternational?: boolean;
  eqaimeNumber?: string | null;
  eqaimeStatus?: string | null;
  eqaimeSubmittedAt?: string | null;
};

function formatEqaimeStatus(
  t: (key: string) => string,
  status: string | null | undefined,
): string {
  if (!status) return t("invoices.eqaimeStatusNone");
  const map: Record<string, string> = {
    DRAFT: t("invoices.eqaimeStatusDraft"),
    SUBMITTED: t("invoices.eqaimeStatusSubmitted"),
    ACCEPTED: t("invoices.eqaimeStatusAccepted"),
    REJECTED: t("invoices.eqaimeStatusRejected"),
    CANCELLED: t("invoices.eqaimeStatusCancelled"),
  };
  return map[status] ?? status;
}

function canCreateShipmentOrder(r: Row): boolean {
  return !!(
    r.revenueRecognized &&
    !r.inventorySettled &&
    r.hasGoodsLines &&
    r.revenuePostedTransactionId
  );
}

type InvoicesListResponse = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
};

export default function InvoicesPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const perms = useOrgPermissions();
  const canShareViews = perms.can(CP_PERMISSION.ADMIN_ORG_SETTINGS);
  const canEditViews =
    perms.can(CP_PERMISSION.ADMIN_ORG_SETTINGS) ||
    perms.can(CP_PERMISSION.API_INVOICES_UPDATE);
  const router = useRouter();
  const search = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<InvoiceListFilters>(EMPTY_INVOICE_LIST_FILTERS);
  const [sortKey, setSortKey] = useState<InvoiceListSortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [visibleColumns, setVisibleColumns] = useState<InvoiceListColumnId[]>(
    defaultVisibleColumns,
  );
  const [savedViews, setSavedViews] = useState<
    Array<{
      id: string;
      userId: string;
      name: string;
      isShared: boolean;
      isDefault: boolean;
      configJson: SavedListViewConfig;
    }>
  >([]);
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null);
  const [viewsBusy, setViewsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [payForId, setPayForId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [invoiceActionBusy, setInvoiceActionBusy] = useState<string | null>(null);
  const [viewInvoiceId, setViewInvoiceId] = useState<string | null>(null);
  const [invoiceActionsMenuId, setInvoiceActionsMenuId] = useState<string | null>(null);
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [shipmentBasisTransactionId, setShipmentBasisTransactionId] = useState<string | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const { effectiveSnapshot } = useSubscription();

  const colVisible = useMemo(() => {
    const set = new Set(visibleColumns);
    return (id: InvoiceListColumnId) => set.has(id);
  }, [visibleColumns]);

  const invoiceFromUrl = search.get("invoice");
  useEffect(() => {
    if (invoiceFromUrl) setViewInvoiceId(invoiceFromUrl);
    else setViewInvoiceId(null);
  }, [invoiceFromUrl]);

  function openInvoiceView(id: string) {
    setViewInvoiceId(id);
    router.replace(`/sales/invoices?invoice=${encodeURIComponent(id)}`, {
      scroll: false,
    });
  }

  function closeInvoiceView() {
    setViewInvoiceId(null);
    const params = new URLSearchParams(search.toString());
    params.delete("invoice");
    const qs = params.toString();
    router.replace(qs ? `/sales/invoices?${qs}` : "/sales/invoices", { scroll: false });
  }

  function applyViewConfig(cfg: SavedListViewConfig) {
    const cols = (cfg.columns ?? []).filter((c): c is InvoiceListColumnId =>
      (INVOICE_LIST_COLUMN_IDS as readonly string[]).includes(c),
    );
    setVisibleColumns(
      cols.length
        ? [...cols, ...(cols.includes("actions") ? [] : (["actions"] as const))]
        : defaultVisibleColumns(),
    );
    const statusRaw =
      typeof cfg.filters?.status === "string" ? cfg.filters.status : "";
    const statusOk = (INVOICE_LIST_STATUSES as readonly string[]).includes(statusRaw)
      ? statusRaw
      : "";
    setFilters({
      status: statusOk,
      counterpartyId:
        typeof cfg.filters?.counterpartyId === "string"
          ? cfg.filters.counterpartyId
          : "",
      dueFrom:
        typeof cfg.filters?.dueFrom === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(cfg.filters.dueFrom)
          ? cfg.filters.dueFrom
          : "",
      dueTo:
        typeof cfg.filters?.dueTo === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(cfg.filters.dueTo)
          ? cfg.filters.dueTo
          : "",
    });
    if (
      cfg.sort?.key &&
      (INVOICE_LIST_SORT_KEYS as readonly string[]).includes(cfg.sort.key)
    ) {
      setSortKey(cfg.sort.key as InvoiceListSortKey);
      setSortDir(cfg.sort.dir === "asc" ? "asc" : "desc");
    } else {
      setSortKey("createdAt");
      setSortDir("desc");
    }
    if (cfg.pageSize === 25 || cfg.pageSize === 50 || cfg.pageSize === 100) {
      setPageSize(cfg.pageSize);
    }
    setPage(1);
  }

  function currentConfig(): SavedListViewConfig {
    const f: Record<string, string> = {};
    if (filters.status) f.status = filters.status;
    if (filters.counterpartyId) f.counterpartyId = filters.counterpartyId;
    if (filters.dueFrom) f.dueFrom = filters.dueFrom;
    if (filters.dueTo) f.dueTo = filters.dueTo;
    return {
      version: 1,
      columns: visibleColumns,
      filters: f,
      sort: { key: sortKey, dir: sortDir },
      pageSize: pageSize === 50 || pageSize === 100 ? pageSize : 25,
    };
  }

  const loadViews = useCallback(async (opts?: { applyDefault?: boolean }) => {
    if (!token) return;
    const res = await apiFetch(
      `/api/saved-list-views?gridKey=${encodeURIComponent(INVOICE_LIST_GRID_KEY)}`,
    );
    if (!res.ok) return;
    const list = (await res.json()) as Array<{
      id: string;
      userId: string;
      name: string;
      isShared: boolean;
      isDefault: boolean;
      configJson: SavedListViewConfig;
    }>;
    setSavedViews(Array.isArray(list) ? list : []);
    if (opts?.applyDefault) {
      const def =
        list.find((v) => v.isDefault && v.userId === user?.id) ??
        list.find((v) => v.isDefault && !v.isShared);
      if (def?.configJson) {
        setSelectedViewId(def.id);
        applyViewConfig(def.configJson);
      }
    }
  }, [token, user?.id]);

  const selectedViewOwned =
    !!selectedViewId &&
    savedViews.some((v) => v.id === selectedViewId && v.userId === user?.id);

  const load = useCallback(async () => {
    if (!token) {
      setRows([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortKey,
      sortDir,
    });
    if (filters.status) qs.set("status", filters.status);
    if (filters.counterpartyId) qs.set("counterpartyId", filters.counterpartyId);
    if (filters.dueFrom) qs.set("dueFrom", filters.dueFrom);
    if (filters.dueTo) qs.set("dueTo", filters.dueTo);
    const res = await apiFetch(`/api/invoices?${qs.toString()}`);
    if (!res.ok) {
      setError(`${t("invoices.loadError")}: ${res.status}`);
      setRows([]);
      setTotal(0);
    } else {
      const body = (await res.json()) as InvoicesListResponse;
      const items = Array.isArray(body.items) ? body.items : [];
      setRows(items);
      setTotal(typeof body.total === "number" ? body.total : items.length);
      setSelectedIds([]);
    }
    setLoading(false);
  }, [token, t, page, pageSize, filters, sortKey, sortDir]);

  useEffect(() => {
    if (ready && token) void loadViews({ applyDefault: true });
  }, [ready, token, loadViews]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    if (!ready || !token) return;
    return subscribeListRefresh("invoices", () => void load());
  }, [load, ready, token]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleSort(key: InvoiceListSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "createdAt" ? "desc" : "asc");
    }
    setPage(1);
  }

  function sortMark(key: InvoiceListSortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  async function fetchCounterparties(q: string) {
    const qs = new URLSearchParams({ search: q, limit: "20" });
    const res = await apiFetch(`/api/counterparties?${qs.toString()}`);
    if (!res.ok) return [];
    const body = (await res.json()) as Array<{
      id: string;
      name?: string;
      global?: { name?: string | null };
    }>;
    if (!Array.isArray(body)) return [];
    return body.map((c) => ({
      id: c.id,
      name: c.name ?? c.global?.name ?? c.id,
    }));
  }

  async function saveView(name: string, opts: { isShared: boolean; isDefault: boolean }) {
    if (!canEditViews) return;
    if (filters.dueFrom && filters.dueTo && filters.dueFrom > filters.dueTo) {
      toast.error(t("savedViews.dueRangeErr"));
      return;
    }
    setViewsBusy(true);
    const res = await apiFetch("/api/saved-list-views", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gridKey: INVOICE_LIST_GRID_KEY,
        name,
        config: currentConfig(),
        isShared: opts.isShared,
        isDefault: opts.isDefault,
      }),
    });
    setViewsBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    const created = (await res.json()) as { id: string };
    toast.success(t("common.save"));
    await loadViews();
    setSelectedViewId(created.id);
  }

  async function updateSelectedView() {
    if (!selectedViewId || !canEditViews || !selectedViewOwned) return;
    if (filters.dueFrom && filters.dueTo && filters.dueFrom > filters.dueTo) {
      toast.error(t("savedViews.dueRangeErr"));
      return;
    }
    setViewsBusy(true);
    const res = await apiFetch(`/api/saved-list-views/${selectedViewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: currentConfig() }),
    });
    setViewsBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    await loadViews();
  }

  async function deleteSelectedView() {
    if (!selectedViewId || !canEditViews || !selectedViewOwned) return;
    setViewsBusy(true);
    const res = await apiFetch(`/api/saved-list-views/${selectedViewId}`, {
      method: "DELETE",
    });
    setViewsBusy(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    setSelectedViewId(null);
    toast.success(t("common.save"));
    await loadViews();
  }

  function onSelectView(id: string | null) {
    setSelectedViewId(id);
    if (!id) {
      setFilters(EMPTY_INVOICE_LIST_FILTERS);
      setVisibleColumns(defaultVisibleColumns());
      setSortKey("createdAt");
      setSortDir("desc");
      setPageSize(25);
      setPage(1);
      return;
    }
    const view = savedViews.find((v) => v.id === id);
    if (view) applyViewConfig(view.configJson);
  }

  useEffect(() => {
    if (!invoiceActionsMenuId) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const wraps = document.querySelectorAll<HTMLElement>(
        `[data-invoice-actions-wrap="${invoiceActionsMenuId}"]`,
      );
      let inside = false;
      wraps.forEach((el) => {
        if (el.contains(t)) inside = true;
      });
      if (!inside) setInvoiceActionsMenuId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [invoiceActionsMenuId]);

  useEffect(() => {
    if (loading) return;
    if (!rows.length) return;
    if (payForId) return;
    if (search?.get("pay") !== "1") return;
    const firstPayable = rows.find((r) => r.status === "SENT" || r.status === "PARTIALLY_PAID");
    if (firstPayable) openPay(firstPayable);
  }, [loading, rows, payForId, search]);

  async function submitEqaime(id: string) {
    const key = `eqaime:${id}`;
    setInvoiceActionBusy(key);
    try {
      const res = await apiFetch(`/api/invoices/${id}/eqaime/submit`, { method: "POST" });
      if (res.status === 503) {
        alert(t("invoices.eqaimeSubmitUnavailable"));
        return;
      }
      if (!res.ok) {
        alert(t("invoices.eqaimeSubmitError"));
        return;
      }
      alert(t("invoices.eqaimeSubmitOk"));
      await load();
    } finally {
      setInvoiceActionBusy((b) => (b === key ? null : b));
    }
  }

  async function patchStatus(id: string, status: "SENT" | "PAID") {
    const key = `${id}:${status}`;
    setInvoiceActionBusy(key);
    try {
      const res = await apiFetch(`/api/invoices/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      setPayForId(null);
      await load();
    } finally {
      setInvoiceActionBusy((b) => (b === key ? null : b));
    }
  }

  async function submitPartialPayment(id: string) {
    const amt = Number(payAmount.replace(",", "."));
    if (!Number.isFinite(amt) || amt <= 0) {
      alert(t("invoices.payAmountInvalid"));
      return;
    }
    setPaySubmitting(true);
    const body: { amount: number; paymentDate?: string } = { amount: amt };
    if (payDate.trim()) body.paymentDate = payDate.trim();
    const res = await apiFetch(`/api/invoices/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPaySubmitting(false);
    if (!res.ok) return;
    setPayForId(null);
    setPayAmount("");
    setPayDate("");
    await load();
  }

  function openPay(row: Row) {
    setPayForId(row.id);
    setPayAmount(row.remaining ?? "");
    setPayDate(new Date().toISOString().slice(0, 10));
  }

  async function sendEmail(id: string) {
    const key = `email:${id}`;
    setInvoiceActionBusy(key);
    try {
      const res = await apiFetch(`/api/invoices/${id}/send-email`, {
        method: "POST",
      });
      if (!res.ok) return;
      alert(t("invoices.emailSent"));
    } finally {
      setInvoiceActionBusy((b) => (b === key ? null : b));
    }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((cur) => {
      if (checked) return Array.from(new Set([...cur, id]));
      return cur.filter((x) => x !== id);
    });
  }

  async function exportBulkExcel() {
    if (selectedIds.length === 0) return;
    const res = await apiFetch(
      `/api/integrations/dvx/invoices/export.xlsx?ids=${encodeURIComponent(selectedIds.join(","))}`,
    );
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dvx-invoices-export.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importBulkExcel(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await apiFetch("/api/integrations/dvx/invoices/import-result", {
      method: "POST",
      body: fd,
    });
    await load();
  }

  function runBulkWidget() {
    if (!effectiveSnapshot?.modules.taxPro) {
      setUpsellOpen(true);
      return;
    }
    window.localStorage.setItem("erafinanceAssistantBulkFlow", "eqaime");
    window.localStorage.setItem("erafinanceAssistantBulkIds", JSON.stringify(selectedIds));
    alert("Bulk payload prepared for ERA Finance Assistant");
  }

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <PageHeader
        title={t("invoices.title")}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={selectedIds.length === 0}
              onClick={runBulkWidget}
            >
              {t("bulk.invoices.rpa")}
            </button>
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={selectedIds.length === 0}
              onClick={() => void exportBulkExcel()}
            >
              {t("bulk.invoices.export")}
            </button>
            <label className={SECONDARY_BUTTON_CLASS}>
              {t("bulk.invoices.import")}
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importBulkExcel(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
              + {t("invoices.new")}
            </button>
          </div>
        }
      />
      <ExtensionInstallBanner variant="banner" dismissible />
      {error && <p className="shrink-0 text-sm text-red-600">{error}</p>}
      <EraListWorkspace
        filter={
          <div className="space-y-2">
            <EraSavedViewsBar
                views={savedViews}
                selectedId={selectedViewId}
                onSelect={onSelectView}
                onSave={saveView}
                onUpdate={updateSelectedView}
                onDelete={deleteSelectedView}
                canMutateSelected={canEditViews && selectedViewOwned}
                canSave={canEditViews}
                canShare={canShareViews}
                busy={viewsBusy}
                labels={{
                  view: t("savedViews.view"),
                  none: t("savedViews.none"),
                  save: t("savedViews.save"),
                  update: t("savedViews.update"),
                  delete: t("savedViews.delete"),
                  name: t("savedViews.namePrompt"),
                  shared: t("savedViews.shareConfirm"),
                  asDefault: t("savedViews.defaultConfirm"),
                }}
                extra={
                  canEditViews ? (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-[#34495E]">{t("savedViews.columns")}</summary>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {INVOICE_LIST_COLUMN_IDS.filter((c) => c !== "actions").map((c) => (
                        <label key={c} className="inline-flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={colVisible(c)}
                            onChange={(e) => {
                              setVisibleColumns((cur) => {
                                if (e.target.checked) {
                                  return INVOICE_LIST_COLUMN_IDS.filter(
                                    (id) => id === c || cur.includes(id),
                                  );
                                }
                                return cur.filter((id) => id !== c);
                              });
                            }}
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                  </details>
                  ) : null
                }
              />
            <EraListFilterBar
              className="!mb-0"
              resetLabel={t("common.filterReset", { defaultValue: "Reset" })}
              onReset={() => {
                setFilters(EMPTY_INVOICE_LIST_FILTERS);
                setPage(1);
              }}
            >
              <CatalogField
                kind="CLOSED_SMALL"
                label={t("invoices.status")}
                value={filters.status}
                onChange={(next) => {
                  setFilters((f) => ({ ...f, status: typeof next === "string" ? next : "" }));
                  setPage(1);
                }}
                options={[
                  { value: "", label: t("common.all", { defaultValue: "All" }) },
                  ...INVOICE_LIST_STATUSES.map((s) => ({
                    value: s,
                    label: formatInvoiceStatus(t, s),
                  })),
                ]}
              />
              <div className="min-w-[14rem]">
                <span className="mb-1 block text-xs font-semibold text-[#475569]">
                  {t("invoices.counterparty")}
                </span>
                <AsyncCombobox
                  value={filters.counterpartyId}
                  onChange={(id) => {
                    setFilters((f) => ({ ...f, counterpartyId: id }));
                    setPage(1);
                  }}
                  fetcher={fetchCounterparties}
                  getOptionLabel={(item) => item.name}
                  placeholder={t("invoiceNew.selectCounterpartyPlaceholder")}
                />
              </div>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-[#475569]">
                  {t("savedViews.dueFrom")}
                </span>
                <input
                  type="date"
                  className="rounded border border-[#D5DADF] px-2 py-1"
                  value={filters.dueFrom}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, dueFrom: e.target.value }));
                    setPage(1);
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-[#475569]">
                  {t("savedViews.dueTo")}
                </span>
                <input
                  type="date"
                  className="rounded border border-[#D5DADF] px-2 py-1"
                  value={filters.dueTo}
                  onChange={(e) => {
                    setFilters((f) => ({ ...f, dueTo: e.target.value }));
                    setPage(1);
                  }}
                />
              </label>
            </EraListFilterBar>
          </div>
        }
        table={
          <>
            {loading ? <p className="p-4 text-gray-600">{t("common.loading")}</p> : null}
            {!loading && total === 0 && !error ? (
              <EmptyState
                title={t("invoices.none")}
                description={t("invoices.emptyHint")}
                icon={
                  <FileStack className="mx-auto h-12 w-12 stroke-[1.5] text-[#7F8C8D]" aria-hidden />
                }
                action={
                  <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
                    + {t("invoices.new")}
                  </button>
                }
              />
            ) : null}
            {!loading && total > 0 ? (
              <>
                <div className="space-y-3 p-2 md:hidden">
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="space-y-2 rounded-2xl border border-[#D5DADF] bg-white p-4 text-[13px] shadow-sm"
                    >
                      <div className="font-semibold text-[#34495E]">{r.number}</div>
                      <div className="text-[#34495E]">{r.counterparty.name}</div>
                      <div>
                        {formatInvoiceStatus(t, r.status)} · {String(r.dueDate).slice(0, 10)}
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        {formatMoneyAzn(r.totalAmount)}
                      </div>
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        title={t("invoices.view")}
                        onClick={() => openInvoiceView(r.id)}
                      >
                        <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block">
                  <table className={`${DATA_TABLE_CLASS} min-w-[720px]`}>
                    <thead>
                      <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                        {colVisible("number") ? (
                          <th className={DATA_TABLE_TH_LEFT_CLASS}>
                            <button type="button" className="font-semibold" onClick={() => toggleSort("number")}>
                              {t("invoices.number")}
                              {sortMark("number")}
                            </button>
                          </th>
                        ) : null}
                        <th className={DATA_TABLE_TH_CENTER_CLASS}>
                          <input
                            type="checkbox"
                            checked={rows.length > 0 && selectedIds.length === rows.length}
                            onChange={(e) =>
                              setSelectedIds(e.target.checked ? rows.map((x) => x.id) : [])
                            }
                          />
                        </th>
                        {colVisible("counterparty") ? (
                          <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("invoices.counterparty")}</th>
                        ) : null}
                        {colVisible("status") ? (
                          <th className={DATA_TABLE_TH_CENTER_CLASS}>
                            <button type="button" className="font-semibold" onClick={() => toggleSort("status")}>
                              {t("invoices.status")}
                              {sortMark("status")}
                            </button>
                          </th>
                        ) : null}
                        {colVisible("eqaimeStatus") ? (
                          <th className={`hidden lg:table-cell ${DATA_TABLE_TH_CENTER_CLASS}`}>
                            {t("invoices.eqaimeStatus")}
                          </th>
                        ) : null}
                        {colVisible("dueDate") ? (
                          <th className={`hidden lg:table-cell ${DATA_TABLE_TH_RIGHT_CLASS}`}>
                            <button type="button" className="font-semibold" onClick={() => toggleSort("dueDate")}>
                              {t("invoices.due")}
                              {sortMark("dueDate")}
                            </button>
                          </th>
                        ) : null}
                        {colVisible("totalAmount") ? (
                          <th className={DATA_TABLE_TH_RIGHT_CLASS}>
                            <button type="button" className="font-semibold" onClick={() => toggleSort("totalAmount")}>
                              {t("invoices.amount")}
                              {sortMark("totalAmount")}
                            </button>
                          </th>
                        ) : null}
                        {colVisible("paidTotal") ? (
                          <th className={`hidden xl:table-cell ${DATA_TABLE_TH_RIGHT_CLASS}`}>
                            {t("invoices.paidCol")}
                          </th>
                        ) : null}
                        {colVisible("remaining") ? (
                          <th className={`hidden xl:table-cell ${DATA_TABLE_TH_RIGHT_CLASS}`}>
                            {t("invoices.remainingCol")}
                          </th>
                        ) : null}
                        {colVisible("actions") ? (
                          <th className={`${DATA_TABLE_TH_RIGHT_CLASS} min-w-[240px] w-[240px]`}>
                            {t("invoices.actions")}
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <Fragment key={r.id}>
                          <tr className={DATA_TABLE_TR_CLASS}>
                            {colVisible("number") ? (
                              <td className={`${DATA_TABLE_TD_CLASS} font-semibold text-[#34495E]`}>
                                {r.number}
                                {r.isInternational ? (
                                  <span className="ml-2 rounded-full bg-[#EAF2F8] px-2 py-0.5 text-[11px] font-medium text-[#2471A3]">
                                    {t("trade.export.chip")}
                                  </span>
                                ) : null}
                              </td>
                            ) : null}
                            <td className={DATA_TABLE_TD_CENTER_CLASS}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(r.id)}
                                onChange={(e) => toggleSelected(r.id, e.target.checked)}
                              />
                            </td>
                            {colVisible("counterparty") ? (
                              <td className={DATA_TABLE_TD_CLASS}>{r.counterparty.name}</td>
                            ) : null}
                            {colVisible("status") ? (
                              <td className={DATA_TABLE_TD_CENTER_CLASS}>{formatInvoiceStatus(t, r.status)}</td>
                            ) : null}
                            {colVisible("eqaimeStatus") ? (
                              <td className={`hidden lg:table-cell ${DATA_TABLE_TD_CENTER_CLASS} text-xs`}>
                                {!r.isInternational ? formatEqaimeStatus(t, r.eqaimeStatus) : "—"}
                              </td>
                            ) : null}
                            {colVisible("dueDate") ? (
                              <td className={`hidden lg:table-cell ${DATA_TABLE_TD_RIGHT_CLASS}`}>
                                {String(r.dueDate).slice(0, 10)}
                              </td>
                            ) : null}
                            {colVisible("totalAmount") ? (
                              <td className={DATA_TABLE_TD_RIGHT_CLASS}>{formatMoneyAzn(r.totalAmount)}</td>
                            ) : null}
                            {colVisible("paidTotal") ? (
                              <td className={`hidden xl:table-cell ${DATA_TABLE_TD_RIGHT_CLASS}`}>
                                {r.paidTotal != null ? formatMoneyAzn(r.paidTotal) : "—"}
                              </td>
                            ) : null}
                            {colVisible("remaining") ? (
                              <td className={`hidden xl:table-cell ${DATA_TABLE_TD_RIGHT_CLASS}`}>
                                {r.remaining != null ? formatMoneyAzn(r.remaining) : "—"}
                              </td>
                            ) : null}
                            {colVisible("actions") ? (
                              <td className={`${DATA_TABLE_ACTIONS_TD_CLASS} min-w-[240px] w-[240px]`}>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    className={TABLE_ROW_ICON_BTN_CLASS}
                                    title={t("invoices.view")}
                                    onClick={() => openInvoiceView(r.id)}
                                  >
                                    <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                  </button>
                                  {r.status === "DRAFT" ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={invoiceActionBusy !== null}
                                        className={TABLE_ROW_ICON_BTN_CLASS}
                                        title={t("invoices.sent")}
                                        onClick={() => void patchStatus(r.id, "SENT")}
                                      >
                                        <SendHorizontal className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={invoiceActionBusy !== null}
                                        className={TABLE_ROW_ICON_BTN_CLASS}
                                        title={t("invoices.payFull")}
                                        onClick={() => void patchStatus(r.id, "PAID")}
                                      >
                                        <CheckCircle2 className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                      </button>
                                    </>
                                  ) : null}
                                  {r.status === "SENT" || r.status === "PARTIALLY_PAID" ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={invoiceActionBusy !== null}
                                        className={TABLE_ROW_ICON_BTN_CLASS}
                                        title={t("invoices.partialPay")}
                                        onClick={() => openPay(r)}
                                      >
                                        <Wallet className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={invoiceActionBusy !== null}
                                        className={TABLE_ROW_ICON_BTN_CLASS}
                                        title={t("invoices.payFull")}
                                        onClick={() => void patchStatus(r.id, "PAID")}
                                      >
                                        <CheckCircle2 className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                      </button>
                                    </>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={invoiceActionBusy !== null}
                                    className={TABLE_ROW_ICON_BTN_CLASS}
                                    title={t("invoices.sendEmail")}
                                    onClick={() => void sendEmail(r.id)}
                                  >
                                    <Send className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                  </button>
                                  {canCreateShipmentOrder(r) ? (
                                    <div className="relative inline-block" data-invoice-actions-wrap={r.id}>
                                      <button
                                        type="button"
                                        disabled={invoiceActionBusy !== null}
                                        className="rounded-lg border border-[#D5DADF] bg-white px-2 py-1.5 text-[#34495E] hover:bg-[#F8F9FA]"
                                        aria-expanded={invoiceActionsMenuId === r.id}
                                        aria-haspopup="menu"
                                        aria-label={t("invoices.actionsMenuAria")}
                                        onClick={() =>
                                          setInvoiceActionsMenuId((cur) => (cur === r.id ? null : r.id))
                                        }
                                      >
                                        <MoreHorizontal className="h-4 w-4" aria-hidden />
                                      </button>
                                      {invoiceActionsMenuId === r.id ? (
                                        <div
                                          className="absolute right-0 z-50 mt-1 min-w-[12rem] rounded-lg border border-[#D5DADF] bg-white py-1 text-[13px] text-[#34495E] shadow-md"
                                          role="menu"
                                        >
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="block w-full px-3 py-2 text-left hover:bg-[#F1F5F9]"
                                            onClick={() => {
                                              setInvoiceActionsMenuId(null);
                                              setShipmentBasisTransactionId(
                                                r.revenuePostedTransactionId ?? undefined,
                                              );
                                              setShipmentModalOpen(true);
                                            }}
                                          >
                                            {t("invoices.createShipmentOrder")}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            ) : null}
                          </tr>
                          {payForId === r.id ? (
                            <tr className={`${DATA_TABLE_TR_CLASS} bg-[#F8FAFC]`}>
                              <td colSpan={10} className={`${DATA_TABLE_TD_CLASS} p-4`}>
                                <div className="flex max-w-xl flex-wrap items-end gap-3">
                                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#475569]">
                                    {t("invoices.payAmount")}
                                    <input
                                      type="text"
                                      value={payAmount}
                                      onChange={(e) => setPayAmount(e.target.value)}
                                      className="w-36 rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                                    />
                                  </label>
                                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#475569]">
                                    {t("invoices.payDate")}
                                    <input
                                      type="date"
                                      value={payDate}
                                      onChange={(e) => setPayDate(e.target.value)}
                                      className="rounded-lg border border-[#D5DADF] px-2 py-1.5 text-[13px]"
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    disabled={paySubmitting}
                                    onClick={() => void submitPartialPayment(r.id)}
                                    className={`${PRIMARY_BUTTON_CLASS} px-3 text-[13px]`}
                                  >
                                    {paySubmitting ? "…" : t("invoices.paySubmit")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPayForId(null)}
                                    className="rounded-lg border border-[#D5DADF] px-3 py-1.5 text-[13px]"
                                  >
                                    {t("invoices.payCancel")}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </>
        }
        footer={
          !loading ? (
            <ListPaginationFooter
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          ) : null
        }
      />
      <CreateInvoiceModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ViewInvoiceModal
        open={!!viewInvoiceId}
        invoiceId={viewInvoiceId}
        onClose={closeInvoiceView}
        onInvoicesUpdated={() => void load()}
      />
      <CreateShipmentModal
        open={shipmentModalOpen}
        initialBasisTransactionId={shipmentBasisTransactionId}
        onClose={() => {
          setShipmentModalOpen(false);
          setShipmentBasisTransactionId(undefined);
        }}
        onSaved={() => void load()}
      />
      <RpaUpsellModal open={upsellOpen} onClose={() => setUpsellOpen(false)} moduleKey="taxPro" />
    </div>
  );
}
