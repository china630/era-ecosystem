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

export default function SettingsPage() {
  const [storeName, setStoreName] = useState("Demo Store");
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState(storeName);

  function openEdit() {
    setDraft(storeName);
    setModalOpen(true);
  }

  function save() {
    setStoreName(draft.trim() || storeName);
    setModalOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store settings"
        subtitle="Admin — modal CRUD pilot (SP9 UI playbook)"
        actions={
          <Link href="/" className={SECONDARY_BUTTON_CLASS}>
            ← Home
          </Link>
        }
      />
      <table className={`${CARD_CONTAINER_CLASS} w-full text-left text-sm`}>
        <thead>
          <tr className="border-b border-[#D5DADF] text-[#7F8C8D]">
            <th className="p-3">Field</th>
            <th className="p-3">Value</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3 font-medium">Store name</td>
            <td className="p-3">{storeName}</td>
            <td className="p-3 text-right">
              <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={openEdit}>
                Edit
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <ModalShell
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Edit store name"
      >
        <label className="block text-sm font-medium text-[#34495E]">Name</label>
        <input
          className="mt-2 h-9 w-full rounded-lg border border-[#D5DADF] px-3 text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <ModalFooter
          onCancel={() => setModalOpen(false)}
          onSubmit={save}
          submitLabel="Save"
        />
      </ModalShell>
    </div>
  );
}
