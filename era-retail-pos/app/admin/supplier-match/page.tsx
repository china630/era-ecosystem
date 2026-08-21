"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  Field,
  FORM_STACK_CLASS,
  ModalFooter,
  ModalShell,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";

const formId = "supplier-match-form";

export default function SupplierMatchPage() {
  const t = useTranslations("admin.supplierMatch");
  const tc = useTranslations("common");
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
    <main className="mx-auto max-w-3xl p-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setModalOpen(true)}>
              {t("matchInvoice")}
            </button>
            <Link href="/admin/replenishment" className={SECONDARY_BUTTON_CLASS}>
              {t("replenishment")}
            </Link>
          </div>
        }
      />
      {result && (
        <pre className={`${CARD_CONTAINER_CLASS} mt-4 overflow-auto p-3 text-sm`}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}

      <ModalShell
        open={modalOpen}
        title={t("modalTitle")}
        onClose={() => setModalOpen(false)}
        footer={
          <ModalFooter
            formId={formId}
            onCancel={() => setModalOpen(false)}
            busy={busy}
            submitLabel={t("match")}
            cancelLabel={tc("cancel")}
          />
        }
      >
        <form id={formId} onSubmit={onSubmit} className={FORM_STACK_CLASS}>
          <Field
            label={t("invoiceRef")}
            preset="code"
            value={invoiceRef}
            onChange={(e) => setInvoiceRef(e.target.value)}
            placeholder={t("invoiceRefPlaceholder")}
            required
          />
        </form>
      </ModalShell>
    </main>
  );
}
