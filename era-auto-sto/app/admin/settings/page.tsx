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

export default function AutoSettingsPage() {
  const [workshopName, setWorkshopName] = useState("Demo STO");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(workshopName);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="Workshop settings"
        subtitle="UI playbook — Fleet bundle admin"
        actions={
          <Link href="/appointments" className={SECONDARY_BUTTON_CLASS}>
            Appointments
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
            <td className="p-3 font-medium">Workshop</td>
            <td className="p-3">{workshopName}</td>
            <td className="p-3 text-right">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => { setDraft(workshopName); setOpen(true); }}>
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <ModalShell open={open} title="Edit workshop" onClose={() => setOpen(false)}>
        <input className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => { setWorkshopName(draft.trim() || workshopName); setOpen(false); }} submitLabel="Save" />
      </ModalShell>
    </div>
  );
}
