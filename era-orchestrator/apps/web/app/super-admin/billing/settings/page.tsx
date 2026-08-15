"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { useBilling } from "../billing-context";

export default function SuperAdminBillingSettingsPage() {
  const t = useTranslations("superAdmin.billingSettings");
  const { billing, loading, error, reload } = useBilling();
  const [foundation, setFoundation] = useState("29");
  const [bankingFoundation, setBankingFoundation] = useState("0");
  const [yearly, setYearly] = useState("20");
  const [trialDays, setTrialDays] = useState("90");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!billing) return;
    setFoundation(String(billing.foundationMonthlyAzn));
    setBankingFoundation(String(billing.bankingFoundationMonthlyAzn ?? 0));
    setYearly(String(billing.yearlyDiscountPercent));
    setTrialDays(String(billing.trialPeriodDays ?? 90));
  }, [billing]);

  async function save() {
    const foundationN = Number.parseFloat(foundation);
    const bankingN = Number.parseFloat(bankingFoundation);
    const yearlyN = Number.parseFloat(yearly);
    const trialN = Number.parseInt(trialDays, 10);
    if (!Number.isFinite(foundationN) || foundationN < 0) return;
    if (!Number.isFinite(bankingN) || bankingN < 0) return;
    if (!Number.isFinite(yearlyN) || yearlyN < 0 || yearlyN > 100) return;
    if (!Number.isFinite(trialN) || trialN < 1 || trialN > 730) return;
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        cpAdminFetch("config/billing/foundation", {
          method: "PATCH",
          body: JSON.stringify({ amountAzn: foundationN }),
        }),
        cpAdminFetch("config/billing/banking-foundation", {
          method: "PATCH",
          body: JSON.stringify({ amountAzn: bankingN }),
        }),
        cpAdminFetch("config/billing/yearly-discount", {
          method: "PATCH",
          body: JSON.stringify({ percent: yearlyN }),
        }),
        cpAdminFetch("config/billing/trial-days", {
          method: "PATCH",
          body: JSON.stringify({ days: trialN }),
        }),
      ]);
      await reload();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#34495E]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#7F8C8D]">{t("subtitle")}</p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">{t("loading")}</p> : null}

      <div className={`${CARD_CONTAINER_CLASS} space-y-4 p-4`}>
        <label className="block text-sm">
          {t("foundationLabel")}
          <input
            className="mt-1 block h-9 w-40 rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={foundation}
            onChange={(e) => setFoundation(e.target.value)}
          />
          <span className="mt-1 block text-xs text-[#95A5A6]">{t("foundationHint")}</span>
        </label>
        <label className="block text-sm">
          {t("bankingFoundationLabel")}
          <input
            className="mt-1 block h-9 w-40 rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={bankingFoundation}
            onChange={(e) => setBankingFoundation(e.target.value)}
          />
          <span className="mt-1 block text-xs text-[#95A5A6]">
            {t("bankingFoundationHint")}
          </span>
        </label>
        <label className="block text-sm">
          {t("yearlyDiscount")}
          <input
            className="mt-1 block h-9 w-40 rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={yearly}
            onChange={(e) => setYearly(e.target.value)}
          />
          <span className="mt-1 block text-xs text-[#95A5A6]">{t("yearlyDiscountHint")}</span>
        </label>
        <label className="block text-sm">
          {t("trialPeriodDays")}
          <input
            className="mt-1 block h-9 w-40 rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
          />
          <span className="mt-1 block text-xs text-[#95A5A6]">{t("trialPeriodDaysHint")}</span>
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? t("saving") : t("save")}
          </button>
          {saved ? <span className="text-sm text-emerald-700">{t("saved")}</span> : null}
        </div>
      </div>
    </div>
  );
}
