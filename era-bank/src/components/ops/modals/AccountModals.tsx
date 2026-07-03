"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Field, FieldSelect, PRIMARY_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from "@era/satellite-kit/ui";
import { OpsModalShell } from "@/components/ops/OpsModalShell";
import { useEodLock } from "@/components/ops/EodLockProvider";
import {
  AmountInput,
  OpsError,
  StatusBadge,
  formatAznMinor,
  maskIban,
} from "@/components/ops-ui";

type AccountDetail = {
  id: string;
  iban?: string;
  customerId?: string;
  branchId?: string;
  currency?: string;
  status?: string;
  ledgerBalanceMinor?: unknown;
  availableBalanceMinor?: unknown;
  holds?: Array<{ id: string; amountMinor: unknown; reason?: string; status?: string }>;
};

type Movement = {
  id: string;
  debitMinor?: unknown;
  creditMinor?: unknown;
  currency?: string;
  createdAt?: string;
  transaction?: { reference?: string; type?: string };
};

type DetailTab = "overview" | "statement" | "holds";

type AccountOpenModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
};

export function AccountOpenModal({ open, onClose, onCreated }: AccountOpenModalProps) {
  const t = useTranslations("pages.accounts");
  const [glId, setGlId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formId = "account-open-form";

  useEffect(() => {
    if (!open) return;
    fetch("/api/gl/accounts")
      .then((r) => r.json())
      .then((rows: Array<{ id: string; code: string }>) => {
        const current = rows.find((g) => g.code === "2200101");
        if (current) setGlId(current.id);
        else if (rows[0]) setGlId(rows[0].id);
      })
      .catch(() => undefined);
  }, [open]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          customerId: form.get("customerId"),
          branchId: form.get("branchId"),
          glAccountId: form.get("glAccountId") || glId,
          currency: form.get("currency") ?? "AZN",
          idempotencyKey: `acc-${Date.now()}`,
        }),
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const acc = (await res.json()) as { id: string };
      onCreated(acc.id);
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
      submitLabel={t("openAccount")}
      busy={busy}
    >
      <form id={formId} onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field name="customerId" label={t("customerId")} preset="code" defaultValue="demo-retail-customer" />
        <Field name="branchId" label={t("branchId")} preset="code" defaultValue="demo-branch-hq" />
        <Field name="glAccountId" label="GL account id" preset="code" defaultValue={glId} />
        <Field name="currency" label={t("currency")} preset="code" defaultValue="AZN" />
        <div className="sm:col-span-2">
          <OpsError message={error} />
        </div>
      </form>
    </OpsModalShell>
  );
}

type AccountDetailModalProps = {
  open: boolean;
  accountId: string | null;
  onClose: () => void;
  onClosed?: () => void;
};

