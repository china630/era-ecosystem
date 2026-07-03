"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FieldSelect, PRIMARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { useEodLock } from "@/components/ops/EodLockProvider";
import { OpsError, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type PaymentDetail = {
  id: string;
  status?: string;
  debtorAccountId?: string;
  creditorIban?: string;
  amountMinor?: unknown;
  currency?: string;
  rail?: string;
  narrative?: string;
  railMessages?: Array<{ id: string; payloadJson?: unknown; createdAt?: string }>;
};

const FLOW = ["DRAFT", "SUBMITTED", "SETTLED"];

type PaymentCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function PaymentCreateModal({ open, onClose, onCreated }: PaymentCreateModalProps) {
  const t = useTranslations("pages.payments");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = "payment-create-form";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payments/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          debtorAccountId: form.get("debtorAccountId"),
          creditorIban: form.get("creditorIban"),
          amountMinor: String(form.get("amountMinor")),
          currency: "AZN",
          rail: form.get("rail") ?? "STUB",
          idempotencyKey: `pay-${Date.now()}`,
          narrative: form.get("narrative"),
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const order = (await res.json()) as { id: string };
      onCreated(order.id);
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("newTitle")}
      subtitle={t("newSubtitle")}
      onClose={onClose}
      formId={formId}
      submitLabel={t("createDraft")}
      busy={busy}
      maxWidthClass="max-w-2xl"
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field name="debtorAccountId" label={t("debitAccount")} preset="code" defaultValue="demo-retail-acc-1" />
        <Field name="creditorIban" label={t("beneficiaryIban")} preset="longText" defaultValue="AZ00BANK00000000000001" />
        <Field
          name="amountMinor"
          label={t("amount")}
          preset="amount"
          type="number"
          min={1}
          defaultValue={250000}
          placeholder="Amount in qepik (minor units)"
        />
        <FieldSelect name="rail" label={t("rail")} preset="selectWide" defaultValue="AZIPS">
          <option value="AZIPS">AZIPS (stub sandbox)</option>
          <option value="INTERNAL">INTERNAL</option>
        </FieldSelect>
        <Field name="narrative" label={t("purpose")} preset="shortText" className="sm:col-span-2" />
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}

type PaymentDetailModalProps = {
  open: boolean;
  paymentId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function PaymentDetailModal({
  open,
  paymentId,
  onClose,
  onUpdated,
}: PaymentDetailModalProps) {
  const t = useTranslations("pages.payments");
  const tCommon = useTranslations("common");
  const { mutationsDisabled } = useEodLock();
  const [data, setData] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!paymentId) return;
    setError(null);
    try {
      const res = await fetch(`/api/payments/orders/${paymentId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setData((await res.json()) as PaymentDetail);
    } catch {
      setError(tCommon("error"));
    }
  }, [paymentId, tCommon]);

  useEffect(() => {
    if (open && paymentId) void load();
    if (!open) setData(null);
  }, [open, paymentId, load]);

  async function submit() {
    if (!paymentId) return;
    const res = await fetch(`/api/payments/orders/${paymentId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  const currentIdx = data?.status ? FLOW.indexOf(data.status) : -1;

  return (
    <OpsModalShell
      open={open}
      title={t("detailTitle")}
      subtitle={paymentId ?? undefined}
      onClose={onClose}
      hideFooter
      maxWidthClass="max-w-2xl"
    >
      <OpsError message={error} />
      {data ? (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              Status: {data.status ? <StatusBadge status={data.status} /> : "—"}
            </div>
            <div>Amount: {formatAznMinor(data.amountMinor)}</div>
            <div>Debit: {data.debtorAccountId ?? "—"}</div>
            <div>Beneficiary: {data.creditorIban ?? "—"}</div>
            <div>
              Rail: {data.rail ?? "—"}
              {data.rail === "AZIPS" || data.rail === "SWIFT" ? " (stub sandbox)" : ""}
            </div>
            <div>Purpose: {data.narrative ?? "—"}</div>
          </div>
          <div>
            <h3 className="mb-2 font-medium">{t("timeline")}</h3>
            <ol className="flex flex-wrap gap-2 text-xs">
              {FLOW.map((step, i) => (
                <li
                  key={step}
                  className={`rounded px-2 py-1 ${
                    data.status === step
                      ? "bg-primary text-primary-foreground"
                      : i <= currentIdx
                        ? "bg-emerald-100"
                        : "bg-muted"
                  }`}
                >
                  {step}
                </li>
              ))}
            </ol>
          </div>
          {data.status === "DRAFT" ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={mutationsDisabled}
              onClick={() => void submit()}
            >
              {t("submit")}
            </button>
          ) : null}
          {data.railMessages?.length ? (
            <div>
              <h3 className="mb-2 font-medium">{t("railMessages")}</h3>
              <pre className="overflow-auto text-xs">
                {JSON.stringify(data.railMessages, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </OpsModalShell>
  );
}
