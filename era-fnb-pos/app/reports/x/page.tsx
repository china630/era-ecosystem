"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Report = {
  outlet: { code: string; name: string };
  businessDay: string;
  salesTotal: number;
  checkCount: number;
  groups: { name: string; count: number; total: number }[] | null;
  waiters: { name: string; count: number; total: number }[] | null;
  cashiers: { name: string; count: number; total: number }[] | null;
  discount: { amount: number; service: number } | null;
  dishes: { name: string; qty: number; total: number }[] | null;
  payments: { key: string; total: number; lines: { label: string; total: number }[] }[] | null;
  openCash: { total: number; checks: { id: string; total: number; waiter: string | null }[] } | null;
};

type Handover = {
  roomHandover: { ticketId: string; room: string | null; guest: string | null; amount: number }[];
  roomTotal: number;
  cashAct: { cash: number; ikram: number; limit: number; card: number };
};

export default function XReportPage() {
  const t = useTranslations("hallPages");
  const nav = useTranslations("nav");
  const [report, setReport] = useState<Report | null>(null);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [error, setError] = useState("");
  const [sheet, setSheet] = useState<"x" | "rooms" | "cash">("x");

  useEffect(() => {
    void (async () => {
      const [x, h] = await Promise.all([fetch("/api/reports/x"), fetch("/api/reports/handover")]);
      if (!x.ok) {
        setError(t("unavailable"));
        return;
      }
      setReport(await x.json());
      if (h.ok) setHandover(await h.json());
    })();
  }, []);

  if (error) return <p className="p-6 text-sm">{error}</p>;
  if (!report) return <p className="p-6 text-sm">{t("loading")}</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 print:p-0">
      <div className="flex gap-2 print:hidden">
        <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => setSheet("x")}>{t("sheetX")}</button>
        <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => setSheet("rooms")}>{t("sheetRooms")}</button>
        <button type="button" className="rounded border px-2 py-1 text-sm" onClick={() => setSheet("cash")}>{t("sheetCash")}</button>
      </div>
      {sheet === "x" ? (
      <>
      <header>
        <h1 className="text-xl font-semibold">{nav("xReport")}</h1>
        <p className="text-sm text-neutral-600">
          {report.outlet.name} · {report.outlet.code} · {report.businessDay}
        </p>
        <p className="text-sm">
          {t("closedSales")} {report.salesTotal.toFixed(2)} AZN · {report.checkCount} {t("checks")}
        </p>
      </header>
      {report.groups ? <Block title={t("groups")} rows={report.groups.map((g) => `${g.name} · ${g.count} · ${g.total.toFixed(2)}`)} /> : null}
      {report.waiters ? <Block title={t("waiters")} rows={report.waiters.map((g) => `${g.name} · ${g.count} · ${g.total.toFixed(2)}`)} /> : null}
      {report.cashiers ? <Block title={t("cashiers")} rows={report.cashiers.map((g) => `${g.name} · ${g.count} · ${g.total.toFixed(2)}`)} /> : null}
      {report.discount ? <Block title={t("discount")} rows={[`${report.discount.amount.toFixed(2)}`, `${report.discount.service.toFixed(2)}`]} /> : null}
      {report.dishes ? <Block title={t("dishes")} rows={report.dishes.map((g) => `${g.name} · ${g.qty} · ${g.total.toFixed(2)}`)} /> : null}
      {report.payments
        ? report.payments.map((p) => (
            <Block key={p.key} title={`${p.key} · ${p.total.toFixed(2)}`} rows={p.lines.map((l) => `${l.label} · ${l.total.toFixed(2)}`)} />
          ))
        : null}
      {report.openCash ? (
        <Block
          title={`${t("openTill")} · ${report.openCash.total.toFixed(2)}`}
          rows={report.openCash.checks.map((c) => `${c.id.slice(0, 8)} · ${c.waiter ?? "—"} · ${c.total.toFixed(2)}`)}
        />
      ) : null}
      </>
      ) : null}
      {sheet === "rooms" && handover ? (
        <section>
          <h1 className="text-xl font-semibold">{t("sheetRooms")}</h1>
          <p className="text-sm">{report.outlet.name} · {report.businessDay} · {handover.roomTotal.toFixed(2)}</p>
          <ul className="mt-3 text-sm">
            {handover.roomHandover.map((r) => (
              <li key={r.ticketId}>{r.room ?? "—"} · {r.ticketId.slice(0, 8)} · {r.guest ?? ""} · {r.amount.toFixed(2)}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm">{t("gave")} ________</p>
          <p className="text-sm">{t("took")} ________</p>
        </section>
      ) : null}
      {sheet === "cash" && handover ? (
        <section>
          <h1 className="text-xl font-semibold">{t("sheetCash")}</h1>
          <p className="text-sm">{report.outlet.name} · {report.businessDay}</p>
          <ul className="mt-3 text-sm">
            <li>{t("cash")} {handover.cashAct.cash.toFixed(2)}</li>
            <li>{t("card")} {handover.cashAct.card.toFixed(2)}</li>
            <li>{t("ikram")} {handover.cashAct.ikram.toFixed(2)}</li>
            <li>{t("limit")} {handover.cashAct.limit.toFixed(2)}</li>
          </ul>
          <p className="mt-6 text-sm">{t("witnessOpen")} ________</p>
          <p className="text-sm">{t("witnessCount")} ________</p>
          <p className="text-sm">{t("treasurer")} ________</p>
          <p className="text-sm">{t("accountant")} ________</p>
        </section>
      ) : null}
      <button type="button" className="rounded border px-3 py-1 text-sm print:hidden" onClick={() => window.print()}>
        {t("print")}
      </button>
    </div>
  );
}

function Block({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-1 text-sm">
        {rows.length === 0 ? <li>—</li> : rows.map((row) => <li key={row}>{row}</li>)}
      </ul>
    </section>
  );
}
