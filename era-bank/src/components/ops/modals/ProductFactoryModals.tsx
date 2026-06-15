"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { OpsError, OpsField } from "@/components/ops-ui";

type ProductFactoryCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function ProductFactoryCreateModal({
  open,
  onClose,
  onCreated,
}: ProductFactoryCreateModalProps) {
  const t = useTranslations("pages.productFactory");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = "product-factory-create-form";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/product-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          productType: form.get("productType"),
          paramsJson: {
            termMonths: Number(form.get("termMonths")),
            rateApr: Number(form.get("rateApr")),
            currency: form.get("currency") ?? "AZN",
            glLiabilityCode: form.get("glLiabilityCode"),
            glAssetCode: form.get("glAssetCode"),
          },
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      e.currentTarget.reset();
      onCreated();
      onClose();
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("create")}
      subtitle={t("subtitle")}
      onClose={onClose}
      formId={formId}
      submitLabel={t("create")}
      busy={busy}
      maxWidthClass="max-w-2xl"
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <OpsField name="code" label={t("code")} defaultValue="TERM-AZN-12" />
        <OpsField name="name" label={t("name")} defaultValue="12-month AZN term deposit" />
        <label>
          <span className="mb-1 block text-[12px] text-muted-foreground">{t("kind")}</span>
          <select name="productType" className="w-full rounded border px-3 py-2 text-sm" defaultValue="DEPOSIT">
            <option value="DEPOSIT">Deposit</option>
            <option value="LOAN">Loan</option>
            <option value="CURRENT">Current account</option>
          </select>
        </label>
        <OpsField name="currency" label={t("currency")} defaultValue="AZN" />
        <OpsField name="termMonths" label={t("termMonths")} type="number" defaultValue={12} />
        <OpsField name="rateApr" label={t("rateApr")} type="number" defaultValue={8.5} />
        <OpsField name="glLiabilityCode" label={t("glLiability")} defaultValue="2200201" />
        <OpsField name="glAssetCode" label={t("glAsset")} defaultValue="1300101" />
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}
