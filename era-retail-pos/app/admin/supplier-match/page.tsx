"use client";

import { useState } from "react";
import {
  Field,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

const formId = "supplier-match-form";

export default function SupplierMatchPage() {
  const [invoiceRef, setInvoiceRef] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/suppliers/invoices/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceRef }),
    });
    setResult(await res.json());
    setBusy(false);
    setModalOpen(false);
    setInvoiceRef("");
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Supplier match (M16)</h1>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
          Match invoice
        </button>
      </div>
      {result && (
        <pre className="mt-4 overflow-auto rounded bg-gray-100 p-3 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <ModalShell
        open={modalOpen}
        title="Supplier match"
        onClose={() => setModalOpen(false)}
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel="Match"
          />
        }
      >
        <form id={formId} onSubmit={onSubmit} className={FORM_STACK_CLASS}>
          <Field
            label="Invoice ref"
            preset="code"
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
            placeholder="Invoice ref"
            required
          />
        </form>
      </ModalShell>
    </main>
  );
}
