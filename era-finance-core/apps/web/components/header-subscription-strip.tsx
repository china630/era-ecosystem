"use client";

import { parseISO } from "date-fns";
import { useTranslation } from "react-i18next";
import { HeaderTierUsageBar } from "@era/satellite-kit/ui";
import { bakuDateDisplay } from "@era/satellite-kit/time";
import { useAuth } from "../lib/auth-context";
import { useSubscription } from "../lib/subscription-context";

export function HeaderSubscriptionStrip() {
  const { t } = useTranslation();
  const { token, user } = useAuth();
  const { ready, effectiveSnapshot: snapshot } = useSubscription();

  if (!token || !user?.organizationId || !ready || !snapshot) {
    return null;
  }

  const tier = String(snapshot.tier).toUpperCase();
  const demoEndIso = snapshot.isTrial ? snapshot.expiresAt : null;
  const demoEndMs = demoEndIso ? parseISO(demoEndIso).getTime() : null;
  const showTrialUntil =
    demoEndMs != null && demoEndMs > Date.now() && demoEndIso != null;

  const tierSuffix = (
    <>
      {showTrialUntil ? (
        <span className="font-normal normal-case text-amber-800">
          ·{" "}
          {t("headerStrip.trialUntil", {
            date: bakuDateDisplay(demoEndIso!),
          })}
        </span>
      ) : null}
      {snapshot.readOnly ? (
        <span className="font-normal normal-case text-red-700">
          · {t("headerStrip.readOnly")}
        </span>
      ) : null}
    </>
  );

  return (
    <HeaderTierUsageBar
      tier={tier}
      tierSuffix={tierSuffix}
      quotas={[
        {
          key: "invoices",
          label: t("headerStrip.invoices"),
          current: snapshot.quotas.invoicesThisMonth.current,
          max: snapshot.quotas.invoicesThisMonth.max,
        },
        {
          key: "employees",
          label: t("headerStrip.employees"),
          current: snapshot.quotas.employees.current,
          max: snapshot.quotas.employees.max,
        },
      ]}
      manageHref="/settings/subscription"
      manageLabel={t("headerStrip.manage")}
    />
  );
}
