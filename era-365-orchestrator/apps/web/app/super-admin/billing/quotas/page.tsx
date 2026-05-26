"use client";

import { useEffect, useState } from "react";
import { CARD_CONTAINER_CLASS, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { useBilling } from "../billing-context";

export default function SuperAdminBillingQuotasPage() {
  const { billing, loading, error, reload } = useBilling();
  const [yearly, setYearly] = useState("20");
  const [ocr, setOcr] = useState("200");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!billing) return;
    setYearly(String(billing.yearlyDiscountPercent));
    setOcr(String(billing.ocrJobsPerOrgMonth));
  }, [billing]);

  async function save() {
    setSaving(true);
    try {
      await cpAdminFetch("config/billing/yearly-discount", {
        method: "PATCH",
        body: JSON.stringify({
          yearlyDiscountPercent: Number.parseFloat(yearly),
        }),
      });
      await cpAdminFetch("config/billing/ocr-jobs-per-org-month", {
        method: "PATCH",
        body: JSON.stringify({
          ocrJobsPerOrgMonth: Number.parseInt(ocr, 10),
        }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      <div className={`${CARD_CONTAINER_CLASS} grid max-w-md gap-3 p-4`}>
        <label className="text-sm">
          Yearly discount (%)
          <input
            className="mt-1 block h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={yearly}
            onChange={(e) => setYearly(e.target.value)}
          />
        </label>
        <label className="text-sm">
          OCR jobs per org / month
          <input
            className="mt-1 block h-9 w-full rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={ocr}
            onChange={(e) => setOcr(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={saving}
          onClick={() => void save()}
        >
          Save quotas
        </button>
      </div>
      <pre className={`${CARD_CONTAINER_CLASS} overflow-auto p-4 text-xs`}>
        {billing ? JSON.stringify(billing.quotas, null, 2) : "—"}
      </pre>
    </div>
  );
}
