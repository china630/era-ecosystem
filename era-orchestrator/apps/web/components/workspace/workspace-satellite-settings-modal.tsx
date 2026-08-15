"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import {
  WORKSPACE_SYSTEMS,
  type WorkspaceSystemKey,
} from "@era/satellite-kit/platform/workspace-system-catalog";
import { ModalShell, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";
import type { SubscriptionSnapshot } from "../../lib/subscription-context";
import { workspaceSatelliteKey } from "../../lib/workspace-access";
import {
  catalogModulesForSatellite,
  isModuleActive,
} from "../../lib/workspace-satellite-modules";

const SYSTEM_I18N: Partial<Record<WorkspaceSystemKey, string>> = {
  FINANCE: "finance",
  HOTEL_PMS: "hotel",
  FNB_POS: "fnb",
  RETAIL: "retail",
  CLINIC: "clinic",
  LOGISTICS: "logistics",
  CONSTRUCTION: "construction",
  CRM: "crm",
  AUTO_SERVICE: "auto",
  WHOLESALE: "wholesale",
};

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function WorkspaceSatelliteSettingsModal({
  open,
  systemKey,
  snapshot,
  pricing,
  onClose,
  onManageModules,
}: {
  open: boolean;
  systemKey: WorkspaceSystemKey | null;
  snapshot: SubscriptionSnapshot | null;
  pricing: PublicPricingResponse | null;
  onClose: () => void;
  onManageModules: () => void;
}) {
  const t = useTranslations("workspace");
  const tSys = useTranslations("workspace.systems");
  const tCommon = useTranslations("common");

  const satelliteKey = systemKey ? workspaceSatelliteKey(systemKey) : null;
  const i18nKey = systemKey ? SYSTEM_I18N[systemKey] : null;
  const systemTitle =
    i18nKey != null ? tSys(`${i18nKey}.title` as "finance.title") : (systemKey ?? "");

  const entitlement = useMemo(
    () =>
      snapshot?.satelliteEntitlements?.find((s) => s.satelliteKey === satelliteKey) ?? null,
    [snapshot?.satelliteEntitlements, satelliteKey],
  );

  const activeModules = useMemo(() => {
    if (!pricing || pricing.unavailable || !satelliteKey) return [];
    const base = catalogModulesForSatellite(pricing.pricingModules, satelliteKey);
    const hospitality =
      satelliteKey === "industry_hotel_pms" ? (pricing.hospitalityModules ?? []) : [];
    const seen = new Set<string>();
    const rows: Array<{ key: string; name: string; pricePerMonth: number }> = [];
    for (const mod of [...base, ...hospitality]) {
      if (seen.has(mod.key)) continue;
      seen.add(mod.key);
      if (isModuleActive(snapshot?.activeModules, mod.key)) {
        rows.push({ key: mod.key, name: mod.name, pricePerMonth: mod.pricePerMonth });
      }
    }
    return rows;
  }, [pricing, satelliteKey, snapshot?.activeModules]);

  const total = activeModules.reduce((sum, m) => sum + (m.pricePerMonth || 0), 0);
  const connectedAt = formatDate(entitlement?.connectedAt ?? null);
  const trialExpires = formatDate(entitlement?.trialExpiresAt ?? null);

  return (
    <ModalShell
      open={open}
      title={t("settingsTitle", { system: systemTitle })}
      subtitle={t("settingsSubtitle")}
      onClose={onClose}
      closeLabel={tCommon("close")}
      maxWidthClass="max-w-lg"
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
        {connectedAt ? (
          <>
            <dt className="text-[#7F8C8D]">{t("settingsConnectedAt")}</dt>
            <dd className="text-[#34495E]">{connectedAt}</dd>
          </>
        ) : null}
        {trialExpires ? (
          <>
            <dt className="text-[#7F8C8D]">{t("settingsTrialExpires")}</dt>
            <dd className="text-[#34495E]">{trialExpires}</dd>
          </>
        ) : null}
      </dl>

      <h3 className="mt-4 text-[13px] font-semibold text-[#34495E]">{t("settingsActiveModules")}</h3>
      {activeModules.length === 0 ? (
        <p className="mt-1 text-[13px] text-[#7F8C8D]">{t("settingsNoModules")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#EBEDF0]">
          {activeModules.map((m) => (
            <li key={m.key} className="flex items-center justify-between py-1.5 text-[13px]">
              <span className="text-[#34495E]">{m.name}</span>
              <span className="text-[#7F8C8D]">
                {m.pricePerMonth > 0 ? t("priceActive", { price: m.pricePerMonth }) : t("priceIncluded")}
              </span>
            </li>
          ))}
        </ul>
      )}
      {total > 0 ? (
        <p className="mt-2 text-right text-[13px] font-semibold text-[#34495E]">
          {t("settingsTotal", { price: total })}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={onClose}>
          {tCommon("close")}
        </button>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={onManageModules}>
          <SlidersHorizontal className="mr-1.5 h-4 w-4" aria-hidden />
          {t("manageModules")}
        </button>
      </div>
    </ModalShell>
  );
}
