"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Eye, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CatalogField,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DatePicker,
  EraListFilterBar,
  EraListWorkspace,
  Field,
  FieldSelect,
  FieldTextarea,
  LIST_PAGE_SHELL_CLASS,
  ListPaginationFooter,
  MODAL_CHECKBOX_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  PageHeader,
  TABLE_ROW_ICON_BTN_CLASS,
  showApiError,
  TEXT_MUTED_CLASS,
  usePaginatedList,
} from "@era/satellite-kit/ui";
import { CatalogMultiAdder } from "@/components/catalog-multi-adder";
import { labStatusTone } from "@/components/lab-status-tone";
import { bakuDateDisplay } from "@/lib/baku-day";
import { LabOrderWorkflowModal } from "@/components/LabOrderWorkflowModal";
import { OccupiedRoomFilter } from "@/components/sanatorium/OccupiedRoomFilter";
import type {
  DiagnosticCatalogGroup,
  DiagnosticCatalogItem,
  L10n,
} from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import {
  expandPackageCodes,
  filterAndSortCatalogItems,
} from "@/domain/catalog/diagnostic-catalog-shared";
import { formatNameAndCode } from "@/lib/display-code";
import {
  DIAGNOSTIC_LANE_KINDS,
  LAB_PANEL_KIND,
  parseLabListLane,
  type LabListLane,
} from "@/domain/lab/lab-order-lane";

type ModalityRef = { code: string; titleEn: string; titleRu: string; titleAz: string };
type DiagnosticServiceRef = {
  code: string;
  titleEn?: string;
  titleRu?: string;
  titleAz?: string | null;
  modality?: ModalityRef | null;
};
type LabOrderItem = {
  id: string;
  serviceCode: string;
  inPackage?: boolean;
  amountNet?: string | number | null;
  diagnosticService?: DiagnosticServiceRef | null;
};

type LabOrder = {
  id: string;
  testCode: string;
  status: string;
  amountNet: string;
  createdAt?: string;
  collectedAt?: string | null;
  resultDate?: string | null;
  visitId?: string | null;
  patientRef: { id: string; refCode: string; fullName: string };
  episode?: {
    roomNumber?: string | null;
    careDoctors?: Array<{ practitioner?: { fullName: string } | null }>;
  } | null;
  visit?: { roomNumber?: string | null; practitioner?: { fullName: string } | null } | null;
  items?: LabOrderItem[];
};

function labOrderListDate(order: LabOrder): Date | null {
  const raw = order.collectedAt || order.resultDate || order.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function StatusDot({ status, label }: { status: string; label: string }) {
  const tone = labStatusTone(status);
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}
      title={label}
      aria-label={label}
    />
  );
}

type ListFilters = {
  q: string;
  room: string;
  status: string;
  criticalOnly: boolean;
  modality: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
  sortDir: "" | "asc" | "desc";
  lane: LabListLane;
};

const emptyFilters: ListFilters = {
  q: "",
  room: "",
  status: "",
  criticalOnly: false,
  modality: "",
  dateFrom: "",
  dateTo: "",
  sort: "",
  sortDir: "",
  lane: "lab",
};

function laneKinds(lane: LabListLane): readonly string[] {
  return lane === "diagnostic" ? DIAGNOSTIC_LANE_KINDS : [LAB_PANEL_KIND];
}

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

const LAB_ORDER_STATUSES = [
  "ORDERED",
  "COLLECTED",
  "IN_PROGRESS",
  "RESULT_READY",
  "PUBLISHED",
  "COMPLETED",
  "CANCELLED",
] as const;

function modalityTitle(
  code: string | null | undefined,
  modalities: Array<{ code: string; title: L10n }>,
  locale: string,
): string {
  if (!code) return "—";
  const hit = modalities.find((m) => m.code === code);
  return hit ? pickL10n(hit.title, locale) : code;
}

function chargeAmount(order: Pick<LabOrder, "amountNet" | "items">): number {
  const header = Number(order.amountNet);
  if (header > 0) return header;
  return (order.items ?? []).reduce((sum, item) => sum + (Number(item.amountNet) || 0), 0);
}

