"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { INDUSTRY_MODULE_SLUGS } from "@era/satellite-kit/platform/industry-modules";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { useRequireAuth } from "../../../lib/use-require-auth";
import { useSubscription } from "../../../lib/subscription-context";
import type { PublicPricingResponse } from "../../../lib/public-pricing-types";
import { fetchPublicPricingSnapshot } from "../../../lib/pricing/fetch-public-pricing";
import { buildModuleLabeler } from "../../../lib/module-labels";
import { getOrchAccessToken, orchFetch } from "../../../lib/orch-api";
import { useAuth } from "../../../lib/auth-context";

const FINANCE_GROUP = new Set([
  "finance_core",
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

/** Satellite gate slug → workspace.systems i18n key (for group headers). */
const SATELLITE_I18N: Record<string, string> = {
  finance_core: "finance",
  industry_hotel_pms: "hotel",
  industry_fnb_pos: "fnb",
  industry_retail: "retail",
  industry_clinic: "clinic",
  industry_logistics: "logistics",
  industry_construction: "construction",
  industry_crm: "crm",
  industry_auto_service: "auto",
  industry_wholesale: "wholesale",
};

const PLATFORM_GROUP = "__platform";
const OTHER_GROUP = "__other";

const GROUP_ORDER = [
  "finance_core",
  "industry_hotel_pms",
  "industry_clinic",
  "industry_fnb_pos",
  "industry_retail",
  "industry_wholesale",
  "industry_logistics",
  "industry_construction",
  "industry_crm",
  "industry_auto_service",
  "industry_banking",
  PLATFORM_GROUP,
  OTHER_GROUP,
];

type ModuleStateRow = { moduleKey: string; pendingDeactivation: boolean };
type MarketplaceBundle = {
  id: string;
  name: string;
  pricePerMonth?: number;
  moduleKeys?: string[];
  active?: boolean;
};
type MarketplaceSnapshot = {
  bundles?: MarketplaceBundle[];
  premiumModules?: Array<{ key: string; name: string }>;
};

function groupKeyForSlug(
  slug: string,
  satelliteByKey: Map<string, string | null>,
): string {
  if (FINANCE_GROUP.has(slug)) return "finance_core";
  if (slug.startsWith("hotel_")) return "industry_hotel_pms";
  if (slug.startsWith("banking_")) return "industry_banking";
  const sat = satelliteByKey.get(slug);
  if (sat) return sat;
  if ((INDUSTRY_MODULE_SLUGS as readonly string[]).includes(slug)) return slug;
  if (slug.startsWith("platform_")) return PLATFORM_GROUP;
  return OTHER_GROUP;
}

export default function SubscriptionPage() {
  const { ready } = useRequireAuth();
  const { token } = useAuth();
  const { snapshot, loading, refresh } = useSubscription();
  const t = useTranslations("settings");
  const tSub = useTranslations("settings.subscription");
  const tSys = useTranslations("workspace.systems");

  const [pricing, setPricing] = useState<PublicPricingResponse | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [marketplace, setMarketplace] = useState<MarketplaceSnapshot | null>(null);
  const [plans, setPlans] = useState<Record<string, number>>({});
  const [selectedTier, setSelectedTier] = useState<"TIER_1" | "TIER_2" | "TIER_3">("TIER_1");
  const [upgradePreview, setUpgradePreview] = useState<string | null>(null);
  const [billingMsg, setBillingMsg] = useState<string | null>(null);
  const [billingErr, setBillingErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [premiumKeys, setPremiumKeys] = useState("");
  const [ceilingAmount, setCeilingAmount] = useState("50");
  const [checkoutAmount, setCheckoutAmount] = useState("10");

  useEffect(() => {
    let cancelled = false;
    void fetchPublicPricingSnapshot().then((p) => {
      if (!cancelled) setPricing(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const token = getOrchAccessToken();
    if (!token) return;
    void orchFetch("/v1/billing/module-states", { token })
      .then(async (res) => (res.ok ? ((await res.json()) as { items?: ModuleStateRow[] }) : null))
      .then((data) => {
        if (cancelled || !data?.items) return;
        setPending(
          new Set(data.items.filter((r) => r.pendingDeactivation).map((r) => r.moduleKey)),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    void Promise.all([
      orchFetch("/v1/billing/marketplace", { token }),
      orchFetch("/v1/billing/plans", { token }),
    ]).then(async ([mRes, pRes]) => {
      if (cancelled) return;
      if (mRes.ok) {
        setMarketplace((await mRes.json()) as MarketplaceSnapshot);
      }
      if (pRes.ok) {
        const data = (await pRes.json()) as { prices?: Record<string, number> };
        setPlans(data.prices ?? {});
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function runBilling(action: () => Promise<void>) {
    setBusy(true);
    setBillingErr(null);
    setBillingMsg(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setBillingErr(e instanceof Error ? e.message : tSub("billingFailed"));
    } finally {
      setBusy(false);
    }
  }

  const satelliteByKey = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of pricing?.pricingModules ?? []) map.set(m.key, m.satelliteKey ?? null);
    for (const m of pricing?.hospitalityModules ?? []) map.set(m.key, m.satelliteKey ?? null);
    return map;
  }, [pricing]);

  const moduleLabel = useMemo(() => buildModuleLabeler(pricing), [pricing]);

  const groups = useMemo(() => {
    const active = snapshot?.activeModules ?? [];
    const byGroup = new Map<string, string[]>();
    for (const slug of active) {
      const key = groupKeyForSlug(slug, satelliteByKey);
      const list = byGroup.get(key) ?? [];
      list.push(slug);
      byGroup.set(key, list);
    }
    const ordered: Array<{ key: string; label: string; slugs: string[] }> = [];
    const seen = new Set<string>();
    const emit = (key: string) => {
      const slugs = byGroup.get(key);
      if (!slugs || slugs.length === 0) return;
      seen.add(key);
      let label: string;
      if (key === PLATFORM_GROUP) label = tSub("platformModules");
      else if (key === OTHER_GROUP) label = tSub("otherModules");
      else if (SATELLITE_I18N[key]) label = tSys(`${SATELLITE_I18N[key]}.title` as "finance.title");
      else label = moduleLabel(key);
      ordered.push({ key, label, slugs: [...slugs].sort() });
    };
    for (const key of GROUP_ORDER) emit(key);
    for (const key of byGroup.keys()) if (!seen.has(key)) emit(key);
    return ordered;
  }, [snapshot?.activeModules, satelliteByKey, moduleLabel, tSub, tSys]);

  if (!ready) return null;

  const totalModules = snapshot?.activeModules?.length ?? 0;

  return (
    <>
      <Link href="/settings" className={SECONDARY_BUTTON_CLASS}>
        {t("title")}
      </Link>
      <h1 className="mt-4 text-xl font-semibold text-[#34495E]">{tSub("title")}</h1>

      {loading ? (
        <p className="mt-4 text-sm text-[#7F8C8D]">{tSub("loading")}</p>
      ) : (
        <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-5 p-4`}>
          <div className="grid gap-4 sm:grid-cols-3">
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
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
                {tSub("activeCount")}
              </p>
              <p className="mt-1 text-sm tabular-nums text-[#34495E]">{totalModules}</p>
            </div>
          </div>

          {snapshot?.readOnly ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {tSub("readOnlyBanner")}
            </p>
          ) : null}

          {groups.length === 0 ? (
            <p className="text-sm text-[#7F8C8D]">{tSub("noModules")}</p>
          ) : (
            groups.map((g) => (
              <div key={g.key}>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
                  {g.label}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {g.slugs.map((slug) => {
                    const isPending = pending.has(slug);
                    return (
                      <span
                        key={slug}
                        title={slug}
                        className={
                          isPending
                            ? "rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                            : "rounded-full bg-[#EBEDF0] px-2 py-0.5 text-[11px] font-medium text-[#475569]"
                        }
                      >
                        {moduleLabel(slug)}
                        {isPending ? ` · ${tSub("pendingOff")}` : ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <div className="flex flex-wrap gap-2 border-t border-[#EBEDF0] pt-4">
            <Link href="/workspace" className={PRIMARY_BUTTON_CLASS}>
              {tSub("manageModules")}
            </Link>
            <Link href="/pricing" className={SECONDARY_BUTTON_CLASS}>
              {tSub("managePricing")}
            </Link>
            <Link href="/settings/invoices" className={SECONDARY_BUTTON_CLASS}>
              {tSub("viewInvoices")}
            </Link>
            <Link href="/settings/orders" className={SECONDARY_BUTTON_CLASS}>
              {tSub("viewOrders")}
            </Link>
            <Link href="/help" className={SECONDARY_BUTTON_CLASS}>
              {tSub("contactSupport")}
            </Link>
          </div>
          <p className="text-xs text-[#7F8C8D]">{tSub("trialHint")}</p>
        </div>
      )}

      {ready && !loading ? (
        <div className={`${CARD_CONTAINER_CLASS} mt-4 space-y-5 p-4`}>
          <h2 className="text-sm font-semibold text-[#34495E]">{tSub("billingConstructor")}</h2>
          <p className="text-xs text-[#7F8C8D]">{tSub("billingConstructorHint")}</p>
          {billingErr ? <p className="text-sm text-red-600">{billingErr}</p> : null}
          {billingMsg ? <p className="text-sm text-emerald-700">{billingMsg}</p> : null}

          <section className="space-y-2 border-t border-[#EBEDF0] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {tSub("changePlan")}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-lg border border-[#D5DADF] px-3 text-sm"
                value={selectedTier}
                onChange={(e) =>
                  setSelectedTier(e.target.value as "TIER_1" | "TIER_2" | "TIER_3")
                }
              >
                {(["TIER_1", "TIER_2", "TIER_3"] as const).map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                    {plans[tier] != null ? ` · ${plans[tier]} AZN` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || !token}
                onClick={() =>
                  void runBilling(async () => {
                    const res = await orchFetch(
                      `/v1/billing/upgrade-preview?newTier=${selectedTier}`,
                      { token: token! },
                    );
                    if (!res.ok) throw new Error(tSub("previewFailed"));
                    const data = (await res.json()) as { amountToPay?: string };
                    setUpgradePreview(data.amountToPay ?? null);
                    setBillingMsg(
                      tSub("previewOk", { amount: data.amountToPay ?? "—" }),
                    );
                  })
                }
              >
                {tSub("previewUpgrade")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !token}
                onClick={() =>
                  void runBilling(async () => {
                    const res = await orchFetch("/v1/subscription/select-plan", {
                      token: token!,
                      method: "POST",
                      body: JSON.stringify({ tier: selectedTier }),
                    });
                    if (!res.ok) throw new Error(tSub("planFailed"));
                    setBillingMsg(tSub("planOk"));
                  })
                }
              >
                {tSub("applyPlan")}
              </button>
            </div>
            {upgradePreview ? (
              <p className="text-xs text-[#7F8C8D]">
                {tSub("previewAmount", { amount: upgradePreview })}
              </p>
            ) : null}
          </section>

          <section className="space-y-2 border-t border-[#EBEDF0] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {tSub("bundles")}
            </h3>
            {(marketplace?.bundles ?? []).length === 0 ? (
              <p className="text-sm text-[#7F8C8D]">{tSub("noBundles")}</p>
            ) : (
              <ul className="space-y-2">
                {(marketplace?.bundles ?? []).map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      {b.name}
                      {b.pricePerMonth != null ? ` · ${b.pricePerMonth} AZN` : ""}
                      {b.active ? ` · ${tSub("bundleActive")}` : ""}
                    </span>
                    <button
                      type="button"
                      className={SECONDARY_BUTTON_CLASS}
                      disabled={busy || !token}
                      onClick={() =>
                        void runBilling(async () => {
                          const res = await orchFetch("/v1/billing/toggle-bundle", {
                            token: token!,
                            method: "POST",
                            body: JSON.stringify({
                              bundleId: b.id,
                              enabled: !b.active,
                            }),
                          });
                          if (!res.ok) throw new Error(tSub("bundleFailed"));
                          setBillingMsg(tSub("bundleOk"));
                          const mRes = await orchFetch("/v1/billing/marketplace", {
                            token: token!,
                          });
                          if (mRes.ok) {
                            setMarketplace((await mRes.json()) as MarketplaceSnapshot);
                          }
                        })
                      }
                    >
                      {b.active ? tSub("disableBundle") : tSub("enableBundle")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 border-t border-[#EBEDF0] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {tSub("premiumUnlock")}
            </h3>
            <input
              className="h-9 w-full max-w-md rounded-lg border border-[#D5DADF] px-3 text-sm"
              placeholder={tSub("premiumPlaceholder")}
              value={premiumKeys}
              onChange={(e) => setPremiumKeys(e.target.value)}
            />
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={busy || !token || !premiumKeys.trim()}
              onClick={() =>
                void runBilling(async () => {
                  const modules = premiumKeys
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  const res = await orchFetch("/v1/billing/activate-premium", {
                    token: token!,
                    method: "POST",
                    body: JSON.stringify({
                      modules,
                      confirmCommercialStatus: true,
                    }),
                  });
                  if (!res.ok) throw new Error(tSub("premiumFailed"));
                  setBillingMsg(tSub("premiumOk"));
                })
              }
            >
              {tSub("activatePremium")}
            </button>
          </section>

          <section className="space-y-2 border-t border-[#EBEDF0] pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#7F8C8D]">
              {tSub("payments")}
            </h3>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs text-[#7F8C8D]">
                {tSub("checkoutAmount")}
                <input
                  className="mt-1 block h-9 w-28 rounded-lg border border-[#D5DADF] px-3 text-sm"
                  value={checkoutAmount}
                  onChange={(e) => setCheckoutAmount(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={busy || !token}
                onClick={() =>
                  void runBilling(async () => {
                    const amountAzn = Number(checkoutAmount);
                    const res = await orchFetch("/v1/billing/checkout", {
                      token: token!,
                      method: "POST",
                      body: JSON.stringify({
                        amountAzn,
                        tier: selectedTier,
                        provider: "pasha_bank",
                      }),
                    });
                    if (!res.ok) throw new Error(tSub("checkoutFailed"));
                    const data = (await res.json()) as {
                      paymentUrl?: string;
                      id?: string;
                    };
                    setBillingMsg(
                      data.paymentUrl
                        ? tSub("checkoutOkUrl", { url: data.paymentUrl })
                        : tSub("checkoutOk", { id: data.id ?? "—" }),
                    );
                    if (data.paymentUrl) {
                      window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
                    }
                  })
                }
              >
                {tSub("startCheckout")}
              </button>
              <label className="text-xs text-[#7F8C8D]">
                {tSub("ceilingAmount")}
                <input
                  className="mt-1 block h-9 w-28 rounded-lg border border-[#D5DADF] px-3 text-sm"
                  value={ceilingAmount}
                  onChange={(e) => setCeilingAmount(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={busy || !token}
                onClick={() =>
                  void runBilling(async () => {
                    const amountAzn = Number(ceilingAmount);
                    const res = await orchFetch("/v1/billing/tier-ceiling-unlock", {
                      token: token!,
                      method: "POST",
                      body: JSON.stringify({ amountAzn }),
                    });
                    if (!res.ok) throw new Error(tSub("ceilingFailed"));
                    setBillingMsg(tSub("ceilingOk"));
                  })
                }
              >
                {tSub("unlockCeiling")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
