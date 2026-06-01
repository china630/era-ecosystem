"use client";

import { format, parseISO } from "date-fns";
import { az as azLocale, ru as ruLocale } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { HeaderTierUsageBar } from "@era/satellite-kit/ui";
import { useAuth } from "../../lib/auth-context";
import { uiLangRuAz } from "../../lib/i18n/ui-lang";
import { useSubscription } from "../../lib/subscription-context";

function shortDemoEnd(iso: string, lang: string): string {
  const d = parseISO(iso);
  const loc = uiLangRuAz(lang) === "ru" ? ruLocale : azLocale;
  return format(d, "d.MM.yyyy", { locale: loc });
}

export function HeaderSubscriptionStrip() {
  const { t, i18n } = useTranslation();
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
            date: shortDemoEnd(demoEndIso!, i18n.language),
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
