"use client";

import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { apiFetch } from "../../lib/api-client";
import { MODAL_FIELD_LABEL_CLASS, MODAL_INPUT_CLASS } from "../../lib/design-system";
import { SalesModalFooter, SalesModalShell } from "../sales/modals/modal-shell";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

const DEBIT_ROLES = [
  { value: "INVENTORY_GOODS", key: "networkInbox.debitInventory" },
  { value: "MISC_OPERATING_EXPENSE", key: "networkInbox.debitExpense" },
  { value: "PREPAID_ASSET", key: "networkInbox.debitPrepaid" },
] as const;

const lbl = MODAL_FIELD_LABEL_CLASS;

export function AcceptNetworkDocumentModal({
  open,
  documentId,
  onClose,
  onAccepted,
}: {
  open: boolean;
  documentId: string;
  onClose: () => void;
  onAccepted: () => void;
}) {
  const { t } = useTranslation();
  const [debitRole, setDebitRole] = useState<string>("MISC_OPERATING_EXPENSE");
  const [claimsVat, setClaimsVat] = useState(true);
  const [postingDate, setPostingDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await apiFetch(`/api/network/documents/inbox/${encodeURIComponent(documentId)}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debitRole, claimsVat, postingDate }),
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(await res.text());
      return;
    }
    toast.success(t("networkInbox.acceptDone", { defaultValue: "Sənəd qəbul edildi" }));
    onAccepted();
    onClose();
  }

  return (
    <SalesModalShell
      open={open}
      title={t("networkInbox.acceptTitle", { defaultValue: "Qəbul et" })}
      onClose={onClose}
      footer={<SalesModalFooter onCancel={onClose} busy={busy} formId="accept-netdoc-form" />}
    >
      <form id="accept-netdoc-form" className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <span className={lbl}>{t("networkInbox.debitRole", { defaultValue: "Debit hesabı (rol)" })}</span>
          <Select value={debitRole} onValueChange={setDebitRole}>
            <SelectTrigger className={MODAL_INPUT_CLASS} />
            <SelectContent>
              {DEBIT_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {t(r.key, { defaultValue: r.value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={claimsVat}
            onChange={(e) => setClaimsVat(e.target.checked)}
          />
          {t("networkInbox.claimsVat", { defaultValue: "ƏDV-nin qəbulu (241)" })}
        </label>
        <div>
          <span className={lbl}>{t("networkInbox.postingDate", { defaultValue: "Ödəniş tarixi" })}</span>
          <input
            type="date"
            className={MODAL_INPUT_CLASS}
            value={postingDate}
            onChange={(e) => setPostingDate(e.target.value)}
          />
        </div>
      </form>
    </SalesModalShell>
  );
}
