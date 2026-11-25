"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Lease = {
  id: string;
  status?: string;
  termMonths?: number;
  residualValueMinor?: string | number;
  netInvestmentMinor?: string | number;
  asset?: { description?: string };
};

type ScheduleLine = {
  sequenceNo: number;
  dueDate: string;
  principalMinor: string;
  interestMinor: string;
  vatMinor: string;
  paymentMinor: string;
  remainingNetInvestmentMinor: string;
};

type Schedule = {
  leaseId: string;
  methodology?: string;
  ifrs16Lab?: boolean;
  notCertified?: boolean;
  netInvestmentMinor?: string;
  lines?: ScheduleLine[];
};

function azn(minor: string | number | undefined) {
  return `${(Number(minor ?? 0) / 100).toFixed(2)} AZN`;
}

export default function CustomerLeasingPage() {
  const t = useTranslations("leasing");
  const tc = useTranslations("common");
  const [rows, setRows] = useState<Lease[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/leasing/contracts");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.message ?? tc("error"));
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    })();
  }, [tc]);

  async function loadSchedule(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/leasing/contracts/${id}/schedule`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? data.message ?? tc("error"));
        setSchedule(null);
        return;
      }
      setSchedule(data as Schedule);
    } catch {
      setError(tc("error"));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-lg font-semibold">{t("title")}</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <p className="text-xs text-slate-500">{t("scheduleHonesty")}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t("empty")}</p>
      ) : (
        rows.map((row) => (
          <article key={row.id} className="rounded-xl bg-white p-3 shadow-sm text-sm">
            <div className="font-medium">{row.asset?.description ?? row.id}</div>
            <div className="mt-1 text-slate-600">
              {row.status} · {row.termMonths ?? "—"} {t("months")} ·{" "}
              {t("residual")}: {azn(row.residualValueMinor)}
            </div>
            <button
              type="button"
              className="mt-2 text-xs font-medium text-slate-800 underline"
              onClick={() => void loadSchedule(row.id)}
              disabled={loadingId === row.id}
            >
              {loadingId === row.id ? t("loadingSchedule") : t("viewSchedule")}
            </button>
          </article>
        ))
      )}
      {schedule ? (
        <section className="rounded-xl bg-white p-3 shadow-sm text-sm space-y-2">
          <h2 className="font-medium">{t("scheduleTitle")}</h2>
          <p className="text-xs text-slate-500">
            {t("labNote")} · net {azn(schedule.netInvestmentMinor)}
          </p>
          <ul className="space-y-1 max-h-64 overflow-auto">
            {(schedule.lines ?? []).map((line) => (
              <li key={line.sequenceNo} className="flex justify-between gap-2 border-b border-slate-100 py-1 text-xs">
                <span>
                  #{line.sequenceNo} · {line.dueDate.slice(0, 10)}
                </span>
                <span>{azn(line.paymentMinor)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
