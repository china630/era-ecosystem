"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  SANATORIUM_SYSTEM_KEYS,
  WORKSPACE_SYSTEMS,
  type WorkspaceSystemKey,
} from "@era/satellite-kit/platform/workspace-system-catalog";
import type { IndustryModuleKey } from "@era/satellite-kit/platform/industry-modules";
import { satelliteUrlForItem } from "@era/satellite-kit/platform/industry-modules";
import {
  buildSatelliteSsoLaunchUrl,
  defaultSsoExpiresAt,
} from "@era/satellite-kit/auth/sso-launch";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { EARLY_ACCESS_MODULES } from "../../components/early-access/modules.config";
import { buildFinanceHandoffUrl, getOrchAccessToken } from "../../lib/open-finance";
import type { PublicPricingResponse } from "../../lib/public-pricing-types";
import { fetchPublicPricingSnapshot } from "../../lib/pricing/fetch-public-pricing";
import { useAuth } from "../../lib/auth-context";
import { useRequireAuth } from "../../lib/use-require-auth";
import { useSubscription } from "../../lib/subscription-context";
import {
  industryNavItemForKey,
  workspaceOpenHref,
  workspaceSatelliteKey,
  workspaceSystemStatus,
  type WorkspaceSystemStatus,
} from "../../lib/workspace-access";
import { orchFetch } from "../../lib/orch-api";
import { WorkspaceSatelliteModulesModal } from "../../components/workspace/workspace-satellite-modules-modal";
import { WorkspaceDepartmentsPanel } from "../../components/workspace/workspace-departments-panel";
import { WorkforceHubCard } from "../../components/workspace/workforce-hub-card";

function priceForModule(
  pricing: PublicPricingResponse | null,
  pricingModuleKey: string,
  systemKey: WorkspaceSystemKey,
): number | null {
  if (pricing && !pricing.unavailable) {
    if (pricingModuleKey === "foundation") {
      return pricing.foundationMonthlyAzn > 0 ? pricing.foundationMonthlyAzn : null;
    }
    const mod =
      pricing.pricingModules.find((m) => m.key === pricingModuleKey) ??
      pricing.hospitalityModules?.find((m) => m.key === pricingModuleKey);
    if (mod && mod.pricePerMonth > 0) return mod.pricePerMonth;
  }
  if (systemKey === "FINANCE") return null;
  const fallback = EARLY_ACCESS_MODULES[systemKey as IndustryModuleKey];
  return fallback?.priceAzn ?? null;
}

