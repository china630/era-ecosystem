"use client";

import { Minus, Plus, Trash2 } from "lucide-react";

export type CheckLine = {
  id: string;
  description: string;
  qty: number;
  unitPriceAzn: string | number;
};

export function CheckLines({
  lines,
  onQty,
  onRemove,
  onToggle,
  selectedIds,
  labels,
  azn,
}: {
  lines: CheckLine[];
  onQty?: (line: CheckLine, qty: number) => void;
  onRemove?: (line: CheckLine) => void;
  onToggle?: (line: CheckLine) => void;
  selectedIds?: string[];
  labels: { name: string; qty: string; price: string; sum: string; minus: string; plus: string; remove?: string };
  azn: string;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs font-medium text-[#7F8C8D]">
          <th className="pb-2 font-medium">{labels.name}</th>
          <th className="pb-2 text-center font-medium">{labels.qty}</th>
          <th className="pb-2 text-right font-medium">{labels.price}</th>
          <th className="pb-2 text-right font-medium">{labels.sum}</th>
          {onRemove ? <th className="pb-2 w-8" /> : null}
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const price = Number(line.unitPriceAzn);
          const sum = line.qty * price;
          return (
            <tr key={line.id} className="border-t border-[#F0F3F4]">
              <td className="py-2 pr-2 font-medium text-[#2C3E50]">
                <span className="flex items-center gap-2">
                  {onToggle ? (
                    <input
                      type="checkbox"
                      checked={selectedIds?.includes(line.id) ?? false}
                      onChange={() => onToggle(line)}
                    />
                  ) : null}
                  {line.description}
                </span>
              </td>
              <td className="py-2">
                {onQty ? (
                  <span className="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded border border-[#D5DADF] text-[#34495E]"
                      aria-label={labels.minus}
                      onClick={() => onQty(line, line.qty - 1)}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center tabular-nums">{line.qty}</span>
                    <button
                      type="button"
                      className="flex h-7 w-7 items-center justify-center rounded border border-[#D5DADF] text-[#34495E]"
                      aria-label={labels.plus}
                      onClick={() => onQty(line, line.qty + 1)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <span className="block text-center tabular-nums">{line.qty}</span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums text-[#34495E]">
                {price.toFixed(2)}
              </td>
              <td className="py-2 text-right font-semibold tabular-nums text-[#2C3E50]">
                {sum.toFixed(2)} {azn}
              </td>
              {onRemove ? (
                <td className="py-2 pl-1 text-right">
                  <button
                    type="button"
                    className="rounded p-1 text-[#C0392B]"
                    aria-label={labels.remove ?? labels.minus}
                    onClick={() => onRemove(line)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
