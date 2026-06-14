"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { INDUSTRY_MODULE_SLUGS } from "@era/satellite-kit/platform/industry-modules";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";

const FINANCE_GROUP = new Set([
  "nas",
  "foundation",
  "ifrs",
  "ifrs_mapping",
  "production",
  "manufacturing",
  "fixed_assets",
  "inventory",
  "hr_full",
  "audit_hub",
  "cash_bank_pro",
  "kassa_pro",
  "banking_pro",
  "tax_pro",
  "trade_pro",
]);

function groupModules(activeModules: string[]) {
  const finance: string[] = [];
  const industry: string[] = [];
  const hotelSub: string[] = [];
  for (const slug of activeModules) {
    if (FINANCE_GROUP.has(slug)) finance.push(slug);
    else if (INDUSTRY_MODULE_SLUGS.includes(slug as (typeof INDUSTRY_MODULE_SLUGS)[number])) {
      industry.push(slug);
    } else if (slug.startsWith("hotel_")) hotelSub.push(slug);
  }
  return { finance, industry, hotelSub };
}

export default function SubscriptionPage() {
  const { ready } = useRequireAuth();
  const { snapshot, loading } = useSubscription();
  const t = useTranslations("settings");
  const tSub = useTranslations("settings.subscription");

  const grouped = useMemo(
    () => groupModules(snapshot?.activeModules ?? []),
    [snapshot?.activeModules],
  );

  if (!ready) return null;

  return (
    <>
      <Link href="/settings" className={SECONDARY_BUTTON_CLASS}>
        {t("title")}
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-[#34495E]">{tSub("title")}</h1>

      {loading ? (
        <p className="mt-4 text-sm text-[#7F8C8D]">{tSub("loading")}</p>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-4 p-4`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {tSub("plan")}
            </p>
            <p className="mt-1 text-sm text-[#34495E]">
              {snapshot?.tier ?? "—"}
              {snapshot?.isTrial && snapshot.trialDaysLeft != null
                ? ` · ${tSub("trialDays", { days: snapshot.trialDaysLeft })}`
                : null}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {tSub("billingStatus")}
            </p>
            <p className="mt-1 text-sm text-[#34495E]">{snapshot?.billingStatus ?? "—"}</p>
          </div>
          {snapshot?.readOnly ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {tSub("readOnlyBanner")}
            </p>
          ) : null}
          {(["finance", "industry", "hotelSub"] as const).map((key) => {
            const chips = grouped[key];
            if (chips.length === 0) return null;
            const labelKey =
              key === "finance"
                ? "financeModules"
                : key === "industry"
                  ? "industryModules"
                  : "hotelModules";
            return (
              <div key={key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
                  {tSub(labelKey)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {chips.map((slug) => (
                    <span
                      key={slug}
                      className="rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-medium text-[#475569]"
                    >
                      {slug}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/pricing" className={PRIMARY_BUTTON_CLASS}>
              {tSub("managePricing")}
            </Link>
            <Link href="/help" className={SECONDARY_BUTTON_CLASS}>
              {tSub("contactSupport")}
            </Link>
          </div>
          <p className="text-xs text-[#7F8C8D]">{tSub("trialHint")}</p>
        </div>
      )}
    </>
  );
}
