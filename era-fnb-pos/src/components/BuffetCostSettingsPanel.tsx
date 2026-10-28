"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  CatalogField,
  Field,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  showApiError,
  showSuccess,
} from "@era/satellite-kit/ui";
import {
  BUFFET_COST_MODELS,
  COGS_POSTING_MODES,
  STAFF_BUFFET_OVERLAPS,
  STOCKTAKE_POLICIES,
  WAREHOUSE_COST_CLASSES,
  type BuffetCostOrgDefaults,
  type BuffetCostOutletOverride,
  type BuffetCostSettings,
  type WarehouseCostClass,
} from "@/lib/buffet-cost-settings";

type OutletRow = { id: string; code: string; name: string };

type Props = {
  outlets: OutletRow[];
};

function emptyOverride(): BuffetCostOutletOverride {
  return {};
}

function seedOverrideFromOrg(
  org: BuffetCostOrgDefaults,
  partial?: BuffetCostOutletOverride | null,
): BuffetCostOutletOverride {
  return {
    buffetCostModel: partial?.buffetCostModel ?? org.buffetCostModel,
    staffBuffetOverlap: partial?.staffBuffetOverlap ?? org.staffBuffetOverlap,
    overlapPct: partial?.overlapPct ?? org.overlapPct,
    cogsPostingMode: partial?.cogsPostingMode ?? org.cogsPostingMode,
    warningVarianceLowPct: partial?.warningVarianceLowPct ?? org.warningVarianceLowPct,
    warningVarianceHighPct: partial?.warningVarianceHighPct ?? org.warningVarianceHighPct,
  };
}

