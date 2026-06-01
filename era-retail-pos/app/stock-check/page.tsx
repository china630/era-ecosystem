"use client";

import { useState } from "react";
import {
  FORM_FIELD_GROUP_CLASS,
  FORM_STACK_CLASS,
  MODAL_FIELD_LABEL_CLASS,
  ModalFooter,
  ModalShell,
  MODAL_INPUT_CLASS,
  PRIMARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

const formId = "stock-check-form";

export default function StockCheckPage() {
  const [sku, setSku] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/stock/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        actualQty: actualQty ? Number(actualQty) : undefined,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data?.message ?? "Check failed");
      return;
    }
    setResult(data);
    setModalOpen(false);
    setSku("");
    setActualQty("");
  }

  return (
    <main className="mx-auto max-w-lg p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Stock check (M14)</h1>
        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
          Check stock
        </button>
      </div>
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {result && (
        <pre className="mt-4 overflow-auto rounded bg-gray-100 p-3 text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <ModalShell
        open={modalOpen}
        title="Stock check"
        onClose={() => setModalOpen(false)}
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel="Check"
          />
        }
      >
        <form id={formId} onSubmit={onSubmit} className={FORM_STACK_CLASS}>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>SKU / barcode</label>
            <input
              className={MODAL_INPUT_CLASS}
              placeholder="SKU / barcode"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
            />
          </div>
          <div className={FORM_FIELD_GROUP_CLASS}>
            <label className={MODAL_FIELD_LABEL_CLASS}>Actual qty (optional)</label>
            <input
              className={MODAL_INPUT_CLASS}
              placeholder="Actual qty (optional)"
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
            />
          </div>
        </form>
      </ModalShell>
    </main>
  );
}
