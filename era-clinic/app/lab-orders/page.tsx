"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  ColorLegend,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DatePicker,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  FieldSelect,
  FieldTextarea,
  LINK_ACCENT_CLASS,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  usePaginatedList,
} from "@era/satellite-kit/ui";
import { DiagnosticCatalogPicker } from "@/components/DiagnosticCatalogPicker";
import { LabOrderWorkflowModal } from "@/components/LabOrderWorkflowModal";
import type { DiagnosticCatalogItem, L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import {
  expandPackageCodes,
  filterAndSortCatalogItems,
} from "@/domain/catalog/diagnostic-catalog-shared";
import { formatNameAndCode } from "@/lib/display-code";

type ModalityRef = { code: string; titleEn: string; titleRu: string; titleAz: string };
type DiagnosticServiceRef = {
  code: string;
  titleEn?: string;
  titleRu?: string;
  titleAz?: string | null;
  modality?: ModalityRef | null;
};
type LabOrderItem = { id: string; serviceCode: string; diagnosticService?: DiagnosticServiceRef | null };

type LabOrder = {
  id: string;
  testCode: string;
  status: string;
  amountNet: string;
  createdAt?: string;
  collectedAt?: string | null;
  resultDate?: string | null;
  patientRef: { refCode: string; fullName: string };
  items?: LabOrderItem[];
};

function labOrderListDate(order: LabOrder): Date | null {
  const raw = order.collectedAt || order.resultDate || order.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

type ListFilters = {
  q: string;
  status: string;
  criticalOnly: boolean;
  modality: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: ListFilters = {
  q: "",
  status: "",
  criticalOnly: false,
  modality: "",
  dateFrom: "",
  dateTo: "",
};

function serviceDisplayName(
  item: LabOrderItem,
  locale: string,
): string {
  const svc = item.diagnosticService;
  const name = svc
    ? pickL10n(
        {
          en: svc.titleEn ?? svc.code,
          ru: svc.titleRu ?? svc.titleEn ?? svc.code,
          az: svc.titleAz ?? svc.titleEn ?? svc.code,
        },
        locale,
      )
    : "";
  return formatNameAndCode(name, item.serviceCode);
}

function servicesLabel(order: LabOrder, locale: string): string {
  if (order.items?.length) {
    return order.items.map((i) => serviceDisplayName(i, locale)).join(", ");
  }
  return order.testCode;
}

function modalityLabel(order: LabOrder): string {
  return order.items?.[0]?.diagnosticService?.modality?.code ?? "—";
}

export default function LabOrdersPage() {
  const t = useTranslations("labOrders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ListFilters>(emptyFilters);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ patientRefCode: "", patientFullName: "", visitId: "" });
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [catalogItems, setCatalogItems] = useState<DiagnosticCatalogItem[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);
  const [favoritesMode, setFavoritesMode] = useState<"first" | "only">("first");
  const [search, setSearch] = useState("");
  const [modalityFilter, setModalityFilter] = useState("");
  const [externalResult, setExternalResult] = useState(false);
  const [resultDate, setResultDate] = useState("");
  const [externalResultsText, setExternalResultsText] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [labRepeatOpen, setLabRepeatOpen] = useState(false);
  const [pendingRepeatCode, setPendingRepeatCode] = useState("");
  const [pendingCreatePayload, setPendingCreatePayload] = useState<Record<
    string,
    unknown
  > | null>(null);

  const fetcher = useCallback(
    async ({
      page,
      pageSize,
      filters: f,
    }: {
      page: number;
      pageSize: number;
      filters: ListFilters;
    }) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (f.status) params.set("status", f.status);
      if (f.criticalOnly) params.set("criticalOnly", "true");
      if (f.modality) params.set("modality", f.modality);
      if (f.q.trim()) params.set("q", f.q.trim());
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      const res = await fetch(`/api/lab-orders?${params}`);
      if (!res.ok) throw new Error("Failed to load lab orders");
      return res.json();
    },
    [],
  );

  const {
    items: orders,
    total,
    page,
    pageSize,
    setPage,
    setPageSize,
    loading,
    reload: loadOrders,
  } = usePaginatedList<LabOrder, ListFilters>({ fetcher, filters });

  useEffect(() => {
    const fromQuery = searchParams.get("order");
    if (fromQuery) setWorkflowId(fromQuery);
  }, [searchParams]);

  function closeWorkflow() {
    setWorkflowId(null);
    if (searchParams.get("order")) {
      router.replace("/lab-orders");
    }
  }

  useEffect(() => {
    void fetch("/api/diagnostic-catalog?kinds=lab_panel,imaging,functional,endoscopy,package&applyFavorites=false")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
        setCatalogItems(row.items ?? []);
        setFavoriteKeys(row.favorites?.keys ?? []);
        setFavoritesMode(row.favorites?.mode === "only" ? "only" : "first");
      });
  }, []);

  const modalities = useMemo(() => {
    const map = new Map<string, L10n>();
    for (const item of catalogItems) {
      if (!map.has(item.modality)) {
        map.set(item.modality, {
          en: item.modality,
          ru: item.modality,
          az: item.modality,
        });
      }
    }
    return [...map.entries()].map(([code, title]) => ({ code, title }));
  }, [catalogItems]);

  const pickerItems = useMemo(
    () =>
      filterAndSortCatalogItems(catalogItems, favoriteKeys, favoritesMode, {
        search,
        modality: modalityFilter || undefined,
      }),
    [catalogItems, favoriteKeys, favoritesMode, search, modalityFilter],
  );

  function patchFilters(patch: Partial<ListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function resetFilters() {
    setFilters(emptyFilters);
  }

  async function cancelOrder(id: string) {
    if (!window.confirm(t("cancelConfirm"))) return;
    const res = await fetch(`/api/lab-orders/${id}`, { method: "DELETE" });
    if (res.ok) await loadOrders();
  }

  async function createOrder(confirmRepeat = false) {
    if (!form.patientRefCode.trim() || selectedCodes.length === 0) return;
    setCreateError(null);
    const expanded = expandPackageCodes(selectedCodes, catalogItems);
    const payload: Record<string, unknown> = pendingCreatePayload && confirmRepeat
      ? { ...pendingCreatePayload, confirmRepeat: true }
      : {
          patientRefCode: form.patientRefCode.trim(),
          patientFullName: form.patientFullName.trim() || form.patientRefCode.trim(),
          testCodes: expanded,
          visitId: form.visitId.trim() || undefined,
        };
    if (!confirmRepeat || !pendingCreatePayload) {
      if (externalResult) {
        payload.source = "EXTERNAL";
        payload.resultDate = resultDate;
        const lines = externalResultsText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [code, ...rest] = line.split(/[:=]/);
            const value = rest.join(":").trim() || code;
            return { code: rest.length ? code.trim() : "value", value };
          });
        if (lines.length === 0 && externalResultsText.trim()) {
          payload.results = [{ code: "value", value: externalResultsText.trim() }];
        } else {
          payload.results = lines;
        }
      }
    }
    const res = await fetch("/api/lab-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 409 && data.code === "LAB_ALREADY_OPEN") {
        setCreateError(t("labAlreadyOpen"));
        setPendingCreatePayload(null);
        return;
      }
      if (res.status === 409 && data.code === "LAB_ALREADY_COMPLETED") {
        setPendingCreatePayload(payload);
        setPendingRepeatCode(
          typeof data.testCode === "string" ? data.testCode : expanded[0] ?? "",
        );
        setLabRepeatOpen(true);
        return;
      }
      const errMsg =
        data?.error ?? data?.message ?? (res.status === 400 ? "Request failed" : tc("failed"));
      setCreateError(String(errMsg));
      return;
    }
    const order = data.data ?? data;
    setCreateOpen(false);
    setLabRepeatOpen(false);
    setPendingCreatePayload(null);
    setPendingRepeatCode("");
    setForm({ patientRefCode: "", patientFullName: "", visitId: "" });
    setSelectedCodes([]);
    setExternalResult(false);
    setResultDate("");
    setExternalResultsText("");
    setCreateError(null);
    if (order?.id) {
      await loadOrders();
      setWorkflowId(order.id as string);
    } else await loadOrders();
  }

  async function completeOrder(id: string) {
    await fetch(`/api/lab-orders/${id}/complete`, { method: "POST" });
    await loadOrders();
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          className="!mb-0"
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
              {t("createTitle")}
            </button>
          }
        />
      </div>
      <EraListWorkspace
        filter={
          <EraListFilterBar
            className="!mb-0"
            resetLabel={tc("filterReset")}
            onReset={resetFilters}
            actionsExtra={
              <label className={`inline-flex items-center gap-2 text-[13px] ${MODAL_FIELD_LABEL_CLASS}`}>
                <input
                  type="checkbox"
                  className={MODAL_CHECKBOX_CLASS}
                  checked={filters.criticalOnly}
                  onChange={(e) => patchFilters({ criticalOnly: e.target.checked })}
                />
                {t("criticalOnly")}
              </label>
            }
          >
            <Field
              label={t("patientFilter")}
              preset="shortText"
              value={filters.q}
              onChange={(e) => patchFilters({ q: e.target.value })}
              placeholder={t("patientSearchPlaceholder")}
            />
            <FieldSelect
              label={t("statusFilter")}
              preset="select"
              value={filters.status}
              onChange={(e) => patchFilters({ status: e.target.value })}
            >
              <option value="">{tc("all")}</option>
              <option value="ORDERED">ORDERED</option>
              <option value="COLLECTED">COLLECTED</option>
              <option value="RESULT_READY">RESULT_READY</option>
              <option value="PUBLISHED">PUBLISHED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </FieldSelect>
            <FieldSelect
              label={t("modalityFilter")}
              preset="select"
              value={filters.modality}
              onChange={(e) => patchFilters({ modality: e.target.value })}
            >
              <option value="">{tc("all")}</option>
              {modalities.map((m) => (
                <option key={m.code} value={m.code}>
                  {pickL10n(m.title, locale)}
                </option>
              ))}
            </FieldSelect>
            <DatePicker
              label={t("dateFrom")}
              value={filters.dateFrom}
              onChange={(isoDate) => patchFilters({ dateFrom: isoDate })}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
            <DatePicker
              label={t("dateTo")}
              value={filters.dateTo}
              onChange={(isoDate) => patchFilters({ dateTo: isoDate })}
              placeholder={tc("datePlaceholder")}
              openCalendarLabel={tc("openCalendar")}
            />
          </EraListFilterBar>
        }
        toolbar={
          <ColorLegend
            items={[
              { id: "ordered", label: "ORDERED", swatchClassName: "bg-slate-100" },
              { id: "ready", label: "RESULT_READY", swatchClassName: "bg-blue-50" },
              { id: "done", label: "COMPLETED", swatchClassName: "bg-green-50" },
            ]}
          />
        }
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colPatient")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colServices")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colType")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("status")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colAmount")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colCreated")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={`${DATA_TABLE_TR_CLASS} cursor-pointer`}
                  onClick={() => setWorkflowId(order.id)}
                >
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="font-medium">{order.patientRef.fullName}</div>
                    <div className={TEXT_MUTED_CLASS}>{order.patientRef.refCode}</div>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <button
                      type="button"
                      className={`font-medium ${LINK_ACCENT_CLASS}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setWorkflowId(order.id);
                      }}
                    >
                      {servicesLabel(order, locale)}
                    </button>
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>{modalityLabel(order)}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{order.status}</td>
                  <td className={DATA_TABLE_TD_CLASS}>{order.amountNet} AZN</td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    {labOrderListDate(order)?.toLocaleDateString() ?? "—"}
                  </td>
                  <td className={DATA_TABLE_TD_CLASS}>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        className={TABLE_ROW_ICON_BTN_CLASS}
                        aria-label={t("openOrder")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setWorkflowId(order.id);
                        }}
                      >
                        <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                      </button>
                      {order.status === "ORDERED" && (
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={t("cancelOrder")}
                          onClick={(e) => {
                            e.stopPropagation();
                            void cancelOrder(order.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                        </button>
                      )}
                      {order.status === "PUBLISHED" && (
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("complete")}
                          onClick={(e) => {
                            e.stopPropagation();
                            void completeOrder(order.id);
                          }}
                        >
                          <Check className="h-4 w-4 text-[#27AE60]" aria-hidden />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`}>
                    {loading ? tc("loading") : t("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        }
        footer={
          <ListPaginationFooter
            page={page}
            pageSize={pageSize}
            total={total}
            loading={loading}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            labels={{
              rowsPerPage: tc("rowsPerPage"),
              pageOf: tc("pageOf"),
              prev: tc("prev"),
              next: tc("next"),
            }}
          />
        }
      />

      <ModalShell
        open={createOpen}
        title={t("createTitle")}
        onClose={() => {
          setCreateOpen(false);
          setCreateError(null);
        }}
      >
        <div className="space-y-3">
          <Field
            label={t("patientRefCode")}
            preset="shortText"
            value={form.patientRefCode}
            onChange={(e) => setForm({ ...form, patientRefCode: e.target.value })}
            placeholder="P-000001"
          />
          <Field
            label={t("patientFullName")}
            preset="shortText"
            value={form.patientFullName}
            onChange={(e) => setForm({ ...form, patientFullName: e.target.value })}
          />
          <label className={`flex items-center gap-2 text-[13px] ${MODAL_FIELD_LABEL_CLASS}`}>
            <input
              type="checkbox"
              className={MODAL_CHECKBOX_CLASS}
              checked={externalResult}
              onChange={(e) => setExternalResult(e.target.checked)}
            />
            {t("externalResult", { defaultValue: "External / brought-in result" })}
          </label>
          {externalResult ? (
            <>
              <DatePicker
                label={t("resultDate", { defaultValue: "Result date" })}
                preset="date"
                value={resultDate}
                onChange={setResultDate}
                placeholder={tc("datePlaceholder")}
                openCalendarLabel={tc("openCalendar")}
              />
              <FieldTextarea
                label={t("externalResults", { defaultValue: "Results (one per line: code: value)" })}
                rows={4}
                value={externalResultsText}
                onChange={(e) => setExternalResultsText(e.target.value)}
              />
            </>
          ) : null}
          <DiagnosticCatalogPicker
            items={pickerItems}
            selected={selectedCodes}
            onChange={setSelectedCodes}
            favoriteKeys={favoriteKeys}
            favoritesMode={favoritesMode}
            search={search}
            onSearchChange={setSearch}
            modalityFilter={modalityFilter}
            onModalityFilterChange={setModalityFilter}
            modalities={modalities}
            labels={{
              search: t("searchCatalog"),
              allModalities: t("allModalities"),
              favoriteBadge: t("favoriteBadge"),
              empty: t("catalogEmpty"),
              favoritesOnlyHint: t("favoritesOnlyHint"),
            }}
          />
          {selectedCodes.length > 0 && (
            <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>
              {t("selectedCount", { count: selectedCodes.length })}
            </p>
          )}
          <Field
            label={t("visitIdOptional")}
            preset="shortText"
            placeholder={t("visitIdOptional")}
            value={form.visitId}
            onChange={(e) => setForm({ ...form, visitId: e.target.value })}
          />
          {createError ? <p className={`text-[13px] ${TEXT_DANGER_CLASS}`}>{createError}</p> : null}
        </div>
        <ModalFooter
          onCancel={() => {
            setCreateOpen(false);
            setCreateError(null);
          }}
          onSubmit={() => void createOrder()}
          submitLabel={tc("save")}
        />
      </ModalShell>

      <LabOrderWorkflowModal
        open={Boolean(workflowId)}
        orderId={workflowId}
        onClose={closeWorkflow}
        onChanged={() => void loadOrders()}
      />

      <ModalShell
        open={labRepeatOpen}
        title={t("labRepeatTitle")}
        onClose={() => {
          setLabRepeatOpen(false);
          setPendingCreatePayload(null);
        }}
        footer={
          <ModalFooter
            onCancel={() => {
              setLabRepeatOpen(false);
              setPendingCreatePayload(null);
            }}
            onSubmit={() => void createOrder(true)}
            submitLabel={tc("yes")}
            cancelLabel={tc("no")}
          />
        }
      >
        <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>
          {t("labRepeatBody", { code: pendingRepeatCode })}
        </p>
      </ModalShell>
    </div>
  );
}
