"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { WorkspaceSystemKey } from "@era/satellite-kit/platform/workspace-system-catalog";
import {
  MODAL_FOOTER_OUTLINE_CLASS,
  ModalShell,
} from "@era/satellite-kit/ui";
import { getOrchAccessToken, orchFetch } from "../../lib/orch-api";
import {
  catalogModulesForSatellite,
  isModuleActive,
} from "../../lib/workspace-satellite-modules";
import type { PublicPricingModule, PublicPricingResponse } from "../../lib/public-pricing-types";
import { useSubscription } from "../../lib/subscription-context";
import { workspaceSatelliteKey } from "../../lib/workspace-access";

type ModuleStateRow = {
  moduleKey: string;
  pendingDeactivation: boolean;
};

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

export function WorkspaceSatelliteModulesModal({
  open,
  systemKey,
  pricing,
  onClose,
  onUpdated,
}: {
  open: boolean;
  systemKey: WorkspaceSystemKey | null;
  pricing: PublicPricingResponse | null;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}) {
  const t = useTranslations("workspace.modulesModal");
  const tSys = useTranslations("workspace.systems");
  const tCommon = useTranslations("common");
  const { snapshot } = useSubscription();
  const [moduleStates, setModuleStates] = useState<ModuleStateRow[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [loadingStates, setLoadingStates] = useState(false);

  const satelliteKey = systemKey ? workspaceSatelliteKey(systemKey) : null;

  const modules = useMemo(() => {
    if (!pricing || !satelliteKey || pricing.unavailable) return [];
    const base = catalogModulesForSatellite(pricing.pricingModules, satelliteKey);
    const hospitality =
      satelliteKey === "industry_hotel_pms"
        ? (pricing.hospitalityModules ?? []).map((m) => ({
            key: m.key,
            name: m.name,
            pricePerMonth: m.pricePerMonth,
            sortOrder: m.sortOrder,
            satelliteKey: "industry_hotel_pms" as const,
            isPremium: m.isPremium,
          }))
        : [];
    const merged = new Map<string, PublicPricingModule>();
    for (const m of [...base, ...hospitality]) merged.set(m.key, m);
    // The satellite gate itself is not an add-on module — connecting/disconnecting
    // the satellite is handled by the workspace card, not a checkbox here.
    merged.delete(satelliteKey);
    return [...merged.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [pricing, satelliteKey]);

  const pendingByKey = useMemo(
    () => new Map(moduleStates.map((r) => [r.moduleKey, r.pendingDeactivation])),
    [moduleStates],
  );

  const loadModuleStates = useCallback(async () => {
    const token = getOrchAccessToken();
    if (!token) return;
    setLoadingStates(true);
    try {
      const res = await orchFetch("/v1/billing/module-states", { token });
      if (!res.ok) {
        setModuleStates([]);
        return;
      }
      const data = (await res.json()) as { items?: ModuleStateRow[] };
      setModuleStates(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoadingStates(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadModuleStates();
  }, [open, loadModuleStates]);

  async function ensureSatelliteConnected() {
    if (!systemKey || !satelliteKey || !snapshot) return true;
    const connected = snapshot.satelliteEntitlements?.some(
      (s) => s.satelliteKey === satelliteKey,
    );
    if (connected) return true;
    const token = getOrchAccessToken();
    if (!token) return false;
    const res = await orchFetch("/v1/subscription/connect-satellite", {
      token,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ satelliteKey }),
    });
    return res.ok;
  }

  async function toggleModule(moduleKey: string, enabled: boolean) {
    const token = getOrchAccessToken();
    if (!token) return;
    setBusyKey(moduleKey);
    try {
      if (enabled) {
        const ok = await ensureSatelliteConnected();
        if (!ok) {
          toast.error(t("connectFailed"));
          return;
        }
      }

      const res = await orchFetch("/v1/billing/toggle-module", {
        token,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleKey, enabled }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { message?: string } | null;
        toast.error(err?.message ?? tCommon("failed"));
        return;
      }

      if (!enabled) {
        toast.info(t("disableBillingNotice"));
      } else {
        toast.success(t("enabled"));
      }

      await loadModuleStates();
      await onUpdated();
    } finally {
      setBusyKey(null);
    }
  }

  const i18nKey = systemKey ? SYSTEM_I18N[systemKey] : null;
  const systemTitle =
    i18nKey != null
      ? tSys(`${i18nKey}.title` as "finance.title")
      : (systemKey ?? "");

  return (
    <ModalShell
      open={open}
      title={t("title", { system: systemTitle })}
      subtitle={t("subtitle")}
      onClose={onClose}
      closeLabel={tCommon("cancel")}
      maxWidthClass="max-w-xl"
      footer={
        <div className="mt-4 flex justify-end">
          <button type="button" className={MODAL_FOOTER_OUTLINE_CLASS} onClick={onClose}>
            {tCommon("cancel")}
          </button>
        </div>
      }
    >
      {loadingStates && modules.length === 0 ? (
        <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>
      ) : modules.length === 0 ? (
        <p className="text-sm text-[#7F8C8D]">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-[#EBEDF0]">
          {modules.map((mod) => {
            const active = isModuleActive(snapshot?.activeModules, mod.key);
            const pending = pendingByKey.get(mod.key) ?? false;
            const checked = active && !pending;
            const disabled = busyKey === mod.key;

            return (
              <li
                key={mod.key}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#34495E]">{mod.name}</p>
                  <p className="mt-0.5 text-xs text-[#7F8C8D]">
                    {mod.pricePerMonth > 0
                      ? t("priceLine", { price: mod.pricePerMonth })
                      : t("included")}
                    {pending ? (
                      <span className="ml-2 font-medium text-amber-800">
                        · {t("pendingOff")}
                      </span>
                    ) : null}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2">
                  <span className="sr-only">{mod.name}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#D5DADF] accent-[#2980B9]"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => void toggleModule(mod.key, e.target.checked)}
                  />
                </label>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-[#7F8C8D]">{t("billingFootnote")}</p>
    </ModalShell>
  );
}
