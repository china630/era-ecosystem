"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { OpsError, OpsField } from "@/components/ops-ui";

type BranchCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function BranchCreateModal({ open, onClose, onCreated }: BranchCreateModalProps) {
  const t = useTranslations("pages.branches");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = "branch-create-form";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          isHeadOffice: form.get("isHeadOffice") === "on",
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
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <OpsField name="code" label={t("code")} defaultValue="" />
        <OpsField name="name" label={t("name")} defaultValue="" />
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="isHeadOffice" />
          {t("headOffice")}
        </label>
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}
