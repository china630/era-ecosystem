"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FlaskConical, Pencil, Plus, RotateCcw, TextCursorInput, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  SortableTh,
  sortRows,
  toggleColumnSort,
  type ColumnSort,
} from "@/components/sortable-column-header";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  EraListFilterBar,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  CatalogField,
  FieldRow,
  FieldSelect,
  FieldTextarea,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
  SECONDARY_BUTTON_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
  useDebouncedValue,
} from "@era/satellite-kit/ui";
import type { CatalogFieldDef, L10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import {
  CatalogFieldsEditor,
  parseCatalogFieldsJson,
} from "@/components/CatalogFieldsEditor";

type Modality = {
  id: string;
  code: string;
  kind: string;
  titleEn: string;
  titleRu: string;
  titleAz: string;
  sortOrder: number;
  active: boolean;
  _count?: { services?: number };
};

type DiagnosticService = {
  id: string;
  code: string;
  modalityId: string;
  modality?: { id: string; code: string; titleEn: string } | null;
  category: string;
  kind: string;
  titleEn: string;
  titleRu: string;
  titleAz: string;
  serviceCode: string;
  financeSku?: string | null;
  fieldsJson?: string | null;
  includesJson?: string | null;
  sortOrder: number;
  active: boolean;
  _count?: { analytes?: number };
};

type DictionaryAnalyte = {
  code: string;
  unit?: string | null;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  refMin?: string | null;
  refMax?: string | null;
  section?: string | null;
  valueType?: string;
  optionsJson?: string | null;
};

type DiagnosticAnalyte = {
  id: string;
  serviceId: string;
  code: string;
  unit?: string | null;
  labelEn: string;
  labelRu: string;
  labelAz: string;
  refMin?: string | null;
  refMax?: string | null;
  section?: string | null;
  valueType?: string;
  sortOrder: number;
  valueOptions?: Array<{
    code: string;
    labelEn: string;
    labelRu: string;
    labelAz: string;
    sortOrder?: number;
  }>;
};

type Tab = "modalities" | "services" | "favorites";

const ORDERABLE_KINDS = new Set([
  "lab_panel",
  "imaging",
  "functional",
  "endoscopy",
  "visit",
  "package",
]);

const CANON_KINDS = [
  "imaging",
  "functional",
  "endoscopy",
  "lab_panel",
  "visit",
  "package",
];

/** Blank fields belong on studies and visit exams, not lab panels or packages. */
const FORM_FIELD_KINDS = new Set(["imaging", "functional", "endoscopy", "visit"]);

type FavoriteItem = {
  code: string;
  kind: string;
  title: L10n;
};

type FavoritesPayload = {
  keys: string[];
  mode: "first" | "only";
  items?: FavoriteItem[];
};

function unwrap<T>(payload: unknown): T {
  return ((payload as { data?: T })?.data ?? payload) as T;
}

export default function DiagnosticCatalogAdminPage() {
  const t = useTranslations("adminDiagnosticCatalog");
  const tc = useTranslations("common");
  const tFav = useTranslations("catalogFavorites");
  const locale = useLocale();

  const [tab, setTab] = useState<Tab>("modalities");

  // Favorites tab state (migrated from /admin/catalog-favorites)
  const [favKeys, setFavKeys] = useState<string[]>([]);
  const [favItems, setFavItems] = useState<FavoriteItem[]>([]);
  const [analyteEditOpen, setAnalyteEditOpen] = useState(false);
  const [analytesOpen, setAnalytesOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldsServiceId, setFieldsServiceId] = useState<string | null>(null);
  const [panelTitle, setPanelTitle] = useState("");
  const [favMode, setFavMode] = useState<"first" | "only">("first");
  const [favLoading, setFavLoading] = useState(true);
  const [favSaving, setFavSaving] = useState(false);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [services, setServices] = useState<DiagnosticService[]>([]);
  const [analytes, setAnalytes] = useState<DiagnosticAnalyte[]>([]);
  const [serviceModalityFilter, setServiceModalityFilter] = useState("");
  const [serviceKindFilter, setServiceKindFilter] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [modalityQuery, setModalityQuery] = useState("");
  const [modalityKindFilter, setModalityKindFilter] = useState("");
  const [modalityStatusFilter, setModalityStatusFilter] = useState("");
  const [favQuery, setFavQuery] = useState("");
  const [favKindFilter, setFavKindFilter] = useState("");
  const [modalitySort, setModalitySort] = useState<ColumnSort | null>(null);
  const [serviceSort, setServiceSort] = useState<ColumnSort | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [financeServiceOptions, setFinanceServiceOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [financeServiceQ, setFinanceServiceQ] = useState("");
  const debouncedFinanceServiceQ = useDebouncedValue(financeServiceQ, 300);
  const [dictionaryQ, setDictionaryQ] = useState("");
  const debouncedDictionaryQ = useDebouncedValue(dictionaryQ, 300);
  const [dictionaryItems, setDictionaryItems] = useState<DictionaryAnalyte[]>([]);
  const [dictionaryPick, setDictionaryPick] = useState<DictionaryAnalyte | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formFields, setFormFields] = useState<CatalogFieldDef[]>([]);
  const loadModalities = useCallback(async () => {
    const res = await fetch("/api/admin/diagnostic-catalog/modalities?includeInactive=true");
    setModalities(unwrap<Modality[]>(await res.json()));
  }, []);

  const loadServices = useCallback(async () => {
    const qs = serviceModalityFilter
      ? `?modalityId=${encodeURIComponent(serviceModalityFilter)}&includeInactive=true`
      : "?includeInactive=true";
    const res = await fetch(`/api/admin/diagnostic-catalog/services${qs}`);
    setServices(unwrap<DiagnosticService[]>(await res.json()));
  }, [serviceModalityFilter]);

  const loadAnalytes = useCallback(async (serviceId: string) => {
    const res = await fetch(`/api/admin/diagnostic-catalog/services/${serviceId}/analytes`);
    setAnalytes(unwrap<DiagnosticAnalyte[]>(await res.json()));
  }, []);

  useEffect(() => {
    void loadModalities();
  }, [loadModalities]);

  useEffect(() => {
    if (!modalOpen || tab !== "services") return;
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams({ limit: "50", isService: "true" });
      if (debouncedFinanceServiceQ.trim()) params.set("q", debouncedFinanceServiceQ.trim());
      const res = await fetch(`/api/admin/finance-products?${params}`);
      if (!res.ok || cancelled) return;
      const parsed = await res.json();
      const payload = (parsed.data ?? parsed) as {
        items?: Array<{ value: string; label: string; sku?: string }>;
      };
      if (!cancelled) {
        setFinanceServiceOptions(
          (payload.items ?? []).map((item) => ({
            value: item.sku ?? item.value,
            label: item.label,
          })),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, tab, debouncedFinanceServiceQ]);

  useEffect(() => {
    if (!analyteEditOpen || editingId) return;
    let cancelled = false;
    void (async () => {
      const params = new URLSearchParams({ limit: "30" });
      if (debouncedDictionaryQ.trim()) params.set("q", debouncedDictionaryQ.trim());
      const res = await fetch(`/api/admin/diagnostic-catalog/analyte-dictionary?${params}`);
      if (!res.ok || cancelled) return;
      const parsed = await res.json();
      const payload = (parsed.data ?? parsed) as { items?: DictionaryAnalyte[] };
      if (!cancelled) setDictionaryItems(payload.items ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [analyteEditOpen, editingId, debouncedDictionaryQ]);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    if (selectedServiceId) void loadAnalytes(selectedServiceId);
  }, [selectedServiceId, loadAnalytes]);

  const loadFavorites = useCallback(async () => {
    setFavLoading(true);
    const res = await fetch("/api/admin/catalog-favorites");
    const row = unwrap<FavoritesPayload>(await res.json());
    setFavKeys((row.keys ?? []).filter((key) => key.startsWith("code:")));
    setFavMode(row.mode === "only" ? "only" : "first");
    setFavItems(row.items ?? []);
    setFavLoading(false);
  }, []);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  const orderableServices = useMemo(
    () => services.filter((s) => s.kind !== "LAB"),
    [services],
  );

  const filteredServices = useMemo(() => {
    const byKind = serviceKindFilter
      ? orderableServices.filter((s) => s.kind === serviceKindFilter)
      : orderableServices;
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return byKind;
    return byKind.filter((row) =>
      [row.titleAz, row.titleRu, row.titleEn, row.code, row.serviceCode, row.category].some(
        (value) => String(value ?? "").toLowerCase().includes(query),
      ),
    );
  }, [orderableServices, serviceKindFilter, serviceQuery]);

  const kindOptions = useMemo(() => {
    const set = new Set(orderableServices.map((s) => s.kind).filter(Boolean));
    return [...set].sort();
  }, [orderableServices]);

  const favoriteChoices = useMemo(
    () => favItems.filter((item) => ORDERABLE_KINDS.has(item.kind)),
    [favItems],
  );

  function localeTitle(row: { titleEn: string; titleRu?: string; titleAz?: string }) {
    if (locale.startsWith("ru")) return row.titleRu || row.titleEn;
    if (locale.startsWith("az")) return row.titleAz || row.titleEn;
    return row.titleEn;
  }

  function kindLabel(kind: string) {
    const key = `kind_${kind}` as "kind_visit";
    return t.has(key) ? t(key) : kind;
  }

  const modalityKindOptions = useMemo(() => {
    const set = new Set(modalities.map((row) => row.kind).filter(Boolean));
    return [...set].sort();
  }, [modalities]);

  const visibleModalities = useMemo(() => {
    const query = modalityQuery.trim().toLowerCase();
    const matched = modalities.filter((row) => {
      if (modalityKindFilter && row.kind !== modalityKindFilter) return false;
      if (modalityStatusFilter === "active" && !row.active) return false;
      if (modalityStatusFilter === "inactive" && row.active) return false;
      if (!query) return true;
      return [row.titleAz, row.titleRu, row.titleEn, row.code].some((value) =>
        String(value ?? "").toLowerCase().includes(query),
      );
    });
    return sortRows(matched, modalitySort, (row, key) => {
      if (key === "title") return localeTitle(row);
      if (key === "code") return row.code;
      if (key === "kind") return kindLabel(row.kind);
      if (key === "sort") return row.sortOrder;
      if (key === "status") return row.active ? 1 : 0;
      return "";
    });
  }, [modalities, modalityQuery, modalityKindFilter, modalityStatusFilter, modalitySort, locale, t]);

  const displayServices = useMemo(
    () =>
      sortRows(filteredServices, serviceSort, (row, key) => {
        if (key === "title") return localeTitle(row);
        if (key === "code") return row.code;
        if (key === "modality") return row.modality?.code ?? "";
        if (key === "category") return row.category ?? "";
        if (key === "serviceCode") return row.serviceCode ?? "";
        if (key === "analytes") return row.kind === "lab_panel" ? (row._count?.analytes ?? 0) : null;
        if (key === "status") return row.active ? 1 : 0;
        return "";
      }),
    [filteredServices, serviceSort, locale],
  );

  const favoriteKindOptions = useMemo(() => {
    const set = new Set(favoriteChoices.map((item) => item.kind).filter(Boolean));
    return [...set].sort();
  }, [favoriteChoices]);

  const visibleFavorites = useMemo(() => {
    const query = favQuery.trim().toLowerCase();
    return favoriteChoices.filter((item) => {
      if (favKindFilter && item.kind !== favKindFilter) return false;
      if (!query) return true;
      return [item.title.az, item.title.ru, item.title.en, item.code].some((value) =>
        String(value ?? "").toLowerCase().includes(query),
      );
    });
  }, [favoriteChoices, favQuery, favKindFilter]);

  const kindChoices = useMemo(() => {
    const set = new Set(CANON_KINDS);
    for (const row of modalities) if (row.kind) set.add(row.kind);
    for (const row of services) if (row.kind) set.add(row.kind);
    if (form.kind) set.add(form.kind);
    return [...set];
  }, [modalities, services, form.kind]);

  const visitModalityId = useMemo(
    () => modalities.find((m) => m.code === "VISIT" || m.kind === "visit")?.id ?? "",
    [modalities],
  );

  function toggleFavorite(key: string) {
    setFavKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function saveFavorites() {
    setFavSaving(true);
    const res = await fetch("/api/admin/catalog-favorites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keys: favKeys.filter((key) => key.startsWith("code:")),
        mode: favMode,
      }),
    });
    setFavSaving(false);
    if (res.ok) showSuccess(tFav("saved"));
    else showApiError(await res.json().catch(() => ({})), tFav("saveFailed"));
  }

  function openCreate() {
    setEditingId(null);
    setFormFields([]);
    setFinanceServiceQ("");
    setForm(
      tab === "services"
        ? {
            modalityId: serviceModalityFilter || modalities[0]?.id || "",
            kind: serviceKindFilter || "lab_panel",
            active: "true",
          }
        : { kind: "imaging", active: "true" },
    );
    setModalOpen(true);
  }

  function openEditModality(row: Modality) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      kind: row.kind,
      titleEn: row.titleEn,
      titleRu: row.titleRu,
      titleAz: row.titleAz,
      sortOrder: String(row.sortOrder),
      active: String(row.active),
    });
    setModalOpen(true);
  }

  function openAnalytes(row: DiagnosticService) {
    setSelectedServiceId(row.id);
    setPanelTitle(localeTitle(row));
    setAnalytesOpen(true);
  }

  function openFields(row: DiagnosticService) {
    setFieldsServiceId(row.id);
    setPanelTitle(localeTitle(row));
    setFormFields(parseCatalogFieldsJson(row.fieldsJson));
    setFieldsOpen(true);
  }

  function openEditService(row: DiagnosticService) {
    setEditingId(row.id);
    setFinanceServiceQ("");
    let includesText = "";
    try {
      includesText = row.includesJson ? (JSON.parse(row.includesJson) as string[]).join(", ") : "";
    } catch {
      includesText = "";
    }
    setForm({
      code: row.code,
      modalityId: row.modalityId,
      category: row.category,
      kind: row.kind,
      titleEn: row.titleEn,
      titleRu: row.titleRu,
      titleAz: row.titleAz,
      serviceCode: row.serviceCode,
      financeSku: row.financeSku ?? "",
      includes: includesText,
      sortOrder: String(row.sortOrder),
      active: String(row.active),
    });
    setModalOpen(true);
  }

  function openEditAnalyte(row: DiagnosticAnalyte) {
    setAnalyteEditOpen(true);
    setEditingId(row.id);
    setForm({
      code: row.code,
      unit: row.unit ?? "",
      labelEn: row.labelEn,
      labelRu: row.labelRu,
      labelAz: row.labelAz,
      refMin: row.refMin ?? "",
      refMax: row.refMax ?? "",
      section: row.section ?? "",
      valueType: row.valueType ?? "NUMERIC",
      valueOptionsJson: row.valueOptions?.length
        ? JSON.stringify(row.valueOptions, null, 2)
        : "",
      sortOrder: String(row.sortOrder),
    });
  }

  async function save() {
    if (tab === "modalities") {
      const payload = {
        code: form.code?.trim(),
        kind: form.kind?.trim(),
        titleEn: form.titleEn?.trim(),
        titleRu: form.titleRu?.trim(),
        titleAz: form.titleAz?.trim(),
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
        active: form.active === "false" ? false : true,
      };
      const url = editingId
        ? `/api/admin/diagnostic-catalog/modalities/${editingId}`
        : "/api/admin/diagnostic-catalog/modalities";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveFailed"));
        return;
      }
      setModalOpen(false);
      showSuccess(tc("saved"));
      await loadModalities();
      return;
    }

    if (tab === "services") {
      const includes = form.includes?.trim()
        ? form.includes.split(",").map((c) => c.trim()).filter(Boolean)
        : null;
      const payload = {
        code: form.code?.trim(),
        modalityId: form.modalityId,
        category: form.category?.trim() || "",
        kind: form.kind?.trim(),
        titleEn: form.titleEn?.trim(),
        titleRu: form.titleRu?.trim(),
        titleAz: form.titleAz?.trim(),
        serviceCode: form.serviceCode?.trim(),
        financeSku: form.financeSku?.trim() || null,
        includes,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
        active: form.active === "false" ? false : true,
      };
      const url = editingId
        ? `/api/admin/diagnostic-catalog/services/${editingId}`
        : "/api/admin/diagnostic-catalog/services";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveFailed"));
        return;
      }
      setModalOpen(false);
      showSuccess(tc("saved"));
      await loadServices();
    }
  }

  async function saveAnalyte() {
    if (!selectedServiceId) return;
      let valueOptions;
      if (form.valueOptionsJson?.trim()) {
        try {
          valueOptions = JSON.parse(form.valueOptionsJson);
        } catch {
          showApiError({ error: t("invalidValueOptions") });
          return;
        }
      }
      const code = form.code?.trim();
      if (
        !editingId &&
        code &&
        analytes.some((row) => row.code.toLowerCase() === code.toLowerCase())
      ) {
        showApiError({ error: t("analyteExists") });
        return;
      }
      const payload = {
        code,
        unit: form.unit?.trim() || null,
        labelEn: form.labelEn?.trim(),
        labelRu: form.labelRu?.trim(),
        labelAz: form.labelAz?.trim(),
        refMin: form.refMin?.trim() || null,
        refMax: form.refMax?.trim() || null,
        section: form.section?.trim() || null,
        valueType: form.valueType === "QUALITATIVE" ? "QUALITATIVE" : "NUMERIC",
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
        ...(valueOptions ? { valueOptions } : {}),
      };
      const url = editingId
        ? `/api/admin/diagnostic-catalog/services/${selectedServiceId}/analytes/${editingId}`
        : `/api/admin/diagnostic-catalog/services/${selectedServiceId}/analytes`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        showApiError(await res.json().catch(() => ({})), tc("saveFailed"));
        return;
      }
      setAnalyteEditOpen(false);
      showSuccess(tc("saved"));
      await loadAnalytes(selectedServiceId);
      await loadServices();
  }

  async function saveFields() {
    if (!fieldsServiceId) return;
    const fields = formFields
      .filter((f) => f.key.trim())
      .map((f) => ({
        ...f,
        key: f.key.trim(),
        label: {
          en: f.label?.en ?? "",
          ru: f.label?.ru ?? "",
          az: f.label?.az ?? "",
        },
      }));
    const res = await fetch(`/api/admin/diagnostic-catalog/services/${fieldsServiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: fields.length > 0 ? fields : null }),
    });
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), tc("saveFailed"));
      return;
    }
    setFieldsOpen(false);
    showSuccess(tc("saved"));
    await loadServices();
  }

  function startNewAnalyte() {
    if (!selectedServiceId) return;
    setAnalyteEditOpen(true);
    setEditingId(null);
    setDictionaryQ("");
    setDictionaryPick(null);
    setForm({ valueType: "NUMERIC" });
  }

  function applyDictionary(code: string) {
    if (!code) {
      setDictionaryPick(null);
      return;
    }
    const row =
      dictionaryItems.find((item) => item.code === code) ??
      (dictionaryPick?.code === code ? dictionaryPick : null);
    if (!row) return;
    setDictionaryPick(row);
    setForm((prev) => ({
      ...prev,
      code: row.code,
      unit: row.unit ?? "",
      labelEn: row.labelEn,
      labelRu: row.labelRu,
      labelAz: row.labelAz,
      refMin: row.refMin ?? "",
      refMax: row.refMax ?? "",
      section: row.section ?? "",
      valueType: row.valueType === "QUALITATIVE" ? "QUALITATIVE" : "NUMERIC",
      valueOptionsJson: row.optionsJson ?? "",
    }));
  }

  function dictionaryLabel(row: DictionaryAnalyte) {
    const name = locale.startsWith("ru")
      ? row.labelRu
      : locale.startsWith("az")
        ? row.labelAz
        : row.labelEn;
    return row.unit ? `${row.code} — ${name} · ${row.unit}` : `${row.code} — ${name}`;
  }

  async function toggleModalityActive(row: Modality) {
    await fetch(`/api/admin/diagnostic-catalog/modalities/${row.id}`, {
      method: row.active ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: row.active ? undefined : JSON.stringify({ active: true }),
    });
    await loadModalities();
  }

  async function toggleServiceActive(row: DiagnosticService) {
    await fetch(`/api/admin/diagnostic-catalog/services/${row.id}`, {
      method: row.active ? "DELETE" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: row.active ? undefined : JSON.stringify({ active: true }),
    });
    await loadServices();
  }

  async function removeAnalyte(id: string) {
    if (!selectedServiceId) return;
    if (!window.confirm(tc("confirmDelete"))) return;
    const res = await fetch(
      `/api/admin/diagnostic-catalog/services/${selectedServiceId}/analytes/${id}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      showApiError(await res.json().catch(() => ({})), tc("failed"));
      return;
    }
    await loadAnalytes(selectedServiceId);
    await loadServices();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "modalities", label: t("tabModalities") },
    { id: "services", label: t("tabServices") },
    { id: "favorites", label: t("tabFavorites") },
  ];

  const showAddButton = tab === "modalities" || tab === "services";

  return (
    <>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          showAddButton ? (
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              {tc("add")}
            </button>
          ) : tab === "favorites" ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={favSaving}
              onClick={() => void saveFavorites()}
            >
              {tc("save")}
            </button>
          ) : null
        }
      />
      <div className={TAB_STRIP_CLASS}>
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            className={tab === x.id ? TAB_ITEM_ACTIVE_CLASS : TAB_ITEM_CLASS}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      {tab === "modalities" && (
        <div className="space-y-3">
          <EraListFilterBar
            resetLabel={tc("filterReset")}
            onReset={() => {
              setModalityQuery("");
              setModalityKindFilter("");
              setModalityStatusFilter("");
            }}
          >
            <Field
              label={tc("search")}
              preset="shortText"
              value={modalityQuery}
              onChange={(e) => setModalityQuery(e.target.value)}
            />
            <FieldSelect
              label={t("filterKind")}
              preset="select"
              value={modalityKindFilter}
              onChange={(e) => setModalityKindFilter(e.target.value)}
              className="max-w-xs"
            >
              <option value="">{t("allKinds")}</option>
              {modalityKindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {kindLabel(kind)}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              label={t("status")}
              preset="select"
              value={modalityStatusFilter}
              onChange={(e) => setModalityStatusFilter(e.target.value)}
              className="max-w-xs"
            >
              <option value="">{t("allStatuses")}</option>
              <option value="active">{t("statusActive")}</option>
              <option value="inactive">{t("statusInactive")}</option>
            </FieldSelect>
          </EraListFilterBar>
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <SortableTh
                    label={t("columnTitle")}
                    columnKey="title"
                    sort={modalitySort}
                    onSort={(key) => setModalitySort((current) => toggleColumnSort(current, key))}
                  />
                  <SortableTh
                    label={t("code")}
                    columnKey="code"
                    sort={modalitySort}
                    onSort={(key) => setModalitySort((current) => toggleColumnSort(current, key))}
                  />
                  <SortableTh
                    label={t("kind")}
                    columnKey="kind"
                    sort={modalitySort}
                    onSort={(key) => setModalitySort((current) => toggleColumnSort(current, key))}
                  />
                  <SortableTh
                    label={t("sortOrder")}
                    columnKey="sort"
                    sort={modalitySort}
                    onSort={(key) => setModalitySort((current) => toggleColumnSort(current, key))}
                  />
                  <SortableTh
                    label={t("status")}
                    columnKey="status"
                    sort={modalitySort}
                    onSort={(key) => setModalitySort((current) => toggleColumnSort(current, key))}
                  />
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleModalities.map((row) => (
                  <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{localeTitle(row)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{kindLabel(row.kind)}</td>
                    <td className={DATA_TABLE_TD_CLASS}>{row.sortOrder}</td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      {row.active ? (
                        <span className={TEXT_SUCCESS_CLASS}>{t("statusActive")}</span>
                      ) : (
                        <span className={TEXT_DANGER_CLASS}>{t("statusInactive")}</span>
                      )}
                    </td>
                    <td className={DATA_TABLE_TD_CLASS}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={tc("edit")}
                          onClick={() => openEditModality(row)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className={TABLE_ROW_ICON_BTN_CLASS}
                          aria-label={row.active ? tc("delete") : t("restore")}
                          onClick={() => void toggleModalityActive(row)}
                        >
                          {row.active ? (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {visibleModalities.length === 0 ? (
                  <tr>
                    <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`} colSpan={6}>
                      {modalityQuery.trim() || modalityKindFilter || modalityStatusFilter
                        ? tc("notFound")
                        : t("emptyModalities")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {tab === "services" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field
              label={tc("search")}
              preset="shortText"
              value={serviceQuery}
              onChange={(e) => setServiceQuery(e.target.value)}
              className="max-w-xs"
            />
            <FieldSelect
              label={t("filterModality")}
              preset="select"
              value={serviceModalityFilter}
              onChange={(e) => setServiceModalityFilter(e.target.value)}
              className="max-w-xs"
            >
              <option value="">{t("allModalities")}</option>
              {modalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {localeTitle(m)}
                </option>
              ))}
            </FieldSelect>
            <FieldSelect
              label={t("filterKind")}
              preset="select"
              value={serviceKindFilter}
              onChange={(e) => setServiceKindFilter(e.target.value)}
              className="max-w-xs"
            >
              <option value="">{t("allKinds")}</option>
              {kindOptions.map((k) => (
                <option key={k} value={k}>
                  {kindLabel(k)}
                </option>
              ))}
            </FieldSelect>
            {visitModalityId ? (
              <button
                type="button"
                className={
                  serviceModalityFilter === visitModalityId && serviceKindFilter === "visit"
                    ? PRIMARY_BUTTON_CLASS
                    : SECONDARY_BUTTON_CLASS
                }
                onClick={() => {
                  setServiceModalityFilter(visitModalityId);
                  setServiceKindFilter("visit");
                }}
              >
                {t("filterVisitTemplates")}
              </button>
            ) : null}
          </div>
          <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
            <div className={DATA_TABLE_VIEWPORT_CLASS}>
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <SortableTh
                    label={t("columnTitle")}
                    columnKey="title"
                    sort={serviceSort}
                    onSort={(key) => setServiceSort((current) => toggleColumnSort(current, key))}
                  />
                    <SortableTh
                    label={t("code")}
                    columnKey="code"
                    sort={serviceSort}
                    onSort={(key) => setServiceSort((current) => toggleColumnSort(current, key))}
                  />
                    <SortableTh
                    label={t("modality")}
                    columnKey="modality"
                    sort={serviceSort}
                    onSort={(key) => setServiceSort((current) => toggleColumnSort(current, key))}
                  />
                    <SortableTh
                    label={t("category")}
                    columnKey="category"
                    sort={serviceSort}
                    onSort={(key) => setServiceSort((current) => toggleColumnSort(current, key))}
                  />
                    <SortableTh
                    label={t("serviceCode")}
                    columnKey="serviceCode"
                    sort={serviceSort}
                    onSort={(key) => setServiceSort((current) => toggleColumnSort(current, key))}
                  />
                    <SortableTh
                    label={t("analytesCount")}
                    columnKey="analytes"
                    sort={serviceSort}
                    onSort={(key) => setServiceSort((current) => toggleColumnSort(current, key))}
                  />
                    <SortableTh
                    label={t("status")}
                    columnKey="status"
                    sort={serviceSort}
                    onSort={(key) => setServiceSort((current) => toggleColumnSort(current, key))}
                  />
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayServices.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{localeTitle(row)}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.modality?.code ?? "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.category || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.serviceCode}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.kind === "lab_panel" ? (row._count?.analytes ?? 0) : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.active ? (
                          <span className={TEXT_SUCCESS_CLASS}>{t("statusActive")}</span>
                        ) : (
                          <span className={TEXT_DANGER_CLASS}>{t("statusInactive")}</span>
                        )}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="flex gap-1">
                          {row.kind === "lab_panel" ? (
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("manageAnalytes")}
                              onClick={() => openAnalytes(row)}
                            >
                              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : null}
                          {FORM_FIELD_KINDS.has(row.kind) ? (
                            <button
                              type="button"
                              className={TABLE_ROW_ICON_BTN_CLASS}
                              aria-label={t("fields")}
                              onClick={() => openFields(row)}
                            >
                              <TextCursorInput className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={tc("edit")}
                            onClick={() => openEditService(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={row.active ? tc("delete") : t("restore")}
                            onClick={() => void toggleServiceActive(row)}
                          >
                            {row.active ? (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {displayServices.length === 0 ? (
                    <tr>
                      <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`} colSpan={8}>
                        {serviceQuery.trim() || serviceKindFilter || serviceModalityFilter
                          ? tc("notFound")
                          : t("emptyServices")}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "favorites" && (
        <div className={`${CARD_CONTAINER_CLASS} space-y-6 p-6`}>
          {favLoading ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("loading")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-[13px] font-medium">{tFav("displayMode")}</p>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="favMode"
                    className={MODAL_CHECKBOX_CLASS}
                    checked={favMode === "first"}
                    onChange={() => setFavMode("first")}
                  />
                  {tFav("modeFirst")}
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="radio"
                    name="favMode"
                    className={MODAL_CHECKBOX_CLASS}
                    checked={favMode === "only"}
                    onChange={() => setFavMode("only")}
                  />
                  {tFav("modeOnly")}
                </label>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium">{tFav("services")}</p>
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  <Field
                    label={tc("search")}
                    preset="shortText"
                    value={favQuery}
                    onChange={(e) => setFavQuery(e.target.value)}
                    className="max-w-xs"
                  />
                  <FieldSelect
                    label={t("filterKind")}
                    preset="select"
                    value={favKindFilter}
                    onChange={(e) => setFavKindFilter(e.target.value)}
                    className="max-w-xs"
                  >
                    <option value="">{t("allKinds")}</option>
                    {favoriteKindOptions.map((kind) => (
                      <option key={kind} value={kind}>
                        {kindLabel(kind)}
                      </option>
                    ))}
                  </FieldSelect>
                </div>
                <ul className={`${CARD_CONTAINER_CLASS} max-h-96 space-y-1 overflow-y-auto p-2`}>
                  {visibleFavorites.map((item) => {
                    const key = `code:${item.code}`;
                    return (
                      <li key={key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px]">
                          <input
                            type="checkbox"
                            className={MODAL_CHECKBOX_CLASS}
                            checked={favKeys.includes(key)}
                            onChange={() => toggleFavorite(key)}
                          />
                          <span className="flex-1">
                            {pickL10n(item.title, locale)} · {item.code}
                          </span>
                          <span className={`text-[11px] ${TEXT_MUTED_CLASS}`}>{kindLabel(item.kind)}</span>
                        </label>
                      </li>
                    );
                  })}
                  {visibleFavorites.length === 0 && (favQuery.trim() || favKindFilter) ? (
                    <li className={`px-2 py-1.5 text-[13px] ${TEXT_MUTED_CLASS}`}>{tc("notFound")}</li>
                  ) : null}
                </ul>
              </div>

              <p className={`text-[12px] ${TEXT_MUTED_CLASS}`}>{tFav("hint")}</p>
            </>
          )}
        </div>
      )}

      <ModalShell
        open={modalOpen}
        title={editingId ? tc("edit") : tc("add")}
        onClose={() => setModalOpen(false)}
      >
        <div className="space-y-4">
          {tab === "modalities" && (
            <>
              {!editingId ? (
                <Field
                  label={t("code")}
                  preset="code"
                  value={form.code ?? ""}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              ) : null}
              <FieldSelect
                label={t("kind")}
                preset="select"
                value={form.kind ?? ""}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              >
                {kindChoices.map((kind) => (
                  <option key={kind} value={kind}>
                    {kindLabel(kind)}
                  </option>
                ))}
              </FieldSelect>
              <Field
                label={t("titleEn")}
                preset="shortText"
                value={form.titleEn ?? ""}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              />
              <Field
                label={t("titleRu")}
                preset="shortText"
                value={form.titleRu ?? ""}
                onChange={(e) => setForm({ ...form, titleRu: e.target.value })}
              />
              <Field
                label={t("titleAz")}
                preset="shortText"
                value={form.titleAz ?? ""}
                onChange={(e) => setForm({ ...form, titleAz: e.target.value })}
              />
              <Field
                label={t("sortOrder")}
                preset="count"
                value={form.sortOrder ?? "0"}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </>
          )}

          {tab === "services" && (
            <>
              {!editingId ? (
                <Field
                  label={t("code")}
                  preset="code"
                  value={form.code ?? ""}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              ) : null}
              <FieldSelect
                label={t("modality")}
                preset="select"
                value={form.modalityId ?? ""}
                onChange={(e) => setForm({ ...form, modalityId: e.target.value })}
              >
                <option value="">{tc("select")}</option>
                {modalities.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} — {m.titleEn}
                  </option>
                ))}
              </FieldSelect>
              <FieldRow cols={2}>
                <Field
                  label={t("category")}
                  preset="shortText"
                  value={form.category ?? ""}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
                <FieldSelect
                  label={t("kind")}
                  preset="select"
                  value={form.kind ?? ""}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                >
                  {kindChoices.map((kind) => (
                    <option key={kind} value={kind}>
                      {kindLabel(kind)}
                    </option>
                  ))}
                </FieldSelect>
              </FieldRow>
              <Field
                label={t("titleEn")}
                preset="shortText"
                value={form.titleEn ?? ""}
                onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
              />
              <Field
                label={t("titleRu")}
                preset="shortText"
                value={form.titleRu ?? ""}
                onChange={(e) => setForm({ ...form, titleRu: e.target.value })}
              />
              <Field
                label={t("titleAz")}
                preset="shortText"
                value={form.titleAz ?? ""}
                onChange={(e) => setForm({ ...form, titleAz: e.target.value })}
              />
              <Field
                label={t("serviceCode")}
                preset="code"
                hint={t("serviceCodeHint")}
                value={form.serviceCode ?? ""}
                onChange={(e) => setForm({ ...form, serviceCode: e.target.value })}
              />
              <CatalogField
                kind="SEARCHABLE"
                label={t("financeSku")}
                value={form.financeSku ?? ""}
                serverSearch
                onQueryChange={setFinanceServiceQ}
                options={
                  form.financeSku &&
                  !financeServiceOptions.some((option) => option.value === form.financeSku)
                    ? [{ value: form.financeSku, label: form.financeSku }, ...financeServiceOptions]
                    : financeServiceOptions
                }
                onChange={(next) => setForm({ ...form, financeSku: String(next ?? "") })}
              />
              <Field
                label={t("includes")}
                preset="shortText"
                hint={t("includesHint")}
                value={form.includes ?? ""}
                onChange={(e) => setForm({ ...form, includes: e.target.value })}
              />
              <Field
                label={t("sortOrder")}
                preset="count"
                value={form.sortOrder ?? "0"}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
            </>
          )}
        </div>
        <ModalFooter
          onCancel={() => setModalOpen(false)}
          cancelLabel={tc("cancel")}
          onSubmit={() => void save()}
          submitLabel={tc("save")}
        />
      </ModalShell>

      <ModalShell
        open={analytesOpen}
        title={t("analytesFor", { service: panelTitle })}
        closeLabel={tc("close")}
        onClose={() => setAnalytesOpen(false)}
        maxWidthClass="max-w-4xl w-full max-h-[90vh]"
        bodyClassName="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 justify-end">
            <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={startNewAnalyte}>
              {tc("add")}
            </button>
          </div>
          {analytes.length === 0 ? (
            <p className={`text-[13px] ${TEXT_MUTED_CLASS}`}>{t("emptyAnalytes")}</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <table className={DATA_TABLE_CLASS}>
                <thead>
                  <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("columnTitle")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("unit")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("refMin")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("refMax")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("section")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("valueType")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("valueOptions")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sortOrder")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {analytes.map((row) => (
                    <tr key={row.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>{row.code}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {(locale.startsWith("ru")
                          ? row.labelRu
                          : locale.startsWith("az")
                            ? row.labelAz
                            : row.labelEn) || row.labelEn}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.unit || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.refMin || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.refMax || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.section || "—"}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.valueType === "QUALITATIVE"
                          ? t("valueTypeQualitative")
                          : t("valueTypeNumeric")}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        {row.valueOptions?.length
                          ? row.valueOptions.map((opt) => opt.code).join(", ")
                          : "—"}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>{row.sortOrder}</td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={tc("edit")}
                            onClick={() => openEditAnalyte(row)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className={TABLE_ROW_ICON_BTN_CLASS}
                            aria-label={tc("delete")}
                            onClick={() => void removeAnalyte(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ModalShell>

      <ModalShell
        open={analyteEditOpen}
        title={editingId ? tc("edit") : tc("add")}
        closeLabel={tc("close")}
        onClose={() => setAnalyteEditOpen(false)}
      >
        <div className="space-y-4">
              {!editingId ? (
                <CatalogField
                  kind="SEARCHABLE"
                  label={t("dictionarySearch")}
                  hint={t("dictionarySearchHint")}
                  value={dictionaryPick?.code ?? ""}
                  serverSearch
                  onQueryChange={setDictionaryQ}
                  options={[
                    ...(dictionaryPick &&
                    !dictionaryItems.some((row) => row.code === dictionaryPick.code)
                      ? [
                          {
                            value: dictionaryPick.code,
                            label: dictionaryLabel(dictionaryPick),
                          },
                        ]
                      : []),
                    ...dictionaryItems.map((row) => ({
                      value: row.code,
                      label: dictionaryLabel(row),
                    })),
                  ]}
                  onChange={(next) => applyDictionary(String(next ?? ""))}
                />
              ) : null}
              <Field
                label={t("code")}
                preset="code"
                value={form.code ?? ""}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
              <Field
                label={t("unit")}
                preset="shortText"
                value={form.unit ?? ""}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
              <Field
                label={t("section")}
                preset="shortText"
                value={form.section ?? ""}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
              />
              <FieldSelect
                label={t("valueType")}
                preset="select"
                value={form.valueType ?? "NUMERIC"}
                onChange={(e) => setForm({ ...form, valueType: e.target.value })}
              >
                <option value="NUMERIC">{t("valueTypeNumeric")}</option>
                <option value="QUALITATIVE">{t("valueTypeQualitative")}</option>
              </FieldSelect>
              <FieldTextarea
                label={t("valueOptions")}
                hint={t("valueOptionsHint")}
                value={form.valueOptionsJson ?? ""}
                onChange={(e) => setForm({ ...form, valueOptionsJson: e.target.value })}
              />
              <Field
                label={t("labelEn")}
                preset="shortText"
                value={form.labelEn ?? ""}
                onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
              />
              <Field
                label={t("labelRu")}
                preset="shortText"
                value={form.labelRu ?? ""}
                onChange={(e) => setForm({ ...form, labelRu: e.target.value })}
              />
              <Field
                label={t("labelAz")}
                preset="shortText"
                value={form.labelAz ?? ""}
                onChange={(e) => setForm({ ...form, labelAz: e.target.value })}
              />
              <FieldRow cols={2}>
                <Field
                  label={t("refMin")}
                  preset="shortText"
                  value={form.refMin ?? ""}
                  onChange={(e) => setForm({ ...form, refMin: e.target.value })}
                />
                <Field
                  label={t("refMax")}
                  preset="shortText"
                  value={form.refMax ?? ""}
                  onChange={(e) => setForm({ ...form, refMax: e.target.value })}
                />
              </FieldRow>
              <Field
                label={t("sortOrder")}
                preset="count"
                value={form.sortOrder ?? "0"}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
        </div>
        <ModalFooter
          onCancel={() => setAnalyteEditOpen(false)}
          cancelLabel={tc("cancel")}
          onSubmit={() => void saveAnalyte()}
          submitLabel={tc("save")}
        />
      </ModalShell>

      <ModalShell
        open={fieldsOpen}
        title={t("fieldsFor", { service: panelTitle })}
        closeLabel={tc("close")}
        onClose={() => setFieldsOpen(false)}
        maxWidthClass="max-w-4xl w-full max-h-[90vh]"
        bodyClassName="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
        footer={
          <ModalFooter
            onCancel={() => setFieldsOpen(false)}
            cancelLabel={tc("cancel")}
            onSubmit={() => void saveFields()}
            submitLabel={tc("save")}
          />
        }
      >
        <CatalogFieldsEditor
          value={formFields}
          onChange={setFormFields}
          locale={locale}
          labels={{
            fieldsTitle: t("fieldsEditorTitle"),
            addField: t("addField"),
            key: t("fieldKey"),
            type: t("fieldType"),
            labelEn: t("titleEn"),
            labelRu: t("titleRu"),
            labelAz: t("titleAz"),
            columnTitle: t("columnTitle"),
            unit: t("unit"),
            required: t("fieldRequired"),
            options: t("fieldOptions"),
            optionsHint: t("fieldOptionsHint"),
            moveUp: t("moveUp"),
            moveDown: t("moveDown"),
            empty: t("fieldsEmpty"),
            remove: tc("delete"),
            actions: tc("actions"),
            edit: tc("edit"),
            add: tc("add"),
            cancel: tc("cancel"),
            save: tc("save"),
            close: tc("close"),
          }}
        />
      </ModalShell>
    </>
  );
}
