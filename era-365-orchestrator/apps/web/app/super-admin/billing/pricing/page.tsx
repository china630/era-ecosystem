"use client";

import { useEffect, useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { useBilling } from "../billing-context";

export default function SuperAdminBillingPricingPage() {
  const { billing, loading, error, reload, seedPricing } = useBilling();
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [foundation, setFoundation] = useState("29");

  useEffect(() => {
    if (!billing) return;
    const next: Record<string, string> = {};
    for (const m of billing.pricingModules) {
      next[m.id] = String(m.pricePerMonth);
    }
    setEdits(next);
    setFoundation(String(billing.foundationMonthlyAzn));
  }, [billing]);

  async function saveModule(id: string) {
    const price = Number.parseFloat(edits[id] ?? "");
    if (!Number.isFinite(price) || price < 0) return;
    setSaving(true);
    try {
      await cpAdminFetch(`pricing-modules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ pricePerMonth: price }),
      });
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function saveFoundation() {
    const n = Number.parseFloat(foundation);
    if (!Number.isFinite(n) || n < 0) return;
    setSaving(true);
    try {
      await cpAdminFetch("config/billing/foundation", {
        method: "PATCH",
        body: JSON.stringify({ foundationMonthlyAzn: n }),
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
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap items-end gap-3 p-4`}>
        <label className="text-sm">
          Foundation (AZN/mo)
          <input
            className="mt-1 block h-9 w-28 rounded-lg border border-[#D5DADF] px-2 text-sm"
            value={foundation}
            onChange={(e) => setFoundation(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={PRIMARY_BUTTON_CLASS}
          disabled={saving}
          onClick={() => void saveFoundation()}
        >
          Save foundation
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON_CLASS}
          disabled={saving}
          onClick={() => void seedPricing()}
        >
          Seed catalog
        </button>
      </div>
      <table className={`${CARD_CONTAINER_CLASS} w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">Module</th>
            <th className="p-3">Key</th>
            <th className="p-3">AZN/mo</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {(billing?.pricingModules ?? []).map((m) => (
            <tr key={m.id} className="border-b border-[#EEF0F2]">
              <td className="p-3 font-medium">{m.name}</td>
              <td className="p-3 font-mono text-xs">{m.key}</td>
              <td className="p-3">
                <input
                  className="h-9 w-24 rounded-lg border border-[#D5DADF] px-2 text-sm"
                  value={edits[m.id] ?? ""}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [m.id]: e.target.value }))
                  }
                />
              </td>
              <td className="p-3 text-right">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  disabled={saving}
                  onClick={() => void saveModule(m.id)}
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