export function AccountDetailModal({
  open,
  accountId,
  onClose,
  onClosed,
}: AccountDetailModalProps) {
  const t = useTranslations("pages.accounts");
  const tCommon = useTranslations("common");
  const { mutationsDisabled } = useEodLock();
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [holdResult, setHoldResult] = useState("");

  const load = useCallback(async () => {
    if (!accountId) return;
    setError(null);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      setAccount((await res.json()) as AccountDetail);
    } catch {
      setError(tCommon("error"));
    }
  }, [accountId, tCommon]);

  useEffect(() => {
    if (open && accountId) {
      setTab("overview");
      void load();
    }
    if (!open) {
      setAccount(null);
      setMovements([]);
      setHoldResult("");
    }
  }, [open, accountId, load]);

  async function loadStatement() {
    if (!accountId) return;
    setError(null);
    const res = await fetch(
      `/api/accounts/${accountId}/statement?from=${from}&to=${to}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      setError(`${tCommon("error")} (${res.status})`);
      return;
    }
    setMovements((await res.json()) as Movement[]);
  }

  function exportCsv() {
    const header = "date,reference,type,debit,credit,currency\n";
    const lines = movements.map((r) =>
      [
        r.createdAt ?? "",
        r.transaction?.reference ?? "",
        r.transaction?.type ?? "",
        String(r.debitMinor ?? 0),
        String(r.creditMinor ?? 0),
        r.currency ?? "AZN",
      ].join(","),
    );
    const blob = new Blob([header + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `statement-${accountId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function closeAccount() {
    if (!accountId) return;
    setError(null);
    const res = await fetch(`/api/accounts/${accountId}/close`, { method: "POST" });
    if (!res.ok) {
      setError(await res.text());
      return;
    }
    await load();
    onClosed?.();
  }

  async function placeHold(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accountId) return;
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/accounts/${accountId}/holds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor: String(form.get("amountMinor")),
        reason: form.get("reason") ?? "MANUAL",
      }),
    });
    const text = await res.text();
    if (!res.ok) setError(text);
    else {
      setHoldResult(text);
      await load();
    }
  }

  async function releaseHold(holdId: string) {
    if (!accountId) return;
    const res = await fetch(`/api/accounts/${accountId}/holds/${holdId}`, {
      method: "DELETE",
    });
    if (!res.ok) setError(await res.text());
    await load();
  }

  const canClose =
    account?.status === "ACTIVE" &&
    Number(account.availableBalanceMinor ?? 0) === 0 &&
    !(account.holds ?? []).some((h) => h.status === "ACTIVE");

  return (
    <OpsModalShell
      open={open}
      title={account?.iban ? maskIban(account.iban) : t("detailTitle")}
      subtitle={accountId ?? undefined}
      onClose={onClose}
      hideFooter
      maxWidthClass="max-w-3xl"
    >
      <div className="mb-4 flex flex-wrap gap-2 border-b pb-2 text-sm">
        {(["overview", "statement", "holds"] as DetailTab[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded px-3 py-1 ${tab === key ? "bg-primary text-primary-foreground" : "bg-muted"}`}
            onClick={() => {
              setTab(key);
              if (key === "statement") void loadStatement();
            }}
          >
            {key === "overview" ? t("detailTitle") : t(key)}
          </button>
        ))}
      </div>
      <OpsError message={error} />
      {tab === "overview" && account ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              {t("balance")}: <strong>{formatAznMinor(account.ledgerBalanceMinor)}</strong>
            </div>
            <div>
              {t("available")}: <strong>{formatAznMinor(account.availableBalanceMinor)}</strong>
            </div>
            <div>
              {t("status")}: {account.status ? <StatusBadge status={account.status} /> : "—"}
            </div>
            <div>
              {t("currency")}: {account.currency ?? "AZN"}
            </div>
          </div>
          {account.holds?.length ? (
            <div>
              <h3 className="mb-2 font-medium">{t("activeHolds")}</h3>
              <ul className="text-sm">
                {account.holds.map((h) => (
                  <li key={h.id}>
                    {formatAznMinor(h.amountMinor)} — {h.reason} ({h.status})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {canClose ? (
            <button
              type="button"
              className={SECONDARY_BUTTON_CLASS}
              disabled={mutationsDisabled}
              onClick={() => void closeAccount()}
            >
              {t("closeAccount")}
            </button>
          ) : null}
        </div>
      ) : null}
      {tab === "statement" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => void loadStatement()}>
              {tCommon("refresh")}
            </button>
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={exportCsv}>
              {t("exportCsv")}
            </button>
          </div>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
          ) : (
            <table className="min-w-full text-left text-[12px]">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Debit</th>
                  <th className="px-3 py-2">Credit</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2">{r.createdAt?.slice(0, 10) ?? "—"}</td>
                    <td className="px-3 py-2">{r.transaction?.reference ?? "—"}</td>
                    <td className="px-3 py-2">{r.transaction?.type ?? "—"}</td>
                    <td className="px-3 py-2">{formatAznMinor(r.debitMinor)}</td>
                    <td className="px-3 py-2">{formatAznMinor(r.creditMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
      {tab === "holds" && account ? (
        <div className="space-y-4">
          <form onSubmit={placeHold} className="grid gap-4 sm:grid-cols-2">
            <AmountInput name="amountMinor" label={t("holdAmount")} defaultMinor={50000} />
            <label>
              <span className="mb-1 block text-[12px] text-muted-foreground">{t("holdReason")}</span>
              <select name="reason" className="w-full rounded border px-3 py-2 text-sm" defaultValue="MANUAL">
                <option value="MANUAL">Manual compliance hold</option>
                <option value="PAYMENT_PENDING">Payment pending</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className={PRIMARY_BUTTON_CLASS}
                disabled={mutationsDisabled}
              >
                {t("placeHold")}
              </button>
            </div>
          </form>
          {holdResult ? <pre className="max-h-32 overflow-auto text-xs">{holdResult}</pre> : null}
          {account.holds?.length ? (
            <ul className="space-y-2 text-sm">
              {account.holds.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <span>
                    {formatAznMinor(h.amountMinor)} — {h.reason} ({h.status})
                  </span>
                  {h.status === "ACTIVE" ? (
                    <button
                      type="button"
                      className="text-primary underline"
                      disabled={mutationsDisabled}
                      onClick={() => void releaseHold(h.id)}
                    >
                      {t("releaseLastHold")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
          )}
        </div>
      ) : null}
    </OpsModalShell>
  );
}
