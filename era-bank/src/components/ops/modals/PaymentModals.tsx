"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CatalogField,
  Field,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { useEodLock } from "@/components/ops/EodLockProvider";
import { useOpsMe } from "@/components/ops/useOpsMe";
import { OpsError, StatusBadge, formatAznMinor } from "@/components/ops-ui";
import {
  CURRENCY_OPTIONS,
  PAYMENT_RAIL_OPTIONS,
  loadAccountOptions,
  majorToMinor,
  type LookupOption,
  withOrphanOption,
} from "@/lib/bank-lookups";

type PaymentDetail = {
  id: string;
  status?: string;
  debtorAccountId?: string;
  creditorIban?: string;
  amountMinor?: unknown;
  currency?: string;
  rail?: string;
  narrative?: string;
  createdByUserId?: string;
  railMessages?: Array<{ id: string; payloadJson?: unknown; createdAt?: string }>;
};

const FLOW = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SETTLED"];

type PaymentCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function PaymentCreateModal({
  open,
  onClose,
  onCreated,
}: PaymentCreateModalProps) {
  const t = useTranslations("pages.payments");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rail, setRail] = useState("AZIPS");
  const [currency, setCurrency] = useState("AZN");
  const [accountOpts, setAccountOpts] = useState<LookupOption[]>([]);
  const [debtorAccountId, setDebtorAccountId] = useState("");
  const formId = "payment-create-form";

  useEffect(() => {
    if (!open) return;
    void loadAccountOptions().then(setAccountOpts);
  }, [open]);

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
          debtorAccountId: debtorAccountId || undefined,
          creditorIban: form.get("creditorIban"),
          amountMinor: String(majorToMinor(String(form.get("amountMajor") ?? "0"))),
          currency,
          rail,
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
        <CatalogField
          kind="ENTITY_REF"
          label={t("debitAccount")}
          options={withOrphanOption(accountOpts, debtorAccountId)}
          value={debtorAccountId}
          onChange={(next) =>
            setDebtorAccountId(Array.isArray(next) ? next[0] ?? "" : next)
          }
        />
        <Field
          name="creditorIban"
          label={t("beneficiaryIban")}
          preset="longText"
          required
          defaultValue=""
        />
        <Field
          name="amountMajor"
          label={t("amountMajor")}
          preset="amount"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={2500}
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("currency")}
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={(next) =>
            setCurrency(Array.isArray(next) ? next[0] ?? "AZN" : next)
          }
        />
        <CatalogField
          kind="CLOSED_SMALL"
          label={t("rail")}
          options={PAYMENT_RAIL_OPTIONS}
          value={rail}
          onChange={(next) =>
            setRail(Array.isArray(next) ? next[0] ?? "AZIPS" : next)
          }
        />
        <Field
          name="narrative"
          label={t("purpose")}
          preset="shortText"
          className="sm:col-span-2"
        />
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
  const me = useOpsMe();
  const canApprove = me?.canApprove === true;
  const [data, setData] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const load = useCallback(async () => {
    if (!paymentId) return;
    setError(null);
    try {
      const res = await fetch(`/api/payments/orders/${paymentId}`, {
        cache: "no-store",
      });
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
    if (!open) {
      setData(null);
      setRejectReason("");
    }
  }, [open, paymentId, load]);

  async function postAction(path: string, body?: object) {
    if (!paymentId) return;
    const res = await fetch(`/api/payments/orders/${paymentId}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  const currentIdx = data?.status ? FLOW.indexOf(data.status) : -1;
  const isMaker = data?.createdByUserId && me?.id === data.createdByUserId;

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
              {t("colStatus")}:{" "}
              {data.status ? <StatusBadge status={data.status} /> : "—"}
            </div>
            <div>
              {t("colAmount")}: {formatAznMinor(data.amountMinor)}
            </div>
            <div>
              {t("debitAccount")}: {data.debtorAccountId ?? "—"}
            </div>
            <div>
              {t("colBeneficiary")}: {data.creditorIban ?? "—"}
            </div>
            <div>
              {t("rail")}: {data.rail ?? "—"}
            </div>
            <div>
              {t("purpose")}: {data.narrative ?? "—"}
            </div>
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
          <div className="flex flex-wrap gap-2">
            {data.status === "DRAFT" ? (
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void postAction("submit")}
              >
                {t("submit")}
              </button>
            ) : null}
            {data.status === "PENDING_APPROVAL" && canApprove && !isMaker ? (
              <div className="flex w-full flex-col gap-2">
                <Field
                  name="rejectReason"
                  label={t("rejectReason")}
                  preset="longText"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={mutationsDisabled}
                    onClick={() => void postAction("approve")}
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={mutationsDisabled || !rejectReason.trim()}
                    onClick={() =>
                      void postAction("reject", {
                        reason: rejectReason.trim(),
                      })
                    }
                  >
                    {t("reject")}
                  </button>
                </div>
              </div>
            ) : null}
            {data.status === "PENDING_APPROVAL" && isMaker ? (
              <p className="text-sm text-muted-foreground">
                {t("makerCannotApprove")}
              </p>
            ) : null}
          </div>
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
