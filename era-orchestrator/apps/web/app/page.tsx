"use client";

import Link from "next/link";
import { CARD_CONTAINER_CLASS } from "@era/satellite-kit/ui";
import {
  FINANCE_TILE,
  hasIndustryModuleAccess,
  INDUSTRY_NAV_ITEMS,
  type IndustryModuleKey,
} from "@era/satellite-kit/platform/industry-modules";
import { useTranslations } from "next-intl";
import { useEarlyAccess } from "../components/early-access/early-access-context";
import { ShellHeader } from "../components/shell-header";
import { buildFinanceHandoffUrl, getOrchAccessToken } from "../lib/open-finance";
import { useRequireAuth } from "../lib/use-require-auth";
import { useSubscription } from "../lib/subscription-context";

function hasHotelResortUpsell(snapshot: Record<string, unknown> | null): boolean {
  if (!snapshot) return false;
  const modules = snapshot.activeModules;
  if (!Array.isArray(modules) || !modules.includes("industry_hotel_pms")) return false;
  const hotelMods = snapshot.hotelModules as Record<string, boolean> | undefined;
  if (hotelMods) return !hotelMods.hotel_channel_ota;
  return !modules.includes("hotel_channel_ota");
}

function ModuleTile({
  item,
  entitled,
}: {
  item: (typeof INDUSTRY_NAV_ITEMS)[number];
  entitled: boolean;
}) {
  const { open: openEarlyAccess } = useEarlyAccess();
  const t = useTranslations("home");

  if (entitled) {
    return (
      <Link
        href={item.href}
        className={`${CARD_CONTAINER_CLASS} block p-4 transition hover:border-[#2980B9]/40`}
      >
        <strong className="text-[#34495E]">{item.title}</strong>
        <p className="mt-1 text-xs text-[#7F8C8D]">{item.description}</p>
        <p className="mt-2 text-xs font-medium text-[#2980B9]">{t("open")}</p>
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${CARD_CONTAINER_CLASS} w-full p-4 text-left opacity-80 transition hover:border-[#2980B9]/40`}
      onClick={() => openEarlyAccess(item.key as IndustryModuleKey)}
    >
      <strong className="text-[#34495E]">{item.title}</strong>
      <p className="mt-1 text-xs text-[#7F8C8D]">{item.description}</p>
      <p className="mt-2 text-xs font-medium text-amber-700">{t("waitlist")}</p>
    </button>
  );
}

export default function HomePage() {
  const { ready } = useRequireAuth();
  const { snapshot, loading } = useSubscription();
  const t = useTranslations("home");

  if (!ready) {
    return <p className="text-sm text-[#7F8C8D]">{t("loading")}</p>;
  }

  function openFinance() {
    const token = getOrchAccessToken();
    if (!token) return;
    void buildFinanceHandoffUrl(token).then((url) => {
      if (url) window.location.href = url;
    });
  }

  return (
    <>
      <ShellHeader />
      <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
      <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      {loading ? (
        <p className="mt-4 text-sm text-[#7F8C8D]">{t("loadingEntitlements")}</p>
      ) : null}
      {!loading && hasHotelResortUpsell(snapshot as Record<string, unknown> | null) ? (
        <div className={`${CARD_CONTAINER_CLASS} mt-4 border-amber-200 bg-amber-50 p-4`}>
          <p className="text-[13px] font-semibold text-amber-900">{t("hotelUpsellTitle")}</p>
          <p className="mt-1 text-[13px] text-[#7F8C8D]">{t("hotelUpsellHint")}</p>
          <Link
            href="/pricing#hospitality"
            className="mt-2 inline-block text-[13px] font-medium text-[#2980B9] hover:underline"
          >
            {t("hotelUpsellCta")} →
          </Link>
        </div>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {INDUSTRY_NAV_ITEMS.map((item) => (
          <ModuleTile
            key={item.key}
            item={item}
            entitled={hasIndustryModuleAccess(snapshot, item.key)}
          />
        ))}
        <button
          type="button"
          onClick={openFinance}
          className={`${CARD_CONTAINER_CLASS} block p-4 text-left`}
        >
          <strong className="text-[#34495E]">{FINANCE_TILE.title}</strong>
          <p className="mt-1 text-xs text-[#7F8C8D]">{FINANCE_TILE.description}</p>
          <p className="mt-2 text-xs font-medium text-[#2980B9]">Open Finance (SSO) →</p>
        </button>
      </div>
    </>
  );
}
