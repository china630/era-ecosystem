"use client";

import { useLocale, useTranslations } from "next-intl";
import { HeaderTierUsageBar } from "@era/satellite-kit/ui";
import { useAuth } from "../lib/auth-context";
import { useSubscription } from "../lib/subscription-context";

function formatTrialEnd(iso: string, locale: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : locale === "az" ? "az-Latn-AZ" : "en-GB", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone: "Asia/Baku",
  }).format(date);
}

export function OrchestratorHeaderTierBar() {
  const t = useTranslations("headerStrip");
  const locale = useLocale();
  const { token, user } = useAuth();
  const { loading, snapshot } = useSubscription();

  if (!token || !user?.organizationId || loading || !snapshot?.tier) {
    return null;
  }

  const tier = String(snapshot.tier).toUpperCase();
  const trialEndIso = snapshot.isTrial ? snapshot.expiresAt : null;
  const showTrialUntil =
    trialEndIso != null && new Date(trialEndIso).getTime() > Date.now();

  const employees = snapshot.quotas?.employees;
  const invoices = snapshot.quotas?.invoicesThisMonth;

  return (
    <HeaderTierUsageBar
      tier={tier}
      tierSuffix={
        <>
          {showTrialUntil && trialEndIso ? (
            <span className="font-normal normal-case text-amber-800">
              · {t("trialUntil", { date: formatTrialEnd(trialEndIso, locale) })}
            </span>
          ) : null}
          {snapshot.readOnly ? (
            <span className="font-normal normal-case text-red-700">
              · {t("readOnly")}
            </span>
          ) : null}
        </>
      }
      quotas={[
        {
          key: "invoices",
          label: t("invoices"),
          current: invoices?.current ?? 0,
          max: invoices?.max ?? null,
        },
        {
          key: "employees",
          label: t("employees"),
          current: employees?.current ?? 0,
          max: employees?.max ?? null,
        },
      ]}
      manageHref="/settings/subscription"
      manageLabel={t("manage")}
    />
  );
}
