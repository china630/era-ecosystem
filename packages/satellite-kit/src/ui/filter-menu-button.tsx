"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SECONDARY_BUTTON_CLASS } from "./design-system";

export type FilterMenuOption<T extends string = string> = {
  value: T;
  label: string;
};

export type FilterMenuButtonProps<T extends string = string> = {
  label: string;
  value: T;
  options: FilterMenuOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export function FilterMenuButton<T extends string = string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: FilterMenuButtonProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        className={`${SECONDARY_BUTTON_CLASS} inline-flex items-center gap-1.5`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[#7F8C8D]">{label}:</span>
        <span className="font-semibold text-[#34495E]">{active?.label ?? value}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-[#D5DADF] bg-white py-1 shadow-lg"
          role="menu"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitem"
              className={`block w-full px-3 py-2 text-left text-[13px] hover:bg-[#EBF5FB] ${
                opt.value === value ? "font-semibold text-[#2980B9]" : "text-[#34495E]"
              }`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
