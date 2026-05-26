"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CARD_CONTAINER_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

export default function WholesaleAdminSettingsPage() {
  const [warehouseName, setWarehouseName] = useState("Demo warehouse");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(warehouseName);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Wholesale settings"
        subtitle="Admin — UI playbook (list + ModalShell)"
        actions={
          <Link href="/pick-lists" className={SECONDARY_BUTTON_CLASS}>
            Pick lists
          </Link>
        }
      />
      <table className={`${CARD_CONTAINER_CLASS} mt-4 w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">Field</th>
            <th className="p-3">Value</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium">Warehouse</td>
            <td className="p-3">{warehouseName}</td>
            <td className="p-3 text-right">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => { setDraft(warehouseName); setOpen(true); }}>
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <ModalShell open={open} title="Edit warehouse" onClose={() => setOpen(false)}>
        <input
          className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => { setWarehouseName(draft.trim() || warehouseName); setOpen(false); }} submitLabel="Save" />
      </ModalShell>
    </div>
  );
}
