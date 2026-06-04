"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../../lib/api-client";
import { notifyListRefresh } from "../../../lib/list-refresh-bus";
import { MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS } from "../../../lib/design-system";
import { SalesModalFooter, SalesModalShell } from "../../sales/modals/modal-shell";

const lbl = MODAL_FIELD_LABEL_CLASS;

export function CreatePrepaidExpenseModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("1000");
  const [start, setStart] = useState("2025-01-01");
  const [end, setEnd] = useState("2025-03-31");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch("/api/prepaid-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: description.trim() || undefined,
        totalAmount: total,
        startDate: start,
        endDate: end,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("common.save"));
    notifyListRefresh("prepaid-expenses");
    onCreated?.();
    onClose();
  }

  return (
    <SalesModalShell
      open={open}
      title={t("prepaid.newTitle", { defaultValue: "Yeni RBP" })}
      onClose={onClose}
      footer={<SalesModalFooter onCancel={onClose} busy={busy} formId="create-prepaid-form" />}
    >
      <form id="create-prepaid-form" className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <span className={lbl}>{t("prepaid.description", { defaultValue: "Təsvir" })}</span>
          <input
            className={MODAL_INPUT_CLASS}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>
        <div>
          <span className={lbl}>{t("prepaid.total", { defaultValue: "Məbləğ" })}</span>
          <input
            className={MODAL_INPUT_CLASS}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={lbl}>{t("prepaid.start", { defaultValue: "Başlanğıc" })}</span>
            <input
              type="date"
              className={MODAL_INPUT_CLASS}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <span className={lbl}>{t("prepaid.end", { defaultValue: "Son" })}</span>
            <input
              type="date"
              className={MODAL_INPUT_CLASS}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
      </form>
    </SalesModalShell>
  );
}
