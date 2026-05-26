"use client";

import { useState } from "react";
import {
  CARD_CONTAINER_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { cpAdminFetch } from "../../../../lib/cp-admin-fetch";
import { useBilling } from "../billing-context";

export default function SuperAdminBillingPackagesPage() {
  const { billing, loading, error, reload } = useBilling();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [discount, setDiscount] = useState("10");
  const [moduleKeys, setModuleKeys] = useState("industry_retail_pos");
  const [busy, setBusy] = useState(false);

  async function createBundle() {
    setBusy(true);
    try {
      await cpAdminFetch("pricing-bundles", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || "New bundle",
          discountPercent: Number.parseFloat(discount) || 0,
          moduleKeys: moduleKeys.split(",").map((k) => k.trim()).filter(Boolean),
        }),
      });
      setOpen(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function removeBundle(id: string) {
    if (!confirm("Delete bundle?")) return;
    await cpAdminFetch(`pricing-bundles/${id}`, { method: "DELETE" });
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setOpen(true)}>
          New bundle
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-[#7F8C8D]">Loading…</p> : null}
      <table className={`${CARD_CONTAINER_CLASS} w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">Bundle</th>
            <th className="p-3">Discount %</th>
            <th className="p-3">Modules</th>
            <th className="p-3">Trial</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {(billing?.pricingBundles ?? []).map((b) => (
            <tr key={b.id} className="border-b border-[#EEF0F2]">
              <td className="p-3 font-medium">{b.name}</td>
              <td className="p-3">{b.discountPercent}</td>
              <td className="p-3 font-mono text-xs">{b.moduleKeys.join(", ")}</td>
              <td className="p-3">{b.isTrialDefault ? "Yes" : "—"}</td>
              <td className="p-3 text-right">
                <button
                  type="button"
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={() => void removeBundle(b.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ModalShell open={open} title="Create bundle" onClose={() => setOpen(false)}>
        <div className="space-y-3 text-sm">
          <label className="block">
            Name
            <input className="mt-1 h-9 w-full rounded-lg border border-[#D5DADF] px-3" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            Discount %
            <input className="mt-1 h-9 w-full rounded-lg border border-[#D5DADF] px-3" value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </label>
          <label className="block">
            Module keys (comma-separated)
            <input className="mt-1 h-9 w-full rounded-lg border border-[#D5DADF] px-3" value={moduleKeys} onChange={(e) => setModuleKeys(e.target.value)} />
          </label>
        </div>
        <ModalFooter busy={busy} onCancel={() => setOpen(false)} onSubmit={() => void createBundle()} submitLabel="Create" />
      </ModalShell>
    </div>
  );
}
