"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

type Installment = {
  sequenceNo: number;
  dueDate: string;
  principalMinor: string | number;
  interestMinor: string | number;
  status: string;
};

type Loan = {
  id: string;
  status?: string;
  outstandingMinor?: string | number;
  aprPercent?: number | null;
  installments?: Installment[];
};

function azn(minor: string | number | undefined) {
  const n = Number(minor ?? 0) / 100;
  return `${n.toFixed(2)} AZN`;
}

export default function CustomerLoansPage() {
  const t = useTranslations("loans");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Loan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prepayId, setPrepayId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"REDUCE_TERM" | "REDUCE_INSTALLMENT">(
    "REDUCE_TERM",
  );

  async function load() {
    const res = await fetch("/api/loans");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? data.message ?? tc("error"));
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function prepay(e: React.FormEvent) {
    e.preventDefault();
    if (!prepayId) return;
    const amountMinor = String(Math.round(Number(amount) * 100));
    const res = await fetch(`/api/loans/${prepayId}/prepay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountMinor,
        mode,
        idempotencyKey: `dbo-ui-${prepayId}-${amountMinor}-${mode}`,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? data.message ?? tc("error"));
      return;
    }
    setPrepayId(null);
    setAmount("");
    await load();
  }

  return (
    <div className="space-y-4 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <Link className="text-sm text-sky-700" href="/loans/apply">
          {t("apply")}
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t("empty")}</p>
      ) : (
        rows.map((loan) => (
          <article key={loan.id} className="rounded-xl bg-white p-3 shadow-sm">
            <div className="flex justify-between text-sm">
              <span>{loan.status}</span>
              <span>{azn(loan.outstandingMinor)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {t("apr")}:{" "}
              {loan.aprPercent != null
                ? `${Number(loan.aprPercent).toFixed(2)}%`
                : "—"}
            </p>
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-xs">
              {(loan.installments ?? []).map((i) => (
                <li key={`${loan.id}-${i.sequenceNo}`}>
                  #{i.sequenceNo} · {String(i.dueDate).slice(0, 10)} ·{" "}
                  {azn(Number(i.principalMinor) + Number(i.interestMinor))} ·{" "}
                  {i.status}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-2 rounded bg-slate-900 px-3 py-1 text-xs text-white"
              onClick={() => setPrepayId(loan.id)}
            >
              {t("prepay")}
            </button>
          </article>
        ))
      )}
      {prepayId ? (
        <form
          className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-lg space-y-2 rounded-t-xl border bg-white p-4 shadow-lg"
          onSubmit={prepay}
        >
          <h2 className="font-medium">{t("prepayTitle")}</h2>
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            type="number"
            step="0.01"
            placeholder={t("amount")}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <select
            className="w-full rounded border px-2 py-1 text-sm"
            value={mode}
            onChange={(e) =>
              setMode(e.target.value as "REDUCE_TERM" | "REDUCE_INSTALLMENT")
            }
          >
            <option value="REDUCE_TERM">{t("reduceTerm")}</option>
            <option value="REDUCE_INSTALLMENT">{t("reduceInstallment")}</option>
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded border px-3 py-2 text-sm"
              onClick={() => setPrepayId(null)}
            >
              {tc("cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 rounded bg-slate-900 px-3 py-2 text-sm text-white"
            >
              {t("confirmPrepay")}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
