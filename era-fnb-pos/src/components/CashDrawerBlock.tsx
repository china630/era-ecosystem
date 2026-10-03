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
  const cells: { label: string; value: string }[] = [
    { label: labels.opening, value: drawer.opening.toFixed(2) },
    { label: labels.cashSales, value: drawer.cashSales.toFixed(2) },
    { label: labels.drops, value: drawer.dropsTotal.toFixed(2) },
    { label: labels.expected, value: drawer.expected.toFixed(2) },
  ];
  if (drawer.counted != null) {
    cells.push({ label: labels.counted, value: drawer.counted.toFixed(2) });
  }
  if (drawer.variance != null) {
    cells.push({ label: labels.variance, value: drawer.variance.toFixed(2) });
  }

  return (
    <div className="rounded-md bg-[#F7F9FA] px-3 py-2 text-sm text-[#34495E]">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <p
          className="flex w-96 shrink-0 items-baseline gap-1 pb-0.5 font-semibold"
          title={`${labels.title}${drawer.openedBy ? ` · ${drawer.openedBy}` : ""} · ${bakuTimeLabel(drawer.openedAt)}`}
        >
          <span className="min-w-0 truncate">
            {labels.title}
            {drawer.openedBy ? ` · ${drawer.openedBy}` : ""}
          </span>
          <span className="shrink-0">· {bakuTimeLabel(drawer.openedAt)}</span>
        </p>
        {cells.map((cell) => (
          <div key={cell.label} className="min-w-[4.5rem]">
            <p className="text-[11px] text-[#7F8C8D]">{cell.label}</p>
            <p className="font-semibold tabular-nums">
              {cell.value} {azn}
            </p>
          </div>
        ))}
      </div>
      {drawer.drops.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-xs text-[#7F8C8D]">
          {drawer.drops.map((drop) => (
            <li key={drop.id} className="flex justify-between gap-3">
              <span>
                {bakuTimeLabel(drop.createdAt)}
                {drop.note ? ` · ${drop.note}` : ""}
              </span>
              <span className="tabular-nums">
                {drop.amountAzn.toFixed(2)} {azn}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
