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
  return (
    <div className="mb-3 rounded-md bg-[#F7F9FA] p-3 text-sm text-[#34495E]">
      <p className="mb-2 font-semibold">
        {labels.title}
        {drawer.openedBy ? ` · ${drawer.openedBy}` : ""}
        {` · ${bakuTimeLabel(drawer.openedAt)}`}
      </p>
      <p>
        {labels.opening} {drawer.opening.toFixed(2)} {azn}
        {" · "}
        {labels.cashSales} {drawer.cashSales.toFixed(2)} {azn}
        {" · "}
        {labels.drops} {drawer.dropsTotal.toFixed(2)} {azn}
      </p>
      <p className="mt-1">
        {labels.expected} {drawer.expected.toFixed(2)} {azn}
        {drawer.counted != null ? ` · ${labels.counted} ${drawer.counted.toFixed(2)} ${azn}` : ""}
        {drawer.variance != null ? ` · ${labels.variance} ${drawer.variance.toFixed(2)} ${azn}` : ""}
      </p>
      {drawer.drops.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-[#7F8C8D]">
          {drawer.drops.map((drop) => (
            <li key={drop.id}>
              {bakuTimeLabel(drop.createdAt)} · {drop.amountAzn.toFixed(2)} {azn}
              {drop.note ? ` · ${drop.note}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