const CLOSED_LAB = new Set(["RESULT_READY", "PUBLISHED", "COMPLETED"]);
const CLOSED_ROW = "border-b border-[#D5DADF] bg-amber-50 hover:bg-amber-100";
const OPEN_ROW = "border-b border-[#D5DADF] bg-white hover:bg-[#F1F5F9]";

function labRowClosed(status: string): boolean {
  return CLOSED_LAB.has(status);
}

function amountLabel(order: LabOrder, inPackageLabel: string): string {
  const net = chargeAmount(order);
  const items = order.items ?? [];
  if (items.length > 0 && items.every((item) => item.inPackage) && !(net > 0)) {
    return inPackageLabel;
  }
  return `${Number.isFinite(net) ? net.toFixed(2) : "0.00"} AZN`;
}

export default function LabOrdersPage() {
  const t = useTranslations("labOrders");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ListFilters>(() => ({
    ...emptyFilters,
    lane: parseLabListLane(searchParams.get("lane")),
  }));
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ patientRefCode: "", patientFullName: "" });
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [catalogItems, setCatalogItems] = useState<DiagnosticCatalogItem[]>([]);
  const [catalogGroups, setCatalogGroups] = useState<DiagnosticCatalogGroup[]>([]);
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>([]);
  const [favoritesMode, setFavoritesMode] = useState<"first" | "only">("first");
  const [modalityFilter, setModalityFilter] = useState("");
  const [guestOptions, setGuestOptions] = useState<
    Array<{ value: string; label: string; fullName: string }>
  >([]);
  const [externalResult, setExternalResult] = useState(false);
  const [resultDate, setResultDate] = useState("");
  const [externalResultsText, setExternalResultsText] = useState("");
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
      params.set("kinds", laneKinds(f.lane).join(","));
      if (f.lane === "lab") params.set("unclassified", "true");
      if (f.q.trim()) params.set("q", f.q.trim());
      if (f.room.trim()) params.set("room", f.room.trim());
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.sort && f.sortDir) {
        params.set("sort", f.sort);
        params.set("sortDir", f.sortDir);
      }
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
  const [statusById, setStatusById] = useState<Record<string, string>>({});

  function orderStatus(order: LabOrder): string {
    return statusById[order.id] ?? order.status;
  }

  useEffect(() => {
    const fromQuery = searchParams.get("order");
    if (fromQuery) setWorkflowId(fromQuery);
  }, [searchParams]);

  const lane = parseLabListLane(searchParams.get("lane"));

  useEffect(() => {
    setFilters((prev) =>
      prev.lane === lane ? prev : { ...prev, lane, modality: "" },
    );
  }, [lane]);

  function closeWorkflow() {
    setWorkflowId(null);
    if (searchParams.get("order")) {
      router.replace(`/lab-orders?lane=${lane}`);
    }
  }

  useEffect(() => {
    void (async () => {
      const fromEpisodes = await fetch("/api/sanatorium/episodes?pageSize=200")
        .then(async (res) => {
          if (!res.ok) return [];
          const d = await res.json();
          const row = d.data ?? d;
          const items = (Array.isArray(row)
            ? row
            : (row.data ?? row.items ?? [])) as Array<{
            roomNumber?: string | null;
            patientOrigin?: string;
            patientRef?: { refCode?: string; fullName?: string };
          }>;
          return items
            .map((ep) => {
              const code = ep.patientRef?.refCode?.trim() ?? "";
              const name = ep.patientRef?.fullName?.trim() ?? code;
              if (!code) return null;
              const room = ep.roomNumber?.trim();
              const origin = ep.patientOrigin === "WALK_IN" ? "walk-in" : room || "";
              return {
                value: code,
                fullName: name,
                label: origin ? `${name} · ${code} · ${origin}` : `${name} · ${code}`,
              };
            })
            .filter((row): row is { value: string; label: string; fullName: string } => Boolean(row));
        })
        .catch(() => []);
      if (fromEpisodes.length > 0) {
        setGuestOptions(fromEpisodes);
        return;
      }
      const fromPatients = await fetch("/api/patients?pageSize=100&episodeStatus=OPEN")
        .then(async (res) => {
          if (!res.ok) return [];
          const d = await res.json();
          const items = (d.items ?? d.data?.items ?? []) as Array<{
            refCode?: string;
            fullName?: string;
          }>;
          return items
            .map((p) => {
              const code = p.refCode?.trim() ?? "";
              const name = p.fullName?.trim() ?? code;
              if (!code) return null;
              return { value: code, fullName: name, label: `${name} · ${code}` };
            })
            .filter((row): row is { value: string; label: string; fullName: string } => Boolean(row));
        })
        .catch(() => []);
      setGuestOptions(fromPatients);
    })();
  }, []);

  useEffect(() => {
    void fetch("/api/diagnostic-catalog?kinds=lab_panel,imaging,functional,endoscopy,package&applyFavorites=false")
      .then((r) => r.json())
      .then((d) => {
        const row = d.data ?? d;
        setCatalogItems(row.items ?? []);
        setCatalogGroups(row.groups ?? []);
        setFavoriteKeys(row.favorites?.keys ?? []);
        setFavoritesMode(row.favorites?.mode === "only" ? "only" : "first");
      });
  }, []);

  const modalities = useMemo(() => {
    const allowed = new Set(laneKinds(filters.lane));
    const map = new Map<string, L10n>();
    for (const group of catalogGroups) {
      if (group.category) continue;
      if (!allowed.has(group.kind)) continue;
      if (!group.modality || map.has(group.modality)) continue;
      map.set(group.modality, group.title);
    }
    return [...map.entries()].map(([code, title]) => ({ code, title }));
  }, [catalogGroups, filters.lane]);

  const catalogOptions = useMemo(
    () =>
      filterAndSortCatalogItems(catalogItems, favoriteKeys, favoritesMode, {
        search: "",
      })
        .filter((item) => laneKinds(filters.lane).includes(item.kind) && !item.packageOnly)
        .map((item) => ({
        value: item.code,
        label: formatNameAndCode(pickL10n(item.title, locale), item.code),
      })),
    [catalogItems, favoriteKeys, favoritesMode, locale, filters.lane],
  );

  function patchFilters(patch: Partial<ListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function resetFilters() {
    setFilters({ ...emptyFilters, lane: filters.lane });
  }

  async function cancelOrder(id: string) {
    if (!window.confirm(t("cancelConfirm"))) return;
    const res = await fetch(`/api/lab-orders/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showApiError(data, tc("failed"));
      return;
    }
    setStatusById((prev) => ({ ...prev, [id]: "CANCELLED" }));
  }

  async function createOrder(confirmRepeat = false) {
    if (!form.patientRefCode.trim() || selectedCodes.length === 0) return;
    const guest = guestOptions.find((row) => row.value === form.patientRefCode.trim());
    if (!guest) {
      showApiError({ error: t("selectPatient") });
      return;
    }
    const expanded = expandPackageCodes(selectedCodes, catalogItems);
    const payload: Record<string, unknown> = pendingCreatePayload && confirmRepeat
      ? { ...pendingCreatePayload, confirmRepeat: true }
      : {
          patientRefCode: guest.value,
          patientFullName: guest.fullName,
          testCodes: expanded,
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
        showApiError(data, t("labAlreadyOpen"));
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
      showApiError(data, tc("failed"));
      return;
    }
    const order = data.data ?? data;
    setCreateOpen(false);
    setLabRepeatOpen(false);
    setPendingCreatePayload(null);
    setPendingRepeatCode("");
    setForm({ patientRefCode: "", patientFullName: "" });
    setSelectedCodes([]);
    setExternalResult(false);
    setResultDate("");
    setExternalResultsText("");
    if (order?.id) {
      await loadOrders();
      setWorkflowId(order.id as string);
    } else await loadOrders();
  }

  async function completeOrder(id: string) {
    const res = await fetch(`/api/lab-orders/${id}/complete`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      showApiError(data, tc("failed"));
      return;
    }
    setStatusById((prev) => ({ ...prev, [id]: "COMPLETED" }));
  }

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; refCode: string; room: string; doctor: string; items: LabOrder[] }
    >();
    for (const order of orders) {
      const id = order.patientRef.id;
      const row = map.get(id) ?? {
        id,
        name: order.patientRef.fullName,
        refCode: order.patientRef.refCode,
        room: order.episode?.roomNumber || order.visit?.roomNumber || "",
        doctor:
          order.episode?.careDoctors?.[0]?.practitioner?.fullName ||
          order.visit?.practitioner?.fullName ||
          "",
        items: [],
      };
      if (!row.room) row.room = order.episode?.roomNumber || order.visit?.roomNumber || "";
      if (!row.doctor) {
        row.doctor =
          order.episode?.careDoctors?.[0]?.practitioner?.fullName ||
          order.visit?.practitioner?.fullName ||
          "";
      }
      row.items.push(order);
      map.set(id, row);
    }
    return [...map.values()];
  }, [orders]);

  function toggleSort(key: string) {
    setFilters((prev) => ({
      ...prev,
      sort: key,
      sortDir: prev.sort === key && prev.sortDir === "asc" ? "desc" : "asc",
    }));
  }

  return (
    <div className={LIST_PAGE_SHELL_CLASS}>
      <div className="shrink-0">
        <PageHeader
          title={filters.lane === "diagnostic" ? t("titleDiagnostic") : t("titleLab")}
          actions={
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              {filters.lane === "diagnostic" ? t("createTitleDiagnostic") : t("createTitle")}
            </button>
          }
        />
      </div>
      <EraListWorkspace
        filter={
          <EraListFilterBar
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
            <OccupiedRoomFilter
              label={t("roomFilter")}
              value={filters.room}
              onChange={(room) => patchFilters({ room })}
              allLabel={tc("all")}
            />
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
              {LAB_ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`orderStatus.${status}`)}
                </option>
              ))}
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
        table={
          <table className={DATA_TABLE_CLASS}>
            <thead>
              <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  <button type="button" onClick={() => toggleSort("patient")}>{t("colPatient")}</button>
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colRoom")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colDoctor")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("colServices")}</th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  <button type="button" onClick={() => toggleSort("status")}>{tc("status")}</button>
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  <button type="button" onClick={() => toggleSort("amount")}>{t("colAmount")}</button>
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>
                  <button type="button" onClick={() => toggleSort("created")}>{t("colCreated")}</button>
                </th>
                <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td className={DATA_TABLE_TD_CLASS} colSpan={8}>
                    {loading
                      ? tc("loading")
                      : filters.lane === "diagnostic"
                        ? t("emptyDiagnostic")
                        : t("emptyLab")}
                  </td>
                </tr>
              ) : (
                groups.map((group) => {
                  const open = !collapsed.has(group.id);
                  const allClosed =
                    group.items.length > 0 &&
                    group.items.every((order) => labRowClosed(orderStatus(order)));
                  return (
                    <Fragment key={group.id}>
                      <tr className={allClosed ? CLOSED_ROW : OPEN_ROW}>
                        <td className={DATA_TABLE_TD_CLASS}>
                          <button
                            type="button"
                            className="flex items-center gap-2 text-left"
                            aria-expanded={open}
                            onClick={() =>
                              setCollapsed((prev) => {
                                const next = new Set(prev);
                                if (next.has(group.id)) next.delete(group.id);
                                else next.add(group.id);
                                return next;
                              })
                            }
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-[#7F8C8D]" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-[#7F8C8D]" aria-hidden />
                            )}
                            <span>
                              <span className="font-medium">{group.name}</span>
                              <span className={`ml-2 text-[11px] ${TEXT_MUTED_CLASS}`}>{group.refCode}</span>
                            </span>
                          </button>
                        </td>
                        <td className={DATA_TABLE_TD_CLASS}>{group.room || "—"}</td>
                        <td className={DATA_TABLE_TD_CLASS}>{group.doctor || "—"}</td>
                        <td className={DATA_TABLE_TD_CLASS} colSpan={5} />
                      </tr>
                      {open
                        ? group.items.map((order) => {
                            const status = orderStatus(order);
                            const label = (LAB_ORDER_STATUSES as readonly string[]).includes(status)
                              ? t(`orderStatus.${status}` as "orderStatus.ORDERED")
                              : status;
                            const closed = labRowClosed(status);
                            return (
                              <tr
                                key={order.id}
                                className={
                                  order.id === selectedId
                                    ? "border-b border-[#D5DADF] bg-white ring-2 ring-inset ring-[#2980B9]"
                                    : closed
                                      ? CLOSED_ROW
                                      : OPEN_ROW
                                }
                                onClick={() => setSelectedId(order.id)}
                                onDoubleClick={() => {
                                  setSelectedId(order.id);
                                  setWorkflowId(order.id);
                                }}
                              >
                                <td className={DATA_TABLE_TD_CLASS} />
                                <td className={DATA_TABLE_TD_CLASS} />
                                <td className={DATA_TABLE_TD_CLASS} />
                                <td className={DATA_TABLE_TD_CLASS}>
                                  <button
                                    type="button"
                                    className="font-medium text-[#2980B9] hover:underline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setWorkflowId(order.id);
                                    }}
                                  >
                                    {servicesLabel(order, locale)}
                                  </button>
                                </td>
                                <td className={DATA_TABLE_TD_CLASS}>
                                  <span className={`font-medium ${labStatusTone(status).text}`}>{label}</span>
                                </td>
                                <td className={DATA_TABLE_TD_CLASS}>{amountLabel(order, t("inPackage"))}</td>
                                <td className={DATA_TABLE_TD_CLASS}>
                                  {labOrderListDate(order) ? bakuDateDisplay(labOrderListDate(order)!) : "—"}
                                </td>
                                <td className={DATA_TABLE_TD_CLASS}>
                                  <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
                                    <button
                                      type="button"
                                      className={TABLE_ROW_ICON_BTN_CLASS}
                                      aria-label={t("openOrder")}
                                      onClick={() => setWorkflowId(order.id)}
                                    >
                                      <Eye className="h-4 w-4 text-[#2980B9]" aria-hidden />
                                    </button>
                                    {status === "ORDERED" ? (
                                      <button
                                        type="button"
                                        className={TABLE_ROW_ICON_BTN_CLASS}
                                        aria-label={t("cancelOrder")}
                                        onClick={() => void cancelOrder(order.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-[#E74C3C]" aria-hidden />
                                      </button>
                                    ) : null}
                                    {status === "PUBLISHED" ? (
                                      <button
                                        type="button"
                                        className={TABLE_ROW_ICON_BTN_CLASS}
                                        aria-label={tc("complete")}
                                        onClick={() => void completeOrder(order.id)}
                                      >
                                        <Check className="h-4 w-4 text-[#27AE60]" aria-hidden />
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        : null}
                    </Fragment>
                  );
                })
              )}
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
        title={filters.lane === "diagnostic" ? t("createTitleDiagnostic") : t("createTitle")}
        onClose={() => {
          setCreateOpen(false);
        }}
      >
        <div className="space-y-3">
          <CatalogField
            kind="SEARCHABLE"
            label={t("guest")}
            value={form.patientRefCode}
            onChange={(value) => {
              const code = String(value ?? "");
              const hit = guestOptions.find((row) => row.value === code);
              setForm({
                patientRefCode: code,
                patientFullName: hit?.fullName ?? "",
              });
            }}
            options={guestOptions}
            emptyLabel={t("selectPatient")}
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
          <CatalogMultiAdder
            label={t("tests")}
            options={catalogOptions}
            value={selectedCodes}
            onChange={setSelectedCodes}
            emptyLabel={t("searchCatalog")}
            removeLabel={t("removeChip")}
          />
        </div>
        <ModalFooter
          onCancel={() => {
            setCreateOpen(false);
          }}
          onSubmit={() => void createOrder()}
          submitLabel={tc("save")}
        />
      </ModalShell>

      <LabOrderWorkflowModal
        open={Boolean(workflowId)}
        orderId={workflowId}
        onClose={closeWorkflow}
        onChanged={(patch) => {
          if (!patch) return;
          setStatusById((prev) => ({ ...prev, [patch.id]: patch.status }));
        }}
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
