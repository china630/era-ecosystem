"use client";

import type { ReactNode } from "react";

export type ColorLegendItem = {
  id: string;
  label: string;
  swatchClassName: string;
  swatch?: ReactNode;
};

export type ColorLegendProps = {
  items: ColorLegendItem[];
  className?: string;
  /** Accessible label for the legend group */
  ariaLabel?: string;
};

export function ColorLegend({ items, className = "", ariaLabel = "Legend" }: ColorLegendProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[#7F8C8D] ${className}`}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5">
          {item.swatch ?? (
            <span
              className={`inline-block h-3 w-3 shrink-0 rounded-sm border border-[#D5DADF] ${item.swatchClassName}`}
              aria-hidden
            />
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
