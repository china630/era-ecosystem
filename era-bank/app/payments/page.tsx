"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CARD_CONTAINER_CLASS,
  PageHeader,
  PRIMARY_BUTTON_CLASS,
  SECONDARY_BUTTON_CLASS,
} from "@era/satellite-kit/ui";
import { OpsModalShell, useOpsModal } from "@/components/ops";
import { OpsError, OpsField, StatusBadge, formatAznMinor } from "@/components/ops-ui";

type Payment = {
  id: string;
  status?: string;
  creditorIban?: string;
  amountMinor?: unknown;
  currency?: string;
  rail?: string;
  narrative?: string;
};

function PaymentsPageInner() {
  const t = useTranslations("pages.payments");
  const tCommon = useTranslations("common");
  const { mode, open, close, isOpen } = useOpsModal();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/payments/orders", { cache: "no-store" });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      let list = (await res.json()) as Payment[];
      if (status) list = list.filter((r) => r.status === status);
      setRows(list);
    } catch {
      setError(tCommon("error"));
    }
  }, [status, tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function registerInbound(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/payments/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: form.get("idempotencyKey") ?? `inbound-ui-${Date.now()}`,
          creditorIban: form.get("creditorIban"),
          amountMinor: String(form.get("amountMinor") ?? 100000),
          currency: form.get("currency") ?? "AZN",
        }),
      });
      if (!res.ok) {
        setError(`${tCommon("error")} (${res.status})`);
        return;
      }
      close();
      await load();
    } catch {
      setError(tCommon("error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className={`${CARD_CONTAINER_CLASS} flex flex-wrap gap-3`}>
        <select
          className="rounded border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SETTLED">SETTLED</option>
          <option value="REJECTED">REJECTED</option>
        </select>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => void load()}>
          {tCommon("refresh")}
        </button>
        <button type="button" className={SECONDARY_BUTTON_CLASS} onClick={() => open("create")}>
          Register inbound
        </button>
        <Link href="/payments/new" className={PRIMARY_BUTTON_CLASS}>
          {t("newPayment")}
        </Link>
      </div>
      <OpsError message={error} />
      <div className={CARD_CONTAINER_CLASS}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tCommon("empty")}</p>
        ) : (
          <table className="min-w-full text-left text-[12px]">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Beneficiary</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Rail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-3 py-2">
                    <Link href={`/payments/${row.id}`} className="text-primary underline">
                      {row.id.slice(0, 10)}…
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {row.status ? <StatusBadge status={row.status} /> : "—"}
                  </td>
                  <td className="px-3 py-2">{row.creditorIban ?? "—"}</td>
                  <td className="px-3 py-2">{formatAznMinor(row.amountMinor)}</td>
                  <td className="px-3 py-2">{row.rail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <OpsModalShell
        open={isOpen && mode === "create"}
        title="Register inbound payment"
        subtitle="Credit customer account from external rail"
        onClose={close}
        formId="inbound-payment-form"
        submitLabel="Register inbound"
        busy={busy}
      >
        <form id="inbound-payment-form" onSubmit={(e) => void registerInbound(e)} className="grid gap-3">
          <OpsField
            name="idempotencyKey"
            label="Idempotency key"
            defaultValue={`inbound-ui-${Date.now()}`}
          />
          <OpsField name="creditorIban" label="Creditor IBAN" defaultValue="AZ00DEMO00000000000001" />
          <OpsField name="amountMinor" label="Amount (minor)" type="number" defaultValue={100000} />
          <OpsField name="currency" label="Currency" defaultValue="AZN" />
        </form>
      </OpsModalShell>
    </div>
  );
}

export default function PaymentsPage() {
  const tCommon = useTranslations("common");
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("loading")}</p>}>
      <PaymentsPageInner />
    </Suspense>
  );
}
