"use client";

import { bakuTimeLabel } from "@era/satellite-kit/time";
import type { CashDrawerView } from "@/lib/cash-drawer";

export function CashDrawerBlock({
  drawer,
  azn,
  labels,
}: {
  drawer: CashDrawerView;
  azn: string;
  labels: {
    title: string;
    opening: string;
    cashSales: string;
    drops: string;
    expected: string;
    counted: string;
    variance: string;
  };
}) {
  const rows: { label: string; value: number }[] = [
    { label: labels.opening, value: drawer.opening },
    { label: labels.cashSales, value: drawer.cashSales },
    { label: labels.drops, value: drawer.dropsTotal },
    { label: labels.expected, value: drawer.expected },
  ];
  if (drawer.counted != null) rows.push({ label: labels.counted, value: drawer.counted });
  if (drawer.variance != null) rows.push({ label: labels.variance, value: drawer.variance });

  return (
    <div className="mb-3 rounded-md bg-[#F7F9FA] p-3 text-sm text-[#34495E]">
      <p className="mb-2 font-semibold">
        {labels.title}
        {drawer.openedBy ? ` · ${drawer.openedBy}` : ""}
        {` · ${bakuTimeLabel(drawer.openedAt)}`}
      </p>
      <table className="w-full max-w-md">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="py-0.5 pr-4">{row.label}</td>
              <td className="py-0.5 text-right tabular-nums">
                {row.value.toFixed(2)} {azn}
              </td>
            </tr>
          ))}
          {drawer.drops.map((drop) => (
            <tr key={drop.id} className="text-xs text-[#7F8C8D]">
              <td className="py-0.5 pr-4">
                {bakuTimeLabel(drop.createdAt)}
                {drop.note ? ` · ${drop.note}` : ""}
              </td>
              <td className="py-0.5 text-right tabular-nums">
                {drop.amountAzn.toFixed(2)} {azn}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
