"use client";

import { useTranslations } from "next-intl";
import { bakuTimeLabel } from "@era/satellite-kit/time";

export type SlipCopy = {
  kind: string;
  ticketId: string;
  dayNo?: number | null;
  outletName?: string | null;
  table?: string | null;
  waiter?: string | null;
  at?: string | null;
  guestName?: string | null;
  room?: string | null;
  total?: number;
  discountAzn?: number | null;
  limitBalanceAfter?: number | null;
  holderName?: string | null;
  lines?: Array<{ name: string; qty: number; amount: number }>;
};

export function ticketCode(id: string): string {
  return id.replace(/-/g, "").slice(-8);
}

export function SlipTape({ slip }: { slip: SlipCopy }) {
  const slips = useTranslations("hallPages");
  const precheck = slip.kind === "PRECHECK";
  return (
    <div className="slip-print mb-3 flex flex-wrap justify-center gap-4">
      <style>{`@media print { body * { visibility: hidden } .slip-print, .slip-print * { visibility: visible } .slip-print { position: absolute; left: 0; top: 0; } }`}</style>
      {["guest", "cashier"].map((copy) => (
        <section key={copy} className="w-64 border border-dashed p-3 font-mono text-xs leading-5">
          <p className="text-center font-semibold">{slip.outletName}</p>
          <p className="text-center">{copy === "guest" ? slips("guestCopy") : slips("cashierCopy")}</p>
          <p>{slips("checkNo")} {slip.dayNo ?? "—"} · {ticketCode(slip.ticketId)}</p>
          <p>{slip.table}</p>
          <p>{slips("waiter")} {slip.waiter ?? "—"}</p>
          <p>{slip.at ? bakuTimeLabel(slip.at) : ""}</p>
          <ul>
            {(slip.lines ?? []).map((line, index) => (
              <li key={`${copy}-${index}`} className="flex justify-between gap-2">
                <span>{line.qty} {line.name}</span>
                <span>{line.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
          {slip.discountAzn && slip.discountAzn > 0 ? (
            <p className="mt-2 flex justify-between">
              <span>{slips("discountLine")}</span>
              <span>−{slip.discountAzn.toFixed(2)}</span>
            </p>
          ) : null}
          <p className="mt-2 flex justify-between font-semibold">
            <span>AZN</span>
            <span>{slip.kind === "IKRAM" ? "0.00" : (slip.total ?? 0).toFixed(2)}</span>
          </p>
          {precheck ? <p className="mt-2">{slips("precheck")}</p> : <p className="mt-2">{slips("paidMark")}</p>}
          {!precheck && slip.kind === "ROOM" ? (
            <p className="mt-2">{slips("room")} {slip.room ?? "________"}<br />{slip.guestName ?? "________"}<br />{slips("signature")} ________</p>
          ) : null}
          {!precheck && slip.kind === "LIMIT" ? (
            <p className="mt-2">{slip.holderName ?? slips("limit")}<br />{slips("limit")} {slip.limitBalanceAfter ?? "—"}<br />{slips("signature")} ________</p>
          ) : null}
          {!precheck && slip.kind === "IKRAM" ? <p className="mt-2">{slips("ikram")}</p> : null}
        </section>
      ))}
      <button type="button" className="h-8 rounded border px-2 print:hidden" onClick={() => window.print()}>{slips("print")}</button>
    </div>
  );
}
