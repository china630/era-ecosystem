"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  Field,
  FieldRow,
  FieldSelect,
  FieldTextarea,
  MODAL_CHECKBOX_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
  TAB_ITEM_ACTIVE_CLASS,
  TAB_ITEM_CLASS,
  TAB_STRIP_CLASS,
  TABLE_ROW_ICON_BTN_CLASS,
  TEXT_DANGER_CLASS,
  TEXT_MUTED_CLASS,
  TEXT_SUCCESS_CLASS,
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
  fieldsJson?: string | null;
  includesJson?: string | null;
  sortOrder: number;
  active: boolean;
  _count?: { analytes?: number };
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
  const [analyteMode, setAnalyteMode] = useState(false);
  const [serviceFormStash, setServiceFormStash] = useState<Record<string, string> | null>(null);
  const [favMode, setFavMode] = useState<"first" | "only">("first");
  const [favLoading, setFavLoading] = useState(true);
  const [favSaving, setFavSaving] = useState(false);
  const [favMsg, setFavMsg] = useState<string | null>(null);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [services, setServices] = useState<DiagnosticService[]>([]);
  const [analytes, setAnalytes] = useState<DiagnosticAnalyte[]>([]);
  const [serviceModalityFilter, setServiceModalityFilter] = useState("");
  const [serviceKindFilter, setServiceKindFilter] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formFields, setFormFields] = useState<CatalogFieldDef[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

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
    if (!serviceKindFilter) return orderableServices;
    return orderableServices.filter((s) => s.kind === serviceKindFilter);
  }, [orderableServices, serviceKindFilter]);

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

  const visitModalityId = useMemo(
    () => modalities.find((m) => m.code === "VISIT" || m.kind === "visit")?.id ?? "",
    [modalities],
  );

  function toggleFavorite(key: string) {
    setFavKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function saveFavorites() {
    setFavSaving(true);
    setFavMsg(null);
    const res = await fetch("/api/admin/catalog-favorites", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keys: favKeys.filter((key) => key.startsWith("code:")),
          mode: favMode,
        }),
    });
    setFavSaving(false);
    setFavMsg(res.ok ? tFav("saved") : tFav("saveFailed"));
  }

  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  function openCreate() {
    setAnalyteMode(false);
    setEditingId(null);
    setFormFields([]);
    setForm(
      tab === "services"
        ? {
            modalityId: serviceModalityFilter || modalities[0]?.id || "",
            kind: serviceKindFilter || "",
            active: "true",
          }
        : { active: "true" },
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

  function openEditService(row: DiagnosticService) {
    setAnalyteMode(false);
    setEditingId(row.id);
    if (row.kind === "lab_panel") setSelectedServiceId(row.id);
    setFormFields(parseCatalogFieldsJson(row.fieldsJson));
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
      includes: includesText,
      sortOrder: String(row.sortOrder),
      active: String(row.active),
    });
    setModalOpen(true);
  }

  function openEditAnalyte(row: DiagnosticAnalyte) {
    setServiceFormStash(form);
    setAnalyteMode(true);
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
    setModalOpen(true);
  }

  async function save() {
    setMsg(null);
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
        setMsg(tc("saveFailed"));
        return;
      }
      setModalOpen(false);
      setMsg(tc("saved"));
      await loadModalities();
      return;
    }

    if (tab === "services") {
      const fields =
        formFields.length > 0
          ? formFields.filter((f) => f.key.trim()).map((f) => ({
              ...f,
              key: f.key.trim(),
              label: {
                en: f.label?.en ?? "",
                ru: f.label?.ru ?? "",
                az: f.label?.az ?? "",
              },
            }))
          : null;
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
        fields,
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
        setMsg(tc("saveFailed"));
        return;
      }
      setModalOpen(false);
      setMsg(tc("saved"));
      await loadServices();
      return;
    }

    if (analyteMode && selectedServiceId) {
      let valueOptions;
      if (form.valueOptionsJson?.trim()) {
        try {
          valueOptions = JSON.parse(form.valueOptionsJson);
        } catch {
          setMsg(t("invalidValueOptions"));
          return;
        }
      }
      const payload = {
        code: form.code?.trim(),
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
        setMsg(tc("saveFailed"));
        return;
      }
      setAnalyteMode(false);
      if (serviceFormStash) setForm(serviceFormStash);
      setEditingId(selectedServiceId);
      setMsg(tc("saved"));
      await loadAnalytes(selectedServiceId);
    }
  }

  function startNewAnalyte() {
    if (!selectedServiceId) return;
    setServiceFormStash(form);
    setAnalyteMode(true);
    setEditingId(null);
    setForm({ valueType: "NUMERIC" });
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
    await fetch(`/api/admin/diagnostic-catalog/services/${selectedServiceId}/analytes/${id}`, {
      method: "DELETE",
    });
    await loadAnalytes(selectedServiceId);
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
      {msg ? <p className="mb-3 text-[13px]">{msg}</p> : null}
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
        <div className={`${CARD_CONTAINER_CLASS} space-y-3 p-4`}>
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={DATA_TABLE_CLASS}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("columnTitle")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("kind")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("sortOrder")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("status")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {modalities.map((row) => (
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
                {modalities.length === 0 ? (
                  <tr>
                    <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`} colSpan={6}>
                      {t("emptyModalities")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "services" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
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
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("columnTitle")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("code")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("modality")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("category")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("serviceCode")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("analytesCount")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("status")}</th>
                    <th className={DATA_TABLE_TH_LEFT_CLASS}>{tc("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((row) => (
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
                  {filteredServices.length === 0 ? (
                    <tr>
                      <td className={`${DATA_TABLE_TD_CLASS} ${TEXT_MUTED_CLASS}`} colSpan={8}>
                        {t("emptyServices")}
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
                <ul className={`${CARD_CONTAINER_CLASS} max-h-96 space-y-1 overflow-y-auto p-2`}>
                  {favoriteChoices.map((item) => {
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
                </ul>
              </div>

              {favMsg ? <p className={`text-[13px] ${TEXT_SUCCESS_CLASS}`}>{favMsg}</p> : null}
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
              <Field
                label={t("kind")}
                preset="code"
                value={form.kind ?? ""}
                onChange={(e) => setForm({ ...form, kind: e.target.value })}
              />
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

          {tab === "services" && !analyteMode && (
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
                <Field
                  label={t("kind")}
                  preset="code"
                  value={form.kind ?? ""}
                  onChange={(e) => setForm({ ...form, kind: e.target.value })}
                />
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
              <Field
                label={t("includes")}
                preset="shortText"
                hint={t("includesHint")}
                value={form.includes ?? ""}
                onChange={(e) => setForm({ ...form, includes: e.target.value })}
              />
              <CatalogFieldsEditor
                value={formFields}
                onChange={setFormFields}
                labels={{
                  fieldsTitle: t("fieldsEditorTitle"),
                  addField: t("addField"),
                  key: t("fieldKey"),
                  type: t("fieldType"),
                  labelEn: t("titleEn"),
                  labelRu: t("titleRu"),
                  labelAz: t("titleAz"),
                  unit: t("unit"),
                  required: t("fieldRequired"),
                  options: t("fieldOptions"),
                  optionsHint: t("fieldOptionsHint"),
                  moveUp: t("moveUp"),
                  moveDown: t("moveDown"),
                  empty: t("fieldsEmpty"),
                  remove: tc("delete"),
                }}
              />
              <Field
                label={t("sortOrder")}
                preset="count"
                value={form.sortOrder ?? "0"}
                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              />
              {editingId && form.kind === "lab_panel" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium">{t("tabAnalytes")}</p>
                    <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={startNewAnalyte}>
                      {tc("add")}
                    </button>
                  </div>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-[13px]">
                    {analytes.map((row) => (
                      <li key={row.id} className="flex items-center gap-2">
                        <span className="flex-1">
                          {(locale.startsWith("ru")
                            ? row.labelRu
                            : locale.startsWith("az")
                              ? row.labelAz
                              : row.labelEn) || row.labelEn}{" "}
                          · {row.code}
                        </span>
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
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}

          {analyteMode && (
            <>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  setAnalyteMode(false);
                  if (serviceFormStash) setForm(serviceFormStash);
                  setEditingId(selectedServiceId);
                }}
              >
                {t("tabServices")}
              </button>
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
    </>
  );
}
