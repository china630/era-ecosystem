"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

export function FieldSection({
  title,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  badge,
  children,
  className,
}: {
  title: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  badge?: string | number;
  children: ReactNode;
  className?: string;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function toggle() {
    const next = !open;
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  return (
    <section className={`rounded-xl border border-[#D5DADF] bg-white/50 ${className ?? ""}`.trim()}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        onClick={toggle}
        aria-expanded={open}
      >
        <span className="text-[13px] font-semibold text-[#34495E]">{title}</span>
        <span className="flex items-center gap-2">
          {badge != null && badge !== "" ? (
            <span className="rounded-md bg-[#F8FAFC] px-1.5 py-0.5 text-[11px] font-medium text-[#7F8C8D]">
              {badge}
            </span>
          ) : null}
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-[#7F8C8D] transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
      {open ? <div className="space-y-4 border-t border-[#D5DADF] px-3 pb-3 pt-3">{children}</div> : null}
    </section>
  );
}
