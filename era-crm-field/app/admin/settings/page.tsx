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

export default function CrmSettingsPage() {
  const [teamName, setTeamName] = useState("Field sales");
  const [voen, setVoen] = useState("");
  const [mdmResult, setMdmResult] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(teamName);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <PageHeader
        title="CRM settings"
        subtitle="UI playbook + MDM VÖEN lookup"
        actions={
          <Link href="/leads" className={SECONDARY_BUTTON_CLASS}>
            Leads
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
            <td className="p-3 font-medium">Team name</td>
            <td className="p-3">{teamName}</td>
            <td className="p-3 text-right">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => { setDraft(teamName); setOpen(true); }}>
                Edit
              </button>
            </td>
          </tr>
          <tr>
            <td className="p-3 font-medium">VÖEN lookup</td>
            <td className="p-3">
              <input
                className="h-9 w-full max-w-xs rounded-lg border border-[#D5DADF] px-3 text-sm"
                value={voen}
                onChange={(e) => setVoen(e.target.value)}
                placeholder="1234567890"
              />
            </td>
            <td className="p-3 text-right">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                onClick={() => {
                  void fetch("/api/mdm/voen-lookup", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ taxId: voen }),
                  })
                    .then((r) => r.json())
                    .then((d) =>
                      setMdmResult(
                        d.organizationId
                          ? `Org ${String(d.organizationId).slice(0, 8)}…`
                          : "Not found",
                      ),
                    );
                }}
              >
                Lookup
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      {mdmResult ? <p className="mt-2 text-xs text-[#7F8C8D]">{mdmResult}</p> : null}
      <ModalShell open={open} title="Edit team" onClose={() => setOpen(false)}>
        <input className="h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} />
        <ModalFooter onCancel={() => setOpen(false)} onSubmit={() => { setTeamName(draft.trim() || teamName); setOpen(false); }} submitLabel="Save" />
      </ModalShell>
    </div>
  );
}
