"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { useEodLock } from "@/components/ops/EodLockProvider";
import { AmountInput, OpsError, OpsField, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type LoanDetail = {
  id: string;
  status?: string;
  principalMinor?: unknown;
  outstandingMinor?: unknown;
  currency?: string;
  accountId?: string | null;
};

type Installment = {
  sequenceNo: number;
  dueDate?: string;
  principalMinor?: unknown;
  interestMinor?: unknown;
  status?: string;
};

type DetailTab = "overview" | "schedule" | "restructure";

type LoanCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function LoanCreateModal({ open, onClose, onCreated }: LoanCreateModalProps) {
  const t = useTranslations("pages.loans");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = "loan-create-form";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: form.get("customerId"),
          productTemplateId: form.get("productTemplateId"),
          principalMinor: String(form.get("principalMinor")),
          currency: "AZN",
          termMonths: Number(form.get("termMonths")),
          rateAnnual: Number(form.get("rateAnnual")),
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const loan = (await res.json()) as { id: string };
      onCreated(loan.id);
    } catch {
      setError("Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsModalShell
      open={open}
      title={t("originateTitle")}
      subtitle={t("originateSubtitle")}
      onClose={onClose}
      formId={formId}
      submitLabel={t("originate")}
      busy={busy}
      maxWidthClass="max-w-2xl"
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <OpsField name="customerId" label={t("customerId")} defaultValue="demo-retail-customer" />
        <OpsField name="productTemplateId" label={t("productTemplate")} defaultValue="consumer-loan-azn" />
        <AmountInput name="principalMinor" label={t("principal")} defaultMinor={5000000} />
        <OpsField name="termMonths" label={t("termMonths")} type="number" defaultValue={24} />
        <OpsField name="rateAnnual" label={t("rateAnnual")} type="number" defaultValue={0.14} />
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}

type LoanDetailModalProps = {
  open: boolean;
  loanId: string | null;
  onClose: () => void;
  onUpdated?: () => void;
};

export function LoanDetailModal({ open, loanId, onClose, onUpdated }: LoanDetailModalProps) {
  const t = useTranslations("pages.loans");
  const tCommon = useTranslations("common");
  const { mutationsDisabled } = useEodLock();
  const [data, setData] = useState<LoanDetail | null>(null);
  const [schedule, setSchedule] = useState<Installment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [repayMinor, setRepayMinor] = useState("100000");
  const [ifrs9Stage, setIfrs9Stage] = useState("2");
  const [tab, setTab] = useState<DetailTab>("overview");

  const load = useCallback(async () => {
    if (!loanId) return;
    setError(null);
    try {
      const [lRes, sRes] = await Promise.all([
        fetch(`/api/loans/${loanId}`, { cache: "no-store" }),
        fetch(`/api/loans/${loanId}/schedule`, { cache: "no-store" }),
      ]);
      if (!lRes.ok) {
        setError(`${tCommon("error")} (${lRes.status})`);
        return;
      }
      setData((await lRes.json()) as LoanDetail);
      if (sRes.ok) setSchedule((await sRes.json()) as Installment[]);
    } catch {
      setError(tCommon("error"));
    }
  }, [loanId, tCommon]);

  useEffect(() => {
    if (open && loanId) {
      setTab("overview");
      void load();
    }
    if (!open) {
      setData(null);
      setSchedule([]);
    }
  }, [open, loanId, load]);

  async function disburse() {
    if (!loanId) return;
    const res = await fetch(`/api/loans/${loanId}/disburse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: "demo-retail-acc-1" }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  async function repay() {
    if (!loanId) return;
    const res = await fetch(`/api/loans/${loanId}/repay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMinor: repayMinor }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  async function restructure() {
    if (!loanId) return;
    const res = await fetch(`/api/loans/${loanId}/restructure`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ifrs9Stage: Number(ifrs9Stage) }),
    });
    if (!res.ok) setError(await res.text());
    await load();
    onUpdated?.();
  }

  return (
    <OpsModalShell
      open={open}
      title={t("detailTitle")}
      subtitle={loanId ?? undefined}
      onClose={onClose}
      hideFooter
      maxWidthClass="max-w-3xl"
    >
      <div className="mb-4 flex flex-wrap gap-2 border-b pb-2 text-sm">
        {(["overview", "schedule", "restructure"] as DetailTab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded px-3 py-1 ${tab === key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            onClick={() => setTab(key)}
          >
            {key === "overview" ? t("detailTitle") : key === "schedule" ? t("schedule") : "Restructure"}
          </button>
        ))}
      </div>
      <OpsError message={error} />
      {tab === "overview" && data ? (
        <div className="space-y-4">
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              Status: {data.status ? <StatusBadge status={data.status} /> : "—"}
            </div>
            <div>Principal: {formatAznMinor(data.principalMinor)}</div>
            <div>Outstanding: {formatAznMinor(data.outstandingMinor)}</div>
            <div>Disbursement account: {data.accountId ?? "—"}</div>
          </div>
          {data.status === "APPROVED" ? (
            <button
              type="button"
              className={PRIMARY_BUTTON_CLASS}
              disabled={mutationsDisabled}
              onClick={() => void disburse()}
            >
              {t("disburse")}
            </button>
          ) : null}
          {data.status === "DISBURSED" || data.status === "ACTIVE" ? (
            <div className="flex flex-wrap items-end gap-3">
              <label>
                <span className="mb-1 block text-[12px] text-muted-foreground">{t("repayAmount")}</span>
                <input
                  className="rounded border px-3 py-2 text-sm"
                  value={repayMinor}
                  onChange={(e) => setRepayMinor(e.target.value)}
                />
              </label>
              <button
                type="button"
                className={SECONDARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
                onClick={() => void repay()}
              >
                {t("repay")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === "schedule" ? (
        schedule.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
        ) : (
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Principal</th>
                <th className="px-3 py-2">Interest</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((row) => (
                <tr key={row.sequenceNo} className="border-b">
                  <td className="px-3 py-2">{row.sequenceNo}</td>
                  <td className="px-3 py-2">{row.dueDate?.slice(0, 10) ?? "—"}</td>
                  <td className="px-3 py-2">{formatAznMinor(row.principalMinor)}</td>
                  <td className="px-3 py-2">{formatAznMinor(row.interestMinor)}</td>
                  <td className="px-3 py-2">{row.status ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}
      {tab === "restructure" ? (
        <div className="flex flex-wrap items-end gap-3">
          <label>
            <span className="mb-1 block text-[12px] text-muted-foreground">IFRS 9 stage</span>
            <select
              className="rounded border px-3 py-2 text-sm"
              value={ifrs9Stage}
              onChange={(e) => setIfrs9Stage(e.target.value)}
            >
              <option value="1">Stage 1</option>
              <option value="2">Stage 2</option>
              <option value="3">Stage 3</option>
            </select>
          </label>
          <button
            type="button"
            className={PRIMARY_BUTTON_CLASS}
            disabled={mutationsDisabled}
            onClick={() => void restructure()}
          >
            Apply restructure
          </button>
        </div>
      ) : null}
    </OpsModalShell>
  );
}
