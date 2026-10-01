"use client";

import { bakuTimeLabel } from "@era/satellite-kit/time";

export type SaleRowView = {
  id: string;
  dayNo: number | null;
  closedAt: string;
  place: string;
  method: string | null;
  totalAzn: number;
};

export type SaleTotalsView = {
  cash: number;
  card: number;
  transfer: number;
  count: number;
  sum: number;
};

const METHOD_KEY: Record<string, "cash" | "card" | "transfer"> = {
  CASH: "cash",
  CARD: "card",
  TRANSFER: "transfer",
};

export function SaleTable({
  rows,
  totals,
  labels,
  azn,
}: {
  rows: SaleRowView[];
  totals: SaleTotalsView;
  labels: {
    time: string;
    place: string;
    method: string;
    sum: string;
    empty: string;
    cash: string;
    card: string;
    transfer: string;
    count: string;
    takeaway: string;
  };
  azn: string;
}) {
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-medium text-[#7F8C8D]">
            <th className="pb-2 font-medium">{labels.time}</th>
            <th className="pb-2 font-medium">{labels.place}</th>
            <th className="pb-2 font-medium">{labels.method}</th>
            <th className="pb-2 text-right font-medium">{labels.sum}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-3 text-[#7F8C8D]">
                {labels.empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-t border-[#F0F3F4]">
                <td className="py-2 tabular-nums">
                  {row.closedAt ? bakuTimeLabel(row.closedAt) : ""}
                  {row.dayNo ? ` #${row.dayNo}` : ""}
                </td>
                <td className="py-2">{row.place === "TAKEAWAY" ? labels.takeaway : row.place}</td>
                <td className="py-2">
                  {row.method && METHOD_KEY[row.method] ? labels[METHOD_KEY[row.method]] : "—"}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums">
                  {row.totalAzn.toFixed(2)} {azn}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <p className="mt-3 text-right text-sm text-[#34495E]">
        {labels.count}: {totals.count}
        {" · "}
        {labels.cash} {totals.cash.toFixed(2)}
        {" · "}
        {labels.card} {totals.card.toFixed(2)}
        {" · "}
        {labels.transfer} {totals.transfer.toFixed(2)}
      </p>
      <p className="text-right text-xl font-semibold tabular-nums text-[#2C3E50]">
        {totals.sum.toFixed(2)} {azn}
      </p>
    </div>
  );
}
