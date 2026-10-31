"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CatalogField } from "@era/satellite-kit/ui";
import { apiFetch } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { isRestrictedUserRole } from "../../../lib/role-utils";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { subscribeListRefresh } from "../../../lib/list-refresh-bus";
import { PageHeader } from "../../../components/layout/page-header";
import { NewWarehouseModal } from "../../../components/inventory/modals";
import {
  CARD_CONTAINER_CLASS,
  DATA_TABLE_CLASS,
  DATA_TABLE_HEAD_ROW_CLASS,
  DATA_TABLE_TD_CLASS,
  DATA_TABLE_TH_LEFT_CLASS,
  DATA_TABLE_TR_CLASS,
  DATA_TABLE_VIEWPORT_CLASS,
  INPUT_BORDERED_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "../../../lib/design-system";

type Warehouse = {
  id: string;
  name: string;
  code?: string | null;
  location: string;
  costClass?: string | null;
  satelliteOutletCode?: string | null;
};
type WarehouseBin = {
  id: string;
  warehouseId: string;
  code: string;
  barcode?: string | null;
  warehouse?: { id: string; name: string };
};

const COST_CLASS_OPTIONS = [
  "FOOD",
  "CHEMICAL",
  "CONSUMABLE",
  "TABLEWARE",
  "INVENTORY_GT",
] as const;

type WhScopeDraft = { code: string; costClass: string; satelliteOutletCode: string };

export default function InventorySettingsPage() {
  const { t } = useTranslation();
  const { token, ready } = useRequireAuth();
  const { user } = useAuth();
  const hideSettings = isRestrictedUserRole(user?.role ?? undefined);

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [whScopeDraft, setWhScopeDraft] = useState<Record<string, WhScopeDraft>>({});
  const [whScopeSavingId, setWhScopeSavingId] = useState<string | null>(null);
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [settings, setSettings] = useState<{
    allowNegativeStock?: boolean;
    defaultWarehouseId?: string | null;
    defaultWarehouseResolvedId?: string | null;
    inventoryValuationMethod?: string | null;
  } | null>(null);
  const [allowNeg, setAllowNeg] = useState(false);
  const [defWh, setDefWh] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [binWh, setBinWh] = useState("");
  const [binCode, setBinCode] = useState("");
  const [binBarcode, setBinBarcode] = useState("");
  const [binSaving, setBinSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newWhOpen, setNewWhOpen] = useState(false);
  const [whFilter, setWhFilter] = useState<"ALL" | "FOOD" | "NON_FOOD">("ALL");

  const costClassOptions = useMemo(
    () => [
      { value: "", label: t("common.none", "—") },
      ...COST_CLASS_OPTIONS.map((c) => ({
        value: c,
        label: t(`inventory.costClass.${c}`, c),
      })),
    ],
    [t],
  );

  const LAB_OUTLET_DEFAULTS = useMemo(() => ["NAFTANI", "XUDMANI", "KAFE"], []);

  const outletCodeOptions = useMemo(() => {
    const codes = new Set<string>(LAB_OUTLET_DEFAULTS);
    for (const wh of warehouses) {
      const c = wh.satelliteOutletCode?.trim();
      if (c) codes.add(c);
    }
    for (const draft of Object.values(whScopeDraft)) {
      const c = draft.satelliteOutletCode?.trim();
      if (c) codes.add(c);
    }
    return [...codes]
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ value: c, label: c }));
  }, [warehouses, whScopeDraft, LAB_OUTLET_DEFAULTS]);

  const filteredWarehouses = useMemo(() => {
    if (whFilter === "ALL") return warehouses;
    if (whFilter === "FOOD") return warehouses.filter((w) => w.costClass === "FOOD");
    return warehouses.filter((w) => w.costClass && w.costClass !== "FOOD");
  }, [warehouses, whFilter]);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [w, cfg, b] = await Promise.all([
        apiFetch("/api/inventory/warehouses"),
        apiFetch("/api/inventory/settings"),
        apiFetch("/api/inventory/bins"),
      ]);
      if (!w.ok) throw new Error(`warehouses ${w.status}`);
      const whList = (await w.json()) as Warehouse[];
      setWarehouses(whList);
      setWhScopeDraft(
        Object.fromEntries(
          whList.map((wh) => [
            wh.id,
            {
              code: wh.code ?? "",
              costClass: wh.costClass ?? "",
              satelliteOutletCode: wh.satelliteOutletCode ?? "",
            },
          ]),
        ),
      );
      if (b.ok) {
        setBins((await b.json()) as WarehouseBin[]);
      }
      if (cfg.ok) {
        const j = await cfg.json();
        setSettings(j);
        setAllowNeg(!!j.allowNegativeStock);
        setDefWh(typeof j.defaultWarehouseId === "string" ? j.defaultWarehouseId : "");
        const fallbackWh =
          (typeof j.defaultWarehouseId === "string" && j.defaultWarehouseId) ||
          (typeof j.defaultWarehouseResolvedId === "string" && j.defaultWarehouseResolvedId) ||
          "";
        if (fallbackWh) setBinWh((v) => v || fallbackWh);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (!ready || !token) return;
    void load();
  }, [load, ready, token]);

  useEffect(() => {
    if (!ready || !token) return;
    return subscribeListRefresh("inventory-hub", () => void load());
  }, [load, ready, token]);

  useEffect(() => {
    // Chef deep-link from buffet-food-cost ISSUES_ONLY / empty FOOD → focus FOOD WH rows.
    if (typeof window === "undefined") return;
    if (window.location.hash === "#warehouses") {
      setWhFilter("FOOD");
    }
  }, []);

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      const res = await apiFetch("/api/inventory/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowNegativeStock: allowNeg,
          defaultWarehouseId: defWh.trim() ? defWh.trim() : null,
        }),
      });
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: await res.text() });
        return;
      }
      toast.success(t("common.save"));
      await load();
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveWarehouseScope(warehouseId: string) {
    const draft = whScopeDraft[warehouseId];
    if (!draft) return;
    setWhScopeSavingId(warehouseId);
    try {
      const res = await apiFetch(`/api/inventory/warehouses/${warehouseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: draft.code.trim() ? draft.code.trim() : null,
          costClass: draft.costClass.trim() ? draft.costClass.trim() : null,
          satelliteOutletCode: draft.satelliteOutletCode.trim()
            ? draft.satelliteOutletCode.trim()
            : null,
        }),
      });
      if (!res.ok) {
        toast.error(t("common.saveErr"), { description: await res.text() });
        return;
      }
      toast.success(t("common.save"));
      await load();
    } finally {
      setWhScopeSavingId(null);
    }
  }

  async function createBin() {
    if (!binWh || !binCode.trim()) {
      toast.error(t("inventory.binNeedFields"));
      return;
    }
    setBinSaving(true);
    const res = await apiFetch("/api/inventory/bins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        warehouseId: binWh,
        code: binCode.trim(),
        barcode: binBarcode.trim() || undefined,
      }),
    });
    setBinSaving(false);
    if (!res.ok) {
      toast.error(t("common.saveErr"), { description: await res.text() });
      return;
    }
    toast.success(t("common.save"));
    setBinCode("");
    setBinBarcode("");
    await load();
  }

  if (!ready) {
    return (
      <div className="text-gray-600">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (!token) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("inventory.settings")}
        actions={
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setNewWhOpen(true)}>
            + {t("inventory.newWhBtn")}
          </button>
        }
      />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="text-gray-600">{t("common.loading")}</p>}

      {!hideSettings && (
        <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
          <h2 className="text-lg font-semibold text-[#34495E]">{t("inventory.settings")}</h2>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allowNeg}
              onChange={(e) => setAllowNeg(e.target.checked)}
              className="rounded border-slate-300 text-action focus:ring-action"
            />
            {t("inventory.allowNeg")}
          </label>
          {settings?.inventoryValuationMethod ? (
            <div className="rounded-xl border border-[#D5DADF] bg-[#F8F9FA] px-4 py-3 text-sm text-[#34495E]">
              <p className="font-medium text-[#34495E]">{t("inventory.valuationMethodLabel")}</p>
              <p className="mt-1 tabular-nums text-[#2C3E50]">
                {t(`inventory.valuationMethod_${settings.inventoryValuationMethod}`, {
                  defaultValue: settings.inventoryValuationMethod,
                })}
              </p>
              <p className="mt-2 text-xs leading-snug text-[#7F8C8D]">
                {t("inventory.valuationMethodOrgNote")}
              </p>
              <Link
                href="/settings/organization"
                className="mt-2 inline-block text-[13px] font-medium text-[#2980B9] hover:text-[#2471A3]"
              >
                {t("inventory.valuationMethodOrgLink")}
              </Link>
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 max-w-xs flex-1">
              <CatalogField
                kind="ENTITY_REF"
                label={t("inventory.defaultWhLabel")}
                value={defWh}
                onChange={(next) => {
                  const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
                  setDefWh(v);
                }}
                options={[
                  { value: "", label: t("inventory.defaultWhAuto") },
                  ...warehouses.map((w) => ({ value: w.id, label: w.name })),
                ]}
              />
            </div>
            <button
              type="button"
              disabled={settingsSaving}
              onClick={() => void saveSettings()}
              className={`${PRIMARY_BUTTON_CLASS} disabled:pointer-events-none disabled:opacity-50`}
            >
              {settingsSaving ? "…" : t("inventory.save")}
            </button>
          </div>
          {settings?.defaultWarehouseResolvedId && (
            <p className="text-xs text-slate-500">
              {t("inventory.defaultWhHint", { id: settings.defaultWarehouseResolvedId })}
            </p>
          )}
        </section>
      )}

      <section id="warehouses" className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <h2 className="text-lg font-semibold text-[#34495E]">
          {t("inventory.whScopeTitle", "Warehouses · cost class")}
        </h2>
        <p className="text-sm text-slate-600 m-0">
          {t(
            "inventory.whScopeHint",
            "Tag FOOD warehouses (and optional F&B outlet code) so buffet cost run attributes usage correctly.",
          )}
        </p>
        <p className="text-xs text-slate-500 m-0">
          {t(
            "inventory.whBuffetFoodHint",
            "Buffet FOOD cost run scopes warehouses with costClass=FOOD (+ outlet code).",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["ALL", t("inventory.whFilterAll", "All")],
              ["FOOD", t("inventory.whFilterFood", "FOOD")],
              ["NON_FOOD", t("inventory.whFilterNonFood", "non-FOOD")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={whFilter === id ? PRIMARY_BUTTON_CLASS : SECONDARY_BUTTON_CLASS}
              onClick={() => setWhFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {warehouses.length === 0 ? (
          <p className="text-sm text-slate-600 m-0">{t("inventory.warehousesEmpty", "No warehouses yet.")}</p>
        ) : filteredWarehouses.length === 0 ? (
          <p className="text-sm text-slate-600 m-0">
            {t("inventory.whFilterEmpty", "No warehouses match this filter.")}
          </p>
        ) : (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thWh")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.whCodePh")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("inventory.whCostClass", "Cost class")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>
                    {t("inventory.whOutletCode", "Outlet code")}
                  </th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("common.actions", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.map((wh) => {
                  const draft = whScopeDraft[wh.id] ?? {
                    code: wh.code ?? "",
                    costClass: wh.costClass ?? "",
                    satelliteOutletCode: wh.satelliteOutletCode ?? "",
                  };
                  const dirty =
                    (wh.code ?? "") !== draft.code ||
                    (wh.costClass ?? "") !== draft.costClass ||
                    (wh.satelliteOutletCode ?? "") !== draft.satelliteOutletCode;
                  return (
                    <tr key={wh.id} className={DATA_TABLE_TR_CLASS}>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="font-medium text-[#2C3E50]">{wh.name}</div>
                        {wh.location ? (
                          <div className="text-xs text-slate-500">{wh.location}</div>
                        ) : null}
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <input
                          type="text"
                          value={draft.code}
                          onChange={(e) =>
                            setWhScopeDraft((prev) => ({
                              ...prev,
                              [wh.id]: {
                                ...draft,
                                code: e.target.value,
                              },
                            }))
                          }
                          placeholder={t("inventory.whCodePlaceholder")}
                          className={`max-w-[8rem] ${INPUT_BORDERED_CLASS}`}
                          aria-label={t("inventory.whCodePh")}
                        />
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="max-w-[14rem]">
                          <CatalogField
                            kind="CLOSED_SMALL"
                            label={t("inventory.whCostClass", "Cost class")}
                            options={costClassOptions}
                            value={draft.costClass}
                            onChange={(next) =>
                              setWhScopeDraft((prev) => ({
                                ...prev,
                                [wh.id]: {
                                  ...draft,
                                  costClass: String(next ?? ""),
                                },
                              }))
                            }
                          />
                        </div>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <div className="max-w-[12rem]">
                          <CatalogField
                            kind="SEARCHABLE"
                            label={t("inventory.whOutletCode", "F&B outlet code")}
                            options={
                              draft.satelliteOutletCode &&
                              !outletCodeOptions.some(
                                (o) => o.value === draft.satelliteOutletCode,
                              )
                                ? [
                                    {
                                      value: draft.satelliteOutletCode,
                                      label: draft.satelliteOutletCode,
                                    },
                                    ...outletCodeOptions,
                                  ]
                                : outletCodeOptions
                            }
                            value={draft.satelliteOutletCode}
                            onChange={(next) =>
                              setWhScopeDraft((prev) => ({
                                ...prev,
                                [wh.id]: {
                                  ...draft,
                                  satelliteOutletCode: String(next ?? ""),
                                },
                              }))
                            }
                          />
                        </div>
                      </td>
                      <td className={DATA_TABLE_TD_CLASS}>
                        <button
                          type="button"
                          disabled={!dirty || whScopeSavingId === wh.id}
                          onClick={() => void saveWarehouseScope(wh.id)}
                          className={`${SECONDARY_BUTTON_CLASS} disabled:pointer-events-none disabled:opacity-50`}
                        >
                          {whScopeSavingId === wh.id ? "…" : t("common.save")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${CARD_CONTAINER_CLASS} p-6 space-y-4`}>
        <h2 className="text-lg font-semibold text-[#34495E]">{t("inventory.topologyTitle")}</h2>
        <p className="text-sm text-slate-600 m-0">{t("inventory.topologyHint")}</p>
        <div className="grid gap-3 md:grid-cols-4">
          <CatalogField
            kind="ENTITY_REF"
            label={t("inventory.whSelect")}
            value={binWh}
            onChange={(next) => {
              const v = Array.isArray(next) ? next[0] ?? "" : String(next ?? "");
              setBinWh(v);
            }}
            options={[
              { value: "", label: t("inventory.whSelect") },
              ...warehouses.map((w) => ({ value: w.id, label: w.name })),
            ]}
          />
          <input
            value={binCode}
            onChange={(e) => setBinCode(e.target.value)}
            className={INPUT_BORDERED_CLASS}
            placeholder={t("inventory.binCode")}
          />
          <input
            value={binBarcode}
            onChange={(e) => setBinBarcode(e.target.value)}
            className={INPUT_BORDERED_CLASS}
            placeholder={t("inventory.binBarcode")}
          />
          <button
            type="button"
            onClick={() => void createBin()}
            disabled={binSaving}
            className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-50`}
          >
            {binSaving ? "…" : t("inventory.createBin")}
          </button>
        </div>
        {bins.length > 0 ? (
          <div className={DATA_TABLE_VIEWPORT_CLASS}>
            <table className={`${DATA_TABLE_CLASS} min-w-full`}>
              <thead>
                <tr className={DATA_TABLE_HEAD_ROW_CLASS}>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.thWh")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.binCode")}</th>
                  <th className={DATA_TABLE_TH_LEFT_CLASS}>{t("inventory.binBarcode")}</th>
                </tr>
              </thead>
              <tbody>
                {bins.map((b) => (
                  <tr key={b.id} className={DATA_TABLE_TR_CLASS}>
                    <td className={DATA_TABLE_TD_CLASS}>{b.warehouse?.name ?? b.warehouseId}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{b.code}</td>
                    <td className={`${DATA_TABLE_TD_CLASS} font-mono`}>{b.barcode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-600 m-0">{t("inventory.binsEmpty")}</p>
        )}
      </section>

      <NewWarehouseModal
        open={newWhOpen}
        onClose={() => setNewWhOpen(false)}
      />
    </div>
  );
}
