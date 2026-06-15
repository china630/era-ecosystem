"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { useEodLock } from "@/components/ops/EodLockProvider";
import { AmountInput, OpsError, OpsField, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type DepositDetail = {
  id: string;
  status?: string;
  principalMinor?: unknown;
  currency?: string;
  customerId?: string;
  accountId?: string;
  maturityDate?: string;
  openedAt?: string;
  adifTagged?: boolean;
};

type DepositCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function DepositCreateModal({ open, onClose, onCreated }: DepositCreateModalProps) {
  const t = useTranslations("pages.deposits");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = "deposit-create-form";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: form.get("accountId"),
          customerId: form.get("customerId"),
          productTemplateId: form.get("productTemplateId"),
          principalMinor: String(form.get("principalMinor")),
          currency: "AZN",
          maturityDate: form.get("maturityDate") || undefined,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const dep = (await res.json()) as { id: string };
      onCreated(dep.id);
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("openTitle")}
      subtitle={t("openSubtitle")}
      onClose={onClose}
      formId={formId}
      submitLabel={t("openDeposit")}
      busy={busy}
      maxWidthClass="max-w-2xl"
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <OpsField name="customerId" label={t("customerId")} defaultValue="demo-retail-customer" />
        <OpsField name="accountId" label={t("debitAccount")} defaultValue="demo-retail-acc-1" />
        <OpsField name="productTemplateId" label={t("productTemplate")} defaultValue="term-azn-12" />
        <AmountInput name="principalMinor" label={t("principal")} defaultMinor={1000000} />
        <OpsField name="maturityDate" label={t("maturityDate")} type="date" />
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}

type DepositDetailModalProps = {
  open: boolean;
  depositId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function DepositDetailModal({
  open,
  depositId,
  onClose,
  onUpdated,
}: DepositDetailModalProps) {
  const t = useTranslations("pages.deposits");
  const tCommon = useTranslations("common");
  const { mutationsDisabled } = useEodLock();
  const [data, setData] = useState<DepositDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!depositId) return;
    setError(null);
    try {
      const res = await fetch(`/api/deposits/${depositId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setData((await res.json()) as DepositDetail);
    } catch {
      setError(tCommon("error"));
    }
  }, [depositId, tCommon]);

  useEffect(() => {
    if (open && depositId) void load();
    if (!open) setData(null);
  }, [open, depositId, load]);

  async function closeDeposit() {
    if (!depositId) return;
    const res = await fetch(`/api/deposits/${depositId}/close`, { method: "POST" });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  async function rollover() {
    if (!depositId) return;
    const next = new Date();
    next.setMonth(next.getMonth() + 12);
    const res = await fetch(`/api/deposits/${depositId}/rollover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newMaturityDate: next.toISOString() }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  return (
    <OpsModalShell
      open={open}
      title={t("detailTitle")}
      subtitle={depositId ?? undefined}
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
              {data.adifTagged ? (
                <span className="ml-2 inline-flex rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                  ADİF
                </span>
              ) : null}
            </div>
            <div>Principal: {formatAznMinor(data.principalMinor)}</div>
            <div>Opened: {data.openedAt?.slice(0, 10) ?? "—"}</div>
            <div>Maturity: {data.maturityDate?.slice(0, 10) ?? "—"}</div>
          </div>
          {data.status === "ACTIVE" ? (
            <div className="flex gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void closeDeposit()}
              >
                {t("close")}
              </button>
              <button
                type="button"
                className={PRIMARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void rollover()}
              >
                {t("rollover")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </OpsModalShell>
  );
}