export default function BuffetCostSettingsPanel({ outlets }: Props) {
  const t = useTranslations("admin.settings");
  const [settings, setSettings] = useState<BuffetCostSettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BuffetCostOrgDefaults | null>(null);
  const [overrideOutletId, setOverrideOutletId] = useState("");
  const [overrideDraft, setOverrideDraft] = useState<BuffetCostOutletOverride>(emptyOverride());
  const [useOverride, setUseOverride] = useState(false);

  function load() {
    return fetch("/api/settings/buffet-cost")
      .then(async (r) => {
        if (!r.ok) {
          setLoadFailed(true);
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d?.settings) {
          setSettings(d.settings as BuffetCostSettings);
          setLoadFailed(false);
        } else if (d !== null) {
          setLoadFailed(true);
        }
      })
      .catch(() => setLoadFailed(true));
  }

  useEffect(() => {
    void load();
  }, []);

  function openEditor() {
    if (!settings) return;
    setDraft({ ...settings.orgDefaults, stocktakePolicy: { ...settings.orgDefaults.stocktakePolicy } });
    const first = outlets[0]?.id ?? "";
    setOverrideOutletId(first);
    const existing = first ? settings.outletOverrides[first] : undefined;
    setUseOverride(Boolean(existing));
    setOverrideDraft(
      existing
        ? seedOverrideFromOrg(settings.orgDefaults, existing)
        : emptyOverride(),
    );
    setOpen(true);
  }

  function onPickOverrideOutlet(id: string) {
    setOverrideOutletId(id);
    const existing = settings?.outletOverrides[id];
    setUseOverride(Boolean(existing));
    setOverrideDraft(
      existing && draft
        ? seedOverrideFromOrg(draft, existing)
        : existing && settings
          ? seedOverrideFromOrg(settings.orgDefaults, existing)
          : emptyOverride(),
    );
  }

  async function save() {
    if (!draft) return;
    const outletOverrides: Record<string, BuffetCostOutletOverride | null> = {};
    if (overrideOutletId) {
      if (useOverride) {
        // Always materialize from org draft so enabling override without
        // touching every CatalogField still persists a real row (not {}).
        outletOverrides[overrideOutletId] = seedOverrideFromOrg(draft, overrideDraft);
      } else if (settings?.outletOverrides[overrideOutletId]) {
        outletOverrides[overrideOutletId] = null;
      }
    }
    const res = await fetch("/api/settings/buffet-cost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orgDefaults: draft,
        ...(Object.keys(outletOverrides).length > 0 ? { outletOverrides } : {}),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showApiError(data, t("save"));
      return;
    }
    setSettings(data.settings as BuffetCostSettings);
    setOpen(false);
    showSuccess(t("saved"));
  }

  const overrideCount = settings ? Object.keys(settings.outletOverrides).length : 0;
  const summary = settings
    ? [
        t(`costModel_${settings.orgDefaults.buffetCostModel}`),
        t(`cogsMode_${settings.orgDefaults.cogsPostingMode}`),
        `${settings.orgDefaults.overlapPct}%`,
        ...(overrideCount > 0 ? [t("outletOverrideCount", { count: overrideCount })] : []),
      ].join(" · ")
    : loadFailed
      ? t("buffetCostLoadFailed")
      : "—";

  const modelOptions = BUFFET_COST_MODELS.map((v) => ({
    value: v,
    label: t(`costModel_${v}`),
  }));
  const overlapOptions = STAFF_BUFFET_OVERLAPS.map((v) => ({
    value: v,
    label: t(`overlap_${v}`),
  }));
  const cogsOptions = COGS_POSTING_MODES.map((v) => ({
    value: v,
    label: t(`cogsMode_${v}`),
  }));
  const stocktakeOptions = STOCKTAKE_POLICIES.map((v) => ({
    value: v,
    label: t(`stocktake_${v}`),
  }));

  return (
    <>
      <table className={`${CARD_CONTAINER_CLASS} mt-6 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">{t("field")}</th>
            <th className="p-3">{t("value")}</th>
            <th className="p-3 text-right">{t("actions")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium" title={t("buffetCostHint")}>
              {t("buffetCost")}
            </td>
            <td className="p-3">{summary}</td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={!settings}
                onClick={() => openEditor()}
              >
                {t("edit")}
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <ModalShell open={open && !!draft} title={t("buffetCost")} onClose={() => setOpen(false)}>
        {draft ? (
          <>
            <p className="mb-3 text-sm text-[#7F8C8D]">{t("buffetCostHint")}</p>
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("buffetCostModel")}
              options={modelOptions}
              value={draft.buffetCostModel}
              onChange={(next) =>
                setDraft({ ...draft, buffetCostModel: String(next ?? "HYBRID") as typeof draft.buffetCostModel })
              }
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("staffBuffetOverlap")}
              options={overlapOptions}
              value={draft.staffBuffetOverlap}
              onChange={(next) =>
                setDraft({
                  ...draft,
                  staffBuffetOverlap: String(next ?? "OVERLAP_PCT") as typeof draft.staffBuffetOverlap,
                })
              }
            />
            <Field
              label={t("overlapPct")}
              preset="shortText"
              type="number"
              min={0}
              max={100}
              value={String(draft.overlapPct)}
              onChange={(e) =>
                setDraft({ ...draft, overlapPct: Number(e.target.value) || 0 })
              }
            />
            <CatalogField
              kind="CLOSED_SMALL"
              label={t("cogsPostingMode")}
              options={cogsOptions}
              value={draft.cogsPostingMode}
              onChange={(next) =>
                setDraft({
                  ...draft,
                  cogsPostingMode: String(next ?? "DAY_DOCUMENT") as typeof draft.cogsPostingMode,
                })
              }
            />
            <Field
              label={t("inventoryGtThresholdAzn")}
              preset="shortText"
              type="number"
              min={0}
              step="0.01"
              value={String(draft.inventoryGtThresholdAzn)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  inventoryGtThresholdAzn: Number(e.target.value) || 0,
                })
              }
            />
            <Field
              label={t("staffMealAznPerCover")}
              preset="shortText"
              type="number"
              min={0}
              step="0.01"
              value={String(draft.staffMealAznPerCover)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  staffMealAznPerCover: Number(e.target.value) || 0,
                })
              }
            />
            <Field
              label={t("warningVarianceLowPct")}
              preset="shortText"
              type="number"
              min={1}
              max={300}
              value={String(draft.warningVarianceLowPct)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  warningVarianceLowPct: Number(e.target.value) || 70,
                })
              }
            />
            <Field
              label={t("warningVarianceHighPct")}
              preset="shortText"
              type="number"
              min={1}
              max={300}
              value={String(draft.warningVarianceHighPct)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  warningVarianceHighPct: Number(e.target.value) || 110,
                })
              }
            />
            <p className="m-0 text-xs text-[#7F8C8D]">{t("stocktakeCadenceHint")}</p>
            {WAREHOUSE_COST_CLASSES.map((cls: WarehouseCostClass) => (
              <CatalogField
                key={cls}
                kind="CLOSED_SMALL"
                label={t("stocktakePolicyClass", { whClass: t(`whClass_${cls}`) })}
                options={stocktakeOptions}
                value={draft.stocktakePolicy[cls]}
                onChange={(next) =>
                  setDraft({
                    ...draft,
                    stocktakePolicy: {
                      ...draft.stocktakePolicy,
                      [cls]: String(next ?? draft.stocktakePolicy[cls]) as (typeof draft.stocktakePolicy)[typeof cls],
                    },
                  })
                }
              />
            ))}

            {outlets.length > 0 ? (
              <>
                <h3 className="mb-2 mt-4 text-sm font-semibold text-[#2C3E50]">
                  {t("outletOverride")}
                </h3>
                <CatalogField
                  kind="ENTITY_REF"
                  label={t("outletName")}
                  options={outlets.map((row) => ({
                    value: row.id,
                    label: `${row.code} — ${row.name}`,
                  }))}
                  value={overrideOutletId}
                  onChange={(next) => onPickOverrideOutlet(String(next ?? ""))}
                />
                <CatalogField
                  kind="CLOSED_SMALL"
                  label={t("outletOverrideActive")}
                  options={[
                    { value: "0", label: t("outletOverrideOff") },
                    { value: "1", label: t("outletOverrideOn") },
                  ]}
                  value={useOverride ? "1" : "0"}
                  onChange={(next) => {
                    const on = String(next) === "1";
                    setUseOverride(on);
                    if (on && draft) {
                      setOverrideDraft(seedOverrideFromOrg(draft, overrideDraft));
                    }
                  }}
                />
                {useOverride ? (
                  <>
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t("buffetCostModel")}
                      options={modelOptions}
                      value={overrideDraft.buffetCostModel ?? draft.buffetCostModel}
                      onChange={(next) =>
                        setOverrideDraft({
                          ...overrideDraft,
                          buffetCostModel: String(next) as NonNullable<
                            BuffetCostOutletOverride["buffetCostModel"]
                          >,
                        })
                      }
                    />
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t("staffBuffetOverlap")}
                      options={overlapOptions}
                      value={overrideDraft.staffBuffetOverlap ?? draft.staffBuffetOverlap}
                      onChange={(next) =>
                        setOverrideDraft({
                          ...overrideDraft,
                          staffBuffetOverlap: String(next) as NonNullable<
                            BuffetCostOutletOverride["staffBuffetOverlap"]
                          >,
                        })
                      }
                    />
                    <Field
                      label={t("overlapPct")}
                      preset="shortText"
                      type="number"
                      min={0}
                      max={100}
                      value={String(overrideDraft.overlapPct ?? draft.overlapPct)}
                      onChange={(e) =>
                        setOverrideDraft({
                          ...overrideDraft,
                          overlapPct: Number(e.target.value) || 0,
                        })
                      }
                    />
                    <CatalogField
                      kind="CLOSED_SMALL"
                      label={t("cogsPostingMode")}
                      options={cogsOptions}
                      value={overrideDraft.cogsPostingMode ?? draft.cogsPostingMode}
                      onChange={(next) =>
                        setOverrideDraft({
                          ...overrideDraft,
                          cogsPostingMode: String(next) as NonNullable<
                            BuffetCostOutletOverride["cogsPostingMode"]
                          >,
                        })
                      }
                    />
                  </>
                ) : null}
              </>
            ) : null}

            <ModalFooter
              onCancel={() => setOpen(false)}
              onSubmit={() => void save()}
              submitLabel={t("save")}
            />
          </>
        ) : null}
      </ModalShell>
    </>
  );
}