function SystemCard({
  systemKey,
  pricingModuleKey,
  status,
  priceAzn,
  trialDaysLeft,
  onConnect,
  connecting,
  onManageModules,
}: {
  systemKey: WorkspaceSystemKey;
  pricingModuleKey: string;
  status: WorkspaceSystemStatus;
  priceAzn: number | null;
  trialDaysLeft: number | null;
  onConnect?: () => void;
  connecting?: boolean;
  onManageModules?: () => void;
}) {
  const t = useTranslations("workspace");
  const tSys = useTranslations(`workspace.systems.${WORKSPACE_SYSTEMS.find((s) => s.key === systemKey)?.i18nKey ?? "finance"}`);
  const { user } = useAuth();

  const title = tSys("title");
  const tagline = tSys("tagline");
  const highlights = [1, 2, 3]
    .map((n) => {
      try {
        return tSys(`highlight${n}` as "highlight1");
      } catch {
        return null;
      }
    })
    .filter(Boolean) as string[];

  function openActive() {
    if (systemKey === "FINANCE") {
      const token = getOrchAccessToken();
      if (!token) return;
      void buildFinanceHandoffUrl(token).then((url) => {
        if (url) window.location.href = url;
      });
      return;
    }
    const item = industryNavItemForKey(systemKey);
    if (!item || !user?.email || !user.organizationId) return;
    const base = satelliteUrlForItem(item);
    if (!base) {
      window.open(workspaceOpenHref(systemKey) ?? "/industry", "_blank");
      return;
    }
    const url = buildSatelliteSsoLaunchUrl(base, {
      email: user.email,
      fullName: user.email.split("@")[0] ?? "User",
      organizationId: user.organizationId,
      expiresAt: defaultSsoExpiresAt(),
      financeRole: user.role ?? "OWNER",
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const badge =
    status === "active"
      ? trialDaysLeft != null
        ? t("badgeTrial", { days: trialDaysLeft })
        : t("badgeActive")
      : status === "read_only"
        ? t("badgeReadOnly")
        : status === "not_connected"
          ? t("badgeNotConnected")
          : t("badgeNotSubscribed");

  const badgeClass =
    status === "active"
      ? "bg-emerald-50 text-emerald-800"
      : status === "read_only"
        ? "bg-amber-50 text-amber-900"
        : "bg-[#EBEDF0] text-[#475569]";

  return (
    <article className={`${CARD_CONTAINER_CLASS} flex flex-col p-4`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#34495E]">{title}</h2>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
          {badge}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#7F8C8D]">{tagline}</p>
      {highlights.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-xs text-[#7F8C8D]">
          {highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
      {priceAzn != null ? (
        <p className="mt-3 text-xs text-[#475569]">
          {t("priceFrom", { price: priceAzn })}
        </p>
      ) : null}
      <div className="mt-auto pt-4">
        {status === "active" ? (
          <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openActive}>
            {t("open")}
          </button>
        ) : status === "read_only" ? (
          <Link href="/settings/subscription" className={PRIMARY_BUTTON_CLASS}>
            {t("renew")}
          </Link>
        ) : status === "not_connected" ? (
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={connecting}
            onClick={onConnect}
          >
            {connecting ? t("connecting") : t("connect")}
          </button>
        ) : (
          <button
            type="button"
            className={SECONDARY_BUTTON_CLASS}
            onClick={onManageModules}
          >
            {t("addModule")}
          </button>
        )}
      </div>
    </article>
  );
}

export default function WorkspacePage() {
  const { ready, user } = useRequireAuth();
  const { snapshot, loading, refresh } = useSubscription();
  const t = useTranslations("workspace");
  const tHome = useTranslations("home");
  const [pricing, setPricing] = useState<PublicPricingResponse | null>(null);
  const [showAllModules, setShowAllModules] = useState(false);
  const [connectingKey, setConnectingKey] = useState<WorkspaceSystemKey | null>(null);
  const [modulesModalKey, setModulesModalKey] = useState<WorkspaceSystemKey | null>(null);

  useEffect(() => {
    void fetchPublicPricingSnapshot().then(setPricing);
  }, []);

  const primaryKeys = SANATORIUM_SYSTEM_KEYS;
  const secondaryKeys = useMemo(
    () =>
      WORKSPACE_SYSTEMS.map((s) => s.key).filter(
        (k) => !SANATORIUM_SYSTEM_KEYS.includes(k),
      ),
    [],
  );

  const trialDaysLeft =
    snapshot?.isTrial && snapshot.trialDaysLeft != null ? snapshot.trialDaysLeft : null;

  function hasHotelResortUpsell(): boolean {
    if (!snapshot) return false;
    const modules = snapshot.activeModules;
    if (!Array.isArray(modules) || !modules.includes("industry_hotel_pms")) return false;
    const hotelMods = snapshot.hotelModules as Record<string, boolean> | undefined;
    if (hotelMods) return !hotelMods.hotel_channel_ota;
    return !modules.includes("hotel_channel_ota");
  }

  if (!ready) return null;

  if (!user?.organizationId) {
    return (
      <>
        <p className="text-sm text-[#7F8C8D]">{t("selectOrgHint")}</p>
        <Link href="/organizations" className={`${PRIMARY_BUTTON_CLASS} mt-4 inline-flex`}>
          {t("goOrganizations")}
        </Link>
      </>
    );
  }

  function renderSystem(key: WorkspaceSystemKey) {
    const meta = WORKSPACE_SYSTEMS.find((s) => s.key === key);
    if (!meta) return null;

    async function connectSatellite() {
      const token = getOrchAccessToken();
      if (!token) return;
      setConnectingKey(key);
      try {
        const res = await orchFetch("/v1/subscription/connect-satellite", {
          token,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ satelliteKey: workspaceSatelliteKey(key) }),
        });
        if (res.ok) await refresh();
      } finally {
        setConnectingKey(null);
      }
    }

    return (
      <SystemCard
        key={key}
        systemKey={key}
        pricingModuleKey={meta.pricingModuleKey}
        status={workspaceSystemStatus(snapshot, key)}
        priceAzn={priceForModule(pricing, meta.pricingModuleKey, key)}
        trialDaysLeft={trialDaysLeft}
        onConnect={() => void connectSatellite()}
        connecting={connectingKey === key}
        onManageModules={() => setModulesModalKey(key)}
      />
    );
  }

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {loading ? (
        <p className="text-sm text-[#7F8C8D]">{t("loadingEntitlements")}</p>
      ) : null}
      {!loading && hasHotelResortUpsell() ? (
        <div className={`${CARD_CONTAINER_CLASS} mb-6 border-amber-200 bg-amber-50 p-4`}>
          <p className="text-[13px] font-semibold text-amber-900">{tHome("hotelUpsellTitle")}</p>
          <p className="mt-1 text-[13px] text-[#7F8C8D]">{tHome("hotelUpsellHint")}</p>
          <Link
            href="/pricing#hospitality"
            className="mt-2 inline-block text-[13px] font-medium text-[#2980B9] hover:underline"
          >
            {tHome("hotelUpsellCta")} →
          </Link>
        </div>
      ) : null}
      <WorkspaceDepartmentsPanel />
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t("workforceSection")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-md">
          <WorkforceHubCard snapshot={snapshot} />
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-semibold text-[#34495E]">{t("sanatoriumSection")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">{primaryKeys.map(renderSystem)}</div>
      </section>
      {secondaryKeys.length > 0 ? (
        <section className="mt-8">
          <button
            type="button"
            className="mb-3 text-sm font-medium text-[#2980B9] hover:underline"
            onClick={() => setShowAllModules((v) => !v)}
          >
            {showAllModules ? t("hideAllModules") : t("showAllModules")}
          </button>
          {showAllModules ? (
            <div className="grid gap-4 sm:grid-cols-2">{secondaryKeys.map(renderSystem)}</div>
          ) : null}
        </section>
      ) : null}
      <WorkspaceSatelliteModulesModal
        open={modulesModalKey != null}
        systemKey={modulesModalKey}
        pricing={pricing}
        onClose={() => setModulesModalKey(null)}
        onUpdated={refresh}
      />
    </>
  );
}
